export const ORDER_STATUS_ORDER = [
  'filling',
  'checking',
  'completed',
  'design',
  'printing',
  'delivered',
] as const

export type OrderStatusOrder = (typeof ORDER_STATUS_ORDER)[number]

/** Muted pills for client-facing UI — keeps the emotional tone soft. */
export const ORDER_STATUS_META: Record<
  string,
  { label: string; pillClass: string; workspacePillClass: string; dotColor: string }
> = {
  filling: {
    label: 'Толтырылуда',
    pillClass: 'bg-slate-100 text-slate-800 ring-slate-900/8',
    workspacePillClass: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
    dotColor: '#3b82f6',
  },
  checking: {
    label: 'Тексеруде',
    pillClass: 'bg-amber-50 text-amber-950 ring-amber-900/12',
    workspacePillClass: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
    dotColor: '#f59e0b',
  },
  completed: {
    label: 'Өңделді',
    pillClass: 'bg-emerald-50 text-emerald-950 ring-emerald-900/10',
    workspacePillClass: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300',
    dotColor: '#10b981',
  },
  design: {
    label: 'Дизайнда',
    pillClass: 'bg-violet-50 text-violet-950 ring-violet-900/10',
    workspacePillClass: 'bg-violet-100 text-violet-900 ring-1 ring-violet-300',
    dotColor: '#8b5cf6',
  },
  printing: {
    label: 'Басылуда',
    pillClass: 'bg-sky-50 text-sky-950 ring-sky-900/10',
    workspacePillClass: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300',
    dotColor: '#0ea5e9',
  },
  delivered: {
    label: 'Жеткізілді',
    pillClass: 'bg-teal-50 text-teal-950 ring-teal-900/10',
    workspacePillClass: 'bg-teal-100 text-teal-900 ring-1 ring-teal-300',
    dotColor: '#14b8a6',
  },
}

const pillBase =
  'inline-flex items-center rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold tracking-tight whitespace-nowrap ring-1 ring-inset'

/** Soft muted pill — user dashboard and non-critical contexts. */
export function orderStatusPillClass(status: string) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.filling
  return `${pillBase} ${meta.pillClass}`
}

/** Vivid pill with a colored dot — workspace views (admin, manager, editor). */
export function orderStatusWorkspacePill(status: string) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.filling
  return `${pillBase} ${meta.workspacePillClass}`
}

export function orderStatusDotColor(status: string) {
  return (ORDER_STATUS_META[status] ?? ORDER_STATUS_META.filling).dotColor
}

export function orderStatusLabel(status: string) {
  return (ORDER_STATUS_META[status] ?? ORDER_STATUS_META.filling).label
}
