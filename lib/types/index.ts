export interface Question {
  id: string
  question_kk: string
  question_type: 'text' | 'photo' | 'photo_with_text'
  is_required: boolean
  hint_kk?: string
  sort_order: number
}

/** Admin chapter kind: `faktiler` inserts the facts block after all standard chapters, before hat. */
export type ChapterPartKind = 'standard' | 'faktiler'

/** One fact spread in the book: rich text page + full-page photo. */
export interface FaktilerFactSlot {
  id: string
  text: string
  photo_path: string
}

export interface Chapter {
  id: string
  title_kk: string
  sort_order: number
  questions: Question[]
  is_foreword?: boolean
  is_afterword?: boolean
  part_kind?: ChapterPartKind
  /** Admin: phrase for fixed 60/40 page after this chapter’s subtitle (category_phrases.id). */
  fixed_phrase_id?: string | null
  /** Hydrated client-side from category_phrases for preview/PDF. */
  fixed_phrase_kk?: string | null
}

export interface CustomPage {
  id: string
  order_id: string
  page_type: 'custom_photo' | 'custom_text' | 'custom_poem'
  sort_order: number
  /** Body text for custom_text/custom_poem; null inherits order.answer_font_preset */
  text_font_preset?: string | null
  photo_path?: string
  text_content?: string
  overlay_text?: string
  overlay_position?: string
  photo_dpi?: number
  title_kk?: string
  /** 0–100 text shadow strength under overlay headline (null = platform default). */
  overlay_shadow_opacity?: number | null
  /** Lines per stanza for `custom_poem` pages (4–8). */
  poem_stanza_lines?: number | null
  /** Omit from preview/PDF book output; editor card stays visible. */
  hidden_from_book?: boolean | null
  /** Optional link shown as QR on custom_photo (must not share vertical band with overlay text). */
  qr_url?: string | null
  qr_size?: 'lg' | 'xl' | null
  qr_vertical?: 'top' | 'center' | 'bottom' | null
  /** When false, overlay is omitted from preview/PDF but overlay_text is saved. */
  overlay_in_book?: boolean | null
  /** When false, QR is omitted from preview/PDF but qr_url is saved. */
  qr_in_book?: boolean | null
  /** Reserves a category phrase for overlay chips (one use per phrase per order in UI). */
  selected_phrase_id?: string | null
}

export type OrderStatus =
  | 'filling'
  | 'checking'
  | 'completed'
  | 'design'
  | 'printing'
  | 'delivered'

export interface Order {
  id: string
  book_title: string
  category_id: string | null
  /** DB column. Some legacy code paths still reference `user_id`; keep as alias. */
  client_id: string
  /** Legacy alias kept for backwards-compat; prefer `client_id`. */
  user_id?: string
  author_name: string
  recipient_name: string
  delivery_address?: string
  status: OrderStatus
  assigned_editor?: string | null
  assigned_designer?: string | null
  editor_notes?: string | null
  designer_notes?: string | null
  created_at: string
  updated_at?: string
  submitted_at?: string | null
  completed_at?: string | null

  // Typography settings
  answer_font_preset?: string
  answer_text_align?: 'justify' | 'left'
  /** Foreword / hat: null inherits answer_font_preset */
  algy_font_preset?: string | null
  hat_font_preset?: string | null

  algy_soz?: string | null
  hat_text?: string | null
  faktiler_text?: string | null
  faktiler_photo_path?: string | null
  /** Ordered fact spreads (jsonb in DB). */
  faktiler_facts?: FaktilerFactSlot[] | unknown | null
  /**
   * When true, the client may use AI text tools in their book editor for this order only.
   * Editors (staff role `editor`) cannot edit the book while this is on.
   */
  client_ai_enabled?: boolean
  /** Hex #RRGGBB: bottom rectangle on all fixed chapter pages. */
  fixed_rectangle_color?: string | null
  /**
   * Trial/demo book: editor limits answers to the first `TRIAL_FREE_QUESTION_COUNT` standard questions until admin clears this flag.
   */
  trial_mode?: boolean | null
  /** Client upload: reserved for layout/print PDF package; omitted from spreads preview & export PDF. */
  admin_cover_print_path?: string | null
}

export type Answers = Record<string, string>

export interface BookPage {
  type: 'question' | 'custom'
  data: Question | CustomPage
}
