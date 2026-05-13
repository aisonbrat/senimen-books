# Senimen Books — Platform Technical Summary

**Document type:** Technical annex (legal handover / Offerta support)  
**Version:** 1.0  
**Date:** 2026-05-12  
**Scope:** Senimen Books application — Next.js + Supabase codebase

> This document describes **implemented architecture and controls**. It is **not** legal advice. For privacy policy, DPA, or jurisdiction-specific disclosures, use this as a **technical annex** alongside counsel-approved instruments.

---

## Table of contents

1. [Tech stack & infrastructure](#1-tech-stack--infrastructure)  
2. [Core business logic](#2-core-business-logic)  
3. [Data privacy & security](#3-data-privacy--security-offerta-relevant)  
4. [Operational workflow](#4-operational-workflow)  
5. [Performance & reliability](#5-performance--reliability-measures)  
6. [Roles summary](#6-roles-summary)  
7. [Limitations](#7-limitations-of-this-document)

---

## 1. Tech stack & infrastructure

### 1.1 Frontend

| Area | Technology |
|------|-------------|
| Framework | **Next.js** (App Router), React |
| Styling | **Tailwind CSS** (v4 pipeline in project) |
| Client state | **Zustand** (e.g. `editorStore` — book editor session: order, chapters, answers, custom pages, typography, saving/loading) |
| Rich text | **TipTap** (where used for editor content) |
| Client PDF | **jsPDF** (in-browser export) |

**Routing & access:** `middleware.ts` refreshes the Supabase session from cookies, loads `profiles.role`, and redirects unauthenticated users from protected areas (`/dashboard`, `/editor-dashboard`, `/manager-dashboard`, `/admin`) to login or guided entry (`/start`). Role rules: `/admin` → **admin** only; `/editor-dashboard` → **editor** or **admin**; `/manager-dashboard` → **manager** or **admin**. Public routes include `/`, `/start`, `/auth/*`, `/design-preview`, and `/api/public/*`.

### 1.2 Backend & data layer

| Area | Technology |
|------|-------------|
| Primary backend | **Supabase**: PostgreSQL + **PostgREST** |
| Auth | **Supabase Auth** (JWT in cookies for SSR) |
| Privileged ops | **Service role** Supabase client (server-only, validated env) for admin/manager flows that must bypass RLS where designed (e.g. creating orders for any category) |
| Server logic | **Next.js Server Actions** (`'use server'`) and **Route Handlers** (`app/api/...`) |

There is no separate custom application server: rules live in Next.js (client, server components, actions, API routes) and Postgres (RLS, triggers, functions).

### 1.3 Storage

- Book images: **`book-photos`** Storage bucket (logical name; DB policies reference `storage.buckets` UUID).
- Access: Postgres **RLS on `storage.objects`**, with **`user_can_read_book_photos_object(name)`** (SECURITY DEFINER) tying object path prefixes to `orders.id` and then **client ownership** or **staff** (see §3.4).

### 1.4 Environments & build

- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; service role key **server-only**.
- Production stability: `npm run build` (Next.js + TypeScript).

---

## 2. Core business logic

### 2.1 Categories → chapters → questions

- **`categories`**: Product / template (book type).
- **`chapters`**: Ordered sections per `category_id`. **RLS:** authenticated **read**; **admin** manages writes.
- **`questions`**: Belong to a chapter (`chapter_id`); prompts, types, sort order.

Chapters may use **`faktiler`** part kind (fact spreads: structured slots with text + photo paths stored on the order).

### 2.2 Orders & answers

- **`orders`**: One book instance: `client_id` (owner), `category_id`, metadata (title, names, delivery text, **status**, typography, faktiler JSON, flags such as **`trial_mode`**, **`client_ai_enabled`**, print paths).
- **`answers`**: Rows per **`(order_id, question_id)`** with text content — the client’s substantive **personal content** for template questions.

**Editor load:** `useEditorData` loads order (slim select), chapters + questions for the category, answers, custom pages, and related rows (e.g. `order_chapter_fixed_photos`). **Zustand** holds the working set for UI and autosave.

### 2.3 Custom pages (`custom_pages`)

- Scoped to **`order_id`**, ordered by **`sort_order`**, **`page_type`**: `custom_photo` | `custom_text` | `custom_poem`.
- Fields: photos (`photo_path` pipe-separated storage keys), text, overlay (text, position, in-book flags), QR (URL, size, vertical, in-book flag), typography, poem stanza lines, `hidden_from_book`, selected phrase for overlays.

**Persistence:** Metadata via Supabase; photos uploaded under **`book-photos`** paths keyed by **`order_id`**, paths stored on the row.

### 2.4 Order status & PDF

**Statuses** (type system): `filling`, `checking`, `completed`, `design`, `printing`, `delivered` (fulfillment pipeline).

**Typical flow:**

1. **`filling`** — Client/staff completes book; answers and order fields saved.
2. Submit for review → **`checking`** (app + RLS govern client updates while filling).
3. **`checking`** — Editor workflow; assignment may set `assigned_editor`; completion may set **`completed`**.
4. **`design` / `printing` / `delivered`** — Production/logistics if used operationally.

**PDF:** `lib/utils/pdfExport.ts` (`exportBookToPDF`) using **jsPDF**, same conceptual inputs as preview: order + chapters + answers + custom pages + typography + fixed chapter photos. **Client:** `ExportButton`. **Admin:** `PDFButton` on admin orders (widened order select).

---

## 3. Data privacy & security (Offerta-relevant)

### 3.1 Row Level Security (RLS) — tenant isolation

RLS is enabled on core tables including **`orders`**, **`answers`**, **`custom_pages`**, **`profiles`**, **`profile_phones`**, and related tables (e.g. **`order_chapter_fixed_photos`**, **`trial_global_categories`**, **`ai_enhancement_logs`** where applicable).

**Representative rules:**

- **`orders`**
  - **SELECT:** Clients — `client_id = auth.uid()`; staff — `is_staff()` (SECURITY DEFINER helper).
  - **INSERT (clients):** `client_id = auth.uid()` and `category_id` must exist in **`trial_global_categories`** (self-service trial catalog).
  - **UPDATE (clients):** Own rows while **`status = 'filling'`** (clients cannot freely mutate staff-controlled states).
  - **Staff:** Separate policies for staff read/update as required for fulfillment.

- **`answers` / `custom_pages`**
  - **Clients:** Mutations only when linked order has **`client_id = auth.uid()`**.
  - **Staff:** Access via **`is_staff()`** where policies exist.

- **`chapters` / `questions`**
  - Largely **catalog**: authenticated read; admin-managed writes.

**Offerta angle:** Book **content** is partitioned by **`client_id`** at the database; staff access is an **explicit, role-gated** exception for service delivery.

### 3.2 Trial vs staff-created orders

- **Self-service trial:** `trial_global_categories` + RLS on client **`orders`** insert + trigger **`orders_trial_mode_gate`** sets **`trial_mode`** for listed categories; clients cannot flip **`trial_mode`** on their own updates.
- **Non-trial / arbitrary category:** **Admin/manager** server actions using **service role** (e.g. `adminCreateOrderForUser`) with **`trial_mode: false`**, bypassing client self-insert restrictions.

### 3.3 Server actions — `requireAdmin` / `requireStaff`

**Module:** `lib/auth/requireStaff.ts`

- **`requireAuthenticatedProfile()`** — Server Supabase + session; loads `profiles.role` under RLS.
- **`requireAdmin()`** — `role === 'admin'`.
- **`requireStaff(allowed[])`** — `role ∈ allowed`.
- **`requireAdminOrManager()`** — `['admin','manager']`.

Actions under `app/admin/**`, `app/manager-dashboard/actions.ts`, `app/editor-dashboard/actions.ts`, etc., should call these gates before mutations. **Managers** may have additional **target scoping** (e.g. only `client` users) per module comments.

**Defense in depth:** Server gates + **RLS** so a misconfigured client cannot read other users’ orders.

### 3.4 Sensitive data — phone numbers (`profile_phones`)

- Phones stored in **`profile_phones`** (`profile_id` PK → `profiles.id`), not on the main **`profiles`** row used for many directory reads.
- **`profiles`:** Phone column removed in favor of this split so editors/designers can list users **without** reading phone from `profiles`.
- **`profile_phones` RLS:** Owner read/write; admin/manager paths use **SECURITY DEFINER** helpers (e.g. `actor_is_admin_or_manager()`) to avoid **recursive RLS** on `profiles` policies.

### 3.5 Storage — book photos

- **`storage.objects`** policies for book-photos require **authenticated** + **`user_can_read_book_photos_object(name)`**.
- Function parses first path segment as **`orders.id`**; allows if caller is **`orders.client_id`** or **`is_staff()`**.
- **No** broad anonymous read of private paths by URL guessing.

**Client patterns:** `lib/storage/bookPhotos.ts` — public bucket mode (if configured) vs signed URLs; optional **`GET /api/book-photo?path=...`** uses server session + `storage.download` (same RLS) for cookie/JWT edge cases.

---

## 4. Operational workflow

### 4.1 Guest / trial → order

1. Public `/`, `/start`, auth, limited `/api/public/*`, anon read of trial catalog where migrations allow.
2. **Auth:** Supabase Auth + `profiles`; `profile_phones` row ensured via trigger on new profiles.
3. **Trial book:** Client picks category allowed in UI **and** in `trial_global_categories`; insert satisfies RLS; `trial_mode` may be set by DB trigger.
4. **Full / staff-provisioned book:** Admin/manager creates order (service role), any allowed category, `trial_mode: false`.

### 4.2 `filling` → review → export → production

1. Client completes answers, custom pages, typography; autosave persists to `answers`, `orders`, `custom_pages`, `order_chapter_fixed_photos`.
2. Submit moves order toward **`checking`** (exact UX varies; status + RLS enforce boundaries).
3. Staff editor under `/editor-dashboard`; completion → **`completed`** (and downstream statuses if used).
4. **PDF:** Generated in-browser from hydrated data (no separate PDF microservice in-repo).

---

## 5. Performance & reliability measures

### 5.1 Query slimming

**`lib/supabase/querySelects.ts`:** explicit column lists (`ORDERS_EDITOR_SELECT`, `ANSWERS_TEXT_ONLY_SELECT`, `CUSTOM_PAGES_EDITOR_SELECT`, `ORDERS_DASHBOARD_CLIENT_SELECT`, `ORDERS_ADMIN_LIST_SELECT`) to avoid `select('*')` and keep editor/dashboard/PDF shapes aligned.

### 5.2 Save pipeline serialization

**`useEditorData`:** mutex/queue around **`save()`** so debounced autosave and manual save do not run **overlapping** writes. Network-class failures can surface a **toast** via `lib/utils/editorSaveErrorToast.ts`.

### 5.3 Unified storage utility

**`lib/storage/bookPhotos.ts`:** normalizes DB path shapes, signed vs public URLs, optional `/api/book-photo` proxy.

### 5.4 Indexing

Migrations index hot paths (e.g. `orders(client_id)`, `status`, `answers(order_id)`, `custom_pages(order_id, sort_order)`).

---

## 6. Roles summary

| Role | Primary surfaces |
|------|------------------|
| **client** | `/dashboard`, book editor, profile |
| **editor** | `/editor-dashboard` |
| **designer** | Staff/design flows as implemented |
| **manager** | `/manager-dashboard` (scoped client ops) |
| **admin** | `/admin` |

**Layers:** Middleware (routes) → RLS (data) → server actions (mutations).

---

## 7. Limitations of this document

- Reflects **codebase / migrations** at versioning time; production must match **applied migrations** and env (e.g. public vs private book-photos bucket).
- Does not replace privacy policy, DPA, or counsel-approved Offerta text.

---

## Change log

| Version | Date | Notes |
|---------|------|--------|
| 1.0 | 2026-05-12 | Initial consolidated technical annex |
