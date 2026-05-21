/** Who may edit a book in staff editor UI (`checking` only; admin always). */

export function getOrderAssignedEditorId(
  order: { assigned_editor?: string | null; editor_id?: string | null } | null | undefined,
): string | null {
  if (!order) return null
  const id = order.assigned_editor ?? order.editor_id ?? null
  return id ? String(id) : null
}

export function isStaffAdminRole(actorRole: string | null | undefined): boolean {
  return actorRole === 'admin' || actorRole === 'manager'
}

/** Editors may edit only when assigned; admins/managers may edit any `checking` order. */
export function canEditorRoleEditOrder(
  order: { status?: string; assigned_editor?: string | null; editor_id?: string | null } | null | undefined,
  userId: string | null | undefined,
  actorRole: string | null | undefined,
): boolean {
  if (!order) return false
  if (order.status !== 'checking') return false
  if (isStaffAdminRole(actorRole)) return true
  if (actorRole !== 'editor' || !userId) return false
  return getOrderAssignedEditorId(order) === userId
}

export type EditorAssignmentBlockReason = 'not_checking' | 'unassigned' | 'other_editor'

export function editorAssignmentBlockReason(
  order: { status?: string; assigned_editor?: string | null; editor_id?: string | null } | null | undefined,
  userId: string | null | undefined,
  actorRole: string | null | undefined,
): EditorAssignmentBlockReason | null {
  if (actorRole !== 'editor' || !order) return null
  if (order.status !== 'checking') return 'not_checking'
  const assigned = getOrderAssignedEditorId(order)
  if (!assigned) return 'unassigned'
  if (assigned !== userId) return 'other_editor'
  return null
}

export function editorAssignmentBlockMessage(reason: EditorAssignmentBlockReason): string {
  switch (reason) {
    case 'unassigned':
      return 'Админ сізді осы кітапқа редактор ретінде тағайындауы керек. Өңдеу құқығы жоқ.'
    case 'other_editor':
      return 'Бұл кітап басқа редакторға тағайындалған. Өңдеу құқығы жоқ.'
    default:
      return 'Бұл кезеңде редактор өңдей алмайды.'
  }
}
