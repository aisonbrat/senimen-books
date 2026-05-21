'use client'

import type { ComponentType, ReactNode } from 'react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { ORDER_STATUS_ORDER, orderStatusLabel, orderStatusWorkspacePill } from '@/lib/design/order-status'
import { getOrderAssignedEditorId } from '@/lib/utils/editorOrderAccess'
import type { AdminOrdersColumnId } from '@/lib/admin/adminOrdersTablePrefs'
import type { OrderProgress } from '@/lib/admin/orderBookProgress'

/* eslint-disable @typescript-eslint/no-explicit-any */

type OrderRow = {
  id: string
  book_title?: string | null
  category_id?: string | null
  trial_mode?: boolean | null
  author_name?: string | null
  recipient_name?: string | null
  client_id?: string | null
  delivery_address?: string | null
  assigned_editor?: string | null
  editor_id?: string | null
  created_at: string
  status: string
  client_ai_enabled?: boolean
}

type Props = {
  order: OrderRow
  columnId: AdminOrdersColumnId
  cellPad: string
  stickyBookCls: string
  categories: Record<string, string>
  clientPhones: Record<string, string>
  progress?: OrderProgress
  editorRoster: Array<{ id: string; full_name: string }>
  editorAssigningId: string | null
  updatingId: string | null
  aiUpdatingId: string | null
  isDeletePending: boolean
  selectCls: string
  onAssignEditor: (orderId: string, editorId: string | null) => void
  onUpdateStatus: (orderId: string, status: string) => void
  onResetToChecking: (orderId: string) => void
  onResetToFilling: (orderId: string) => void
  onToggleClientAi: (orderId: string, enabled: boolean) => void
  onDeleteClick: (orderId: string, bookTitle: string) => void
  PDFButton: ComponentType<{ order: any }>
  AdminCoverDownloadButton: ComponentType<{ order: any }>
  OrderProgressDisplay: ComponentType<{ progress?: OrderProgress }>
}

export function AdminOrderTableCell({
  order,
  columnId,
  cellPad,
  stickyBookCls,
  categories,
  clientPhones,
  progress,
  editorRoster,
  editorAssigningId,
  updatingId,
  aiUpdatingId,
  isDeletePending,
  selectCls,
  onAssignEditor,
  onUpdateStatus,
  onResetToChecking,
  onResetToFilling,
  onToggleClientAi,
  onDeleteClick,
  PDFButton,
  AdminCoverDownloadButton,
  OrderProgressDisplay,
}: Props) {
  const td = (extra?: string, children?: ReactNode) => (
    <td className={clsx(cellPad, columnId === 'book' && stickyBookCls, extra)}>{children}</td>
  )

  switch (columnId) {
    case 'book':
      return td('min-w-[140px] max-w-[220px]', (
        <div className="text-[13px] font-semibold leading-snug text-[color:var(--text-primary)]">
          {order.book_title}
        </div>
      ))
    case 'category':
      return td(undefined, order.category_id && categories[order.category_id] ? (
        <span className="inline-flex whitespace-nowrap rounded-[var(--radius-sm)] border border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
          {categories[order.category_id]}
        </span>
      ) : null)
    case 'version':
      return td(undefined, order.trial_mode ? (
        <span
          className="inline-flex whitespace-nowrap rounded-[var(--radius-sm)] bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-200"
          title="Тегін кезең — толық қолжетімділік әлі берілмеген"
        >
          Тегін нұсқа
        </span>
      ) : (
        <span className="text-[11px] font-medium text-[color:var(--text-muted)]">Толық</span>
      ))
    case 'progress':
      return td(undefined, <OrderProgressDisplay progress={progress} />)
    case 'author':
      return td('text-[13px] text-[color:var(--text-secondary)]', order.author_name)
    case 'recipient':
      return td('text-[13px] text-[color:var(--text-secondary)]', order.recipient_name)
    case 'phone':
      return td('whitespace-nowrap font-mono text-[12px] text-[color:var(--text-secondary)]', (
        order.client_id && clientPhones[order.client_id]
          ? clientPhones[order.client_id]
          : <span className="text-[color:var(--text-muted)]">—</span>
      ))
    case 'address':
      return td('max-w-[180px] text-[12px] text-[color:var(--text-muted)]', (
        <div className="truncate">{order.delivery_address}</div>
      ))
    case 'editor':
      return td('min-w-[150px] max-w-[200px]', (
        <select
          value={getOrderAssignedEditorId(order) ?? ''}
          disabled={editorAssigningId === order.id}
          onChange={(e) => {
            const v = e.target.value
            onAssignEditor(order.id, v ? v : null)
          }}
          className={clsx(selectCls, 'w-full max-w-[190px]')}
          title="Редакторды тағайындау"
        >
          <option value="">— Тағайындамаған —</option>
          {editorRoster.map((ed) => (
            <option key={ed.id} value={ed.id}>{ed.full_name}</option>
          ))}
        </select>
      ))
    case 'date':
      return td('whitespace-nowrap text-[11px] tabular-nums text-[color:var(--text-muted)]', (
        new Date(order.created_at).toLocaleDateString('ru-RU')
      ))
    case 'status':
      return td(undefined, (
        <span className={orderStatusWorkspacePill(order.status)}>
          {orderStatusLabel(order.status)}
        </span>
      ))
    case 'statusActions':
      return td('min-w-[200px]', (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={order.status}
            disabled={updatingId === order.id}
            onChange={(e) => onUpdateStatus(order.id, e.target.value)}
            className={selectCls}
          >
            {ORDER_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{orderStatusLabel(s)}</option>
            ))}
          </select>
          {(order.status === 'completed' || order.status === 'checking') && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={updatingId === order.id}
              onClick={() => onResetToChecking(order.id)}
              className="border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
            >
              → Тексеруде
            </Button>
          )}
          {order.status !== 'filling' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={updatingId === order.id}
              onClick={() => onResetToFilling(order.id)}
              className="border-[color:var(--accent-ring)] bg-[color:var(--accent-surface)] text-[color:var(--accent)] hover:bg-[color:var(--accent-muted)]"
            >
              → Толтыруда
            </Button>
          )}
        </div>
      ))
    case 'ai':
      return td(undefined, (
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)]">
          <input
            type="checkbox"
            checked={!!order.client_ai_enabled}
            disabled={aiUpdatingId === order.id}
            onChange={(e) => onToggleClientAi(order.id, e.target.checked)}
            className="size-4 shrink-0 accent-[color:var(--accent)]"
          />
          <span className="max-w-[5rem] leading-snug">AI</span>
        </label>
      ))
    case 'export':
      return td(undefined, (
        <div className="flex flex-wrap gap-1">
          <PDFButton order={order} />
          <AdminCoverDownloadButton order={order} />
        </div>
      ))
    case 'delete':
      return td('whitespace-nowrap', (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isDeletePending}
          className="border-red-200 bg-red-50/90 text-red-800 hover:border-red-300 hover:bg-red-100"
          onClick={() => onDeleteClick(order.id, (order.book_title || '').trim() || 'Тапсырыс')}
        >
          Жою
        </Button>
      ))
    default:
      return td()
  }
}
