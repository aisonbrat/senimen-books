export type AdminOrdersColumnId =
  | 'book'
  | 'category'
  | 'version'
  | 'progress'
  | 'author'
  | 'recipient'
  | 'phone'
  | 'address'
  | 'editor'
  | 'date'
  | 'status'
  | 'statusActions'
  | 'ai'
  | 'export'
  | 'delete'

export type AdminOrdersColumnPresetId = 'minimal' | 'standard' | 'full'

export const ADMIN_ORDERS_TABLE_COLUMNS: Array<{
  id: AdminOrdersColumnId
  label: string
  hideable: boolean
  defaultVisible: boolean
}> = [
  { id: 'book', label: 'Кітап', hideable: false, defaultVisible: true },
  { id: 'category', label: 'Түрі', hideable: true, defaultVisible: true },
  { id: 'version', label: 'Нұсқа', hideable: true, defaultVisible: false },
  { id: 'progress', label: 'Прогресс', hideable: true, defaultVisible: true },
  { id: 'author', label: 'Автор', hideable: true, defaultVisible: true },
  { id: 'recipient', label: 'Алушы', hideable: true, defaultVisible: true },
  { id: 'phone', label: 'Телефон', hideable: true, defaultVisible: false },
  { id: 'address', label: 'Мекенжай', hideable: true, defaultVisible: false },
  { id: 'editor', label: 'Редактор', hideable: true, defaultVisible: true },
  { id: 'date', label: 'Күні', hideable: true, defaultVisible: true },
  { id: 'status', label: 'Статус', hideable: true, defaultVisible: true },
  { id: 'statusActions', label: 'Өзгерту', hideable: true, defaultVisible: true },
  { id: 'ai', label: 'AI', hideable: true, defaultVisible: false },
  { id: 'export', label: 'PDF · Мұқаба', hideable: true, defaultVisible: true },
  { id: 'delete', label: 'Жою', hideable: false, defaultVisible: true },
]

const COLUMN_IDS = new Set(ADMIN_ORDERS_TABLE_COLUMNS.map((c) => c.id))

export const ADMIN_ORDERS_COLUMN_PRESETS: Record<
  AdminOrdersColumnPresetId,
  { label: string; columns: AdminOrdersColumnId[] }
> = {
  minimal: {
    label: 'Минималды',
    columns: ['book', 'progress', 'editor', 'status', 'statusActions', 'export', 'delete'],
  },
  standard: {
    label: 'Стандарт',
    columns: ADMIN_ORDERS_TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id),
  },
  full: {
    label: 'Барлығы',
    columns: ADMIN_ORDERS_TABLE_COLUMNS.map((c) => c.id),
  },
}

const STORAGE_COLUMNS = 'senimen-admin-orders-columns-v1'
const STORAGE_COMPACT = 'senimen-admin-orders-compact-v1'

export function defaultVisibleColumnSet(): Set<AdminOrdersColumnId> {
  return new Set(
    ADMIN_ORDERS_TABLE_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id),
  )
}

function parseColumnIds(raw: unknown): AdminOrdersColumnId[] | null {
  if (!Array.isArray(raw)) return null
  const ids = raw.filter((id): id is AdminOrdersColumnId => COLUMN_IDS.has(id as AdminOrdersColumnId))
  if (ids.length === 0) return null
  for (const col of ADMIN_ORDERS_TABLE_COLUMNS) {
    if (!col.hideable && !ids.includes(col.id)) ids.unshift(col.id)
  }
  return ids
}

export function loadVisibleColumnsFromStorage(): Set<AdminOrdersColumnId> {
  if (typeof window === 'undefined') return defaultVisibleColumnSet()
  try {
    const raw = localStorage.getItem(STORAGE_COLUMNS)
    if (!raw) return defaultVisibleColumnSet()
    const parsed = parseColumnIds(JSON.parse(raw))
    return parsed ? new Set(parsed) : defaultVisibleColumnSet()
  } catch {
    return defaultVisibleColumnSet()
  }
}

export function saveVisibleColumnsToStorage(columns: Set<AdminOrdersColumnId>): void {
  if (typeof window === 'undefined') return
  const ids = ADMIN_ORDERS_TABLE_COLUMNS.map((c) => c.id).filter((id) => columns.has(id))
  localStorage.setItem(STORAGE_COLUMNS, JSON.stringify(ids))
}

export function loadTableCompactFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_COMPACT) === '1'
  } catch {
    return false
  }
}

export function saveTableCompactToStorage(compact: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_COMPACT, compact ? '1' : '0')
}

export function visibleColumnsInOrder(columns: Set<AdminOrdersColumnId>): typeof ADMIN_ORDERS_TABLE_COLUMNS {
  return ADMIN_ORDERS_TABLE_COLUMNS.filter((c) => columns.has(c.id))
}

export function isAdminOrdersColumnVisible(
  columns: Set<AdminOrdersColumnId>,
  id: AdminOrdersColumnId,
): boolean {
  return columns.has(id)
}
