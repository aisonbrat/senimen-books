'use client'
import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  adminCreateUser,
  adminCreateEditor,
  adminCreateManager,
  adminCreateOrderForUser,
  adminDeleteUser,
  adminUpdateUserPassword,
} from './actions'
import { adminDeleteOrder } from '../orders/actions'
import { IconX } from '@/components/ui/icons'
import { innerPhoneDigitsKeyDown } from '@/components/auth'
import {
  clampPhoneFieldDigitBuffer,
  formatInnerPhoneInputDisplay,
  formatPhoneForDisplay,
} from '@/lib/utils/phone'

const PW_MIN_ADMIN = 8

type InviteFormState = { full_name: string; phone_digits: string; password: string }
const emptyInviteForm = (): InviteFormState => ({
  full_name: '',
  phone_digits: '',
  password: '',
})

const W = '#731616'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  borderWidth: '1.5px',
  borderStyle: 'solid',
  borderColor: '#EDE6E6',
  background: 'white',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  color: '#1C1010',
  fontFamily: 'inherit',
  transition: 'border-color 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060',
  marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase',
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,16,16,0.45)', backdropFilter: 'none', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 24, padding: '40px 40px', width: '100%', maxWidth: 460, boxShadow: '0 2px 8px rgba(82,29,29,0.06), 0 20px 60px rgba(82,29,29,0.16)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1C1010', margin: 0, letterSpacing: '-0.03em' }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Жабу"
            style={{ background: '#F5EDEC', border: 'none', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', color: W, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EDE3E3' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F5EDEC' }}>
            <IconX className="size-[17px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [showCreateEditor, setShowCreateEditor] = useState(false)
  const [showCreateManager, setShowCreateManager] = useState(false)
  const [giveAccessUser, setGiveAccessUser] = useState<any>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'editor' | 'client'>('all')

  const [createForm, setCreateForm] = useState(emptyInviteForm)
  const [editorForm, setEditorForm] = useState(emptyInviteForm)
  const [managerForm, setManagerForm] = useState(emptyInviteForm)
  const [accessCategoryId, setAccessCategoryId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [focusField, setFocusField] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deleteOrderConfirm, setDeleteOrderConfirm] = useState<{ id: string; catName: string } | null>(null)
  const [passwordUser, setPasswordUser] = useState<{ id: string; name: string } | null>(null)
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        setCurrentUserId(user?.id ?? null)
      })
  }, [])

  async function fetchAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const profRes = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (profRes.error) {
        setLoadError(profRes.error.message)
        setUsers([])
        setOrders([])
        setCategories([])
        return
      }
      const userRows = profRes.data || []
      const userIds = userRows.map((u: { id: string }) => u.id)
      const phoneRes =
        userIds.length > 0
          ? await supabase.from('profile_phones').select('profile_id, phone').in('profile_id', userIds)
          : { data: [] as { profile_id: string; phone: string | null }[], error: null }

      const [ordRes, catRes] = await Promise.all([
        supabase.from('orders').select('id, client_id, book_title, category_id, status, created_at'),
        supabase.from('categories').select('id, title_kk'),
      ])
      const errMsg = phoneRes.error?.message || ordRes.error?.message || catRes.error?.message || null
      if (errMsg) {
        setLoadError(errMsg)
        setUsers([])
        setOrders([])
        setCategories([])
        return
      }
      const phoneById = new Map<string, string | null>()
      ;(phoneRes.data || []).forEach((r: { profile_id: string; phone: string | null }) => {
        phoneById.set(r.profile_id, r.phone)
      })
      setUsers(
        userRows.map((u: Record<string, unknown> & { id: string }) => ({
          ...u,
          phone: phoneById.get(u.id) ?? null,
        }))
      )
      setOrders(ordRes.data || [])
      setCategories(catRes.data || [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Жүктеу қатесі')
      setUsers([])
      setOrders([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  function userOrders(userId: string) {
    return orders.filter(o => o.client_id === userId)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (createForm.password.length < PW_MIN_ADMIN) {
      setError('Уақытша құпия сөз кем дегенде 8 таңба болуы тиіс')
      return
    }
    startTransition(async () => {
      const res = await adminCreateUser({
        full_name: createForm.full_name,
        phone: createForm.phone_digits,
        password: createForm.password,
      })
      if (res.error) { setError(res.error); return }
      setShowCreate(false)
      setCreateForm(emptyInviteForm())
      fetchAll()
    })
  }

  async function handleCreateEditor(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (editorForm.password.length < PW_MIN_ADMIN) {
      setError('Уақытша құпия сөз кем дегенде 8 таңба болуы тиіс')
      return
    }
    startTransition(async () => {
      const res = await adminCreateEditor({
        full_name: editorForm.full_name,
        phone: editorForm.phone_digits,
        password: editorForm.password,
      })
      if (res.error) { setError(res.error); return }
      setShowCreateEditor(false)
      setEditorForm(emptyInviteForm())
      fetchAll()
    })
  }

  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (managerForm.password.length < PW_MIN_ADMIN) {
      setError('Уақытша құпия сөз кем дегенде 8 таңба болуы тиіс')
      return
    }
    startTransition(async () => {
      const res = await adminCreateManager({
        full_name: managerForm.full_name,
        phone: managerForm.phone_digits,
        password: managerForm.password,
      })
      if (res.error) { setError(res.error); return }
      setShowCreateManager(false)
      setManagerForm(emptyInviteForm())
      fetchAll()
    })
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordUser) return
    if (passwordForm.password.length < PW_MIN_ADMIN) {
      setError(`Құпия сөз кем дегенде ${PW_MIN_ADMIN} таңба болуы тиіс`)
      return
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setError('Құпия сөздер сәйкес келмейді')
      return
    }
    startTransition(async () => {
      const res = await adminUpdateUserPassword(passwordUser.id, passwordForm.password)
      if (res.error) {
        setError(res.error)
        return
      }
      setPasswordUser(null)
      setPasswordForm({ password: '', confirm: '' })
      setError(null)
    })
  }

  async function executeDeleteUser() {
    if (!deleteUserConfirm) return
    const { id } = deleteUserConfirm
    setError(null)
    startTransition(async () => {
      const res = await adminDeleteUser(id)
      if (res.error) {
        setError(res.error)
        return
      }
      setDeleteUserConfirm(null)
      fetchAll()
    })
  }

  async function executeDeleteOrder() {
    if (!deleteOrderConfirm) return
    const { id } = deleteOrderConfirm
    setError(null)
    startTransition(async () => {
      const res = await adminDeleteOrder(id)
      if (res.error) {
        setError(res.error)
        return
      }
      setDeleteOrderConfirm(null)
      fetchAll()
    })
  }

  async function handleGiveAccess(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!giveAccessUser || !accessCategoryId) return
    const alreadyHas = orders.some(o => o.client_id === giveAccessUser.id && o.category_id === accessCategoryId)
    if (alreadyHas) { setError('Бұл пайдаланушыда осы кітап үлгісі бұрыннан бар'); return }
    startTransition(async () => {
      const res = await adminCreateOrderForUser({
        client_id: giveAccessUser.id,
        client_name: giveAccessUser.full_name || '',
        category_id: accessCategoryId,
      })
      if (res.error) { setError(res.error); return }
      setGiveAccessUser(null)
      setAccessCategoryId('')
      fetchAll()
    })
  }

  const focusStyleFor = (key: string) => focusField === key
    ? { borderColor: W, boxShadow: `0 0 0 3px rgba(82,29,29,0.08), 0 1px 4px rgba(82,29,29,0.1)` }
    : { borderColor: '#EDE6E6', boxShadow: 'none' }

  const userForm = (form: typeof createForm, setForm: typeof setCreateForm, prefix: string) => (
    <>
      <div>
        <label style={labelStyle}>Аты-жөні</label>
        <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
          required placeholder="Толық атын жазыңыз"
          onFocus={() => setFocusField(`${prefix}_name`)} onBlur={() => setFocusField(null)}
          style={{ ...inputStyle, ...focusStyleFor(`${prefix}_name`) }} />
      </div>
      <div>
        <label style={labelStyle}>Телефон нөмірі</label>
        <div
          style={{
            ...inputStyle,
            ...focusStyleFor(`${prefix}_phone`),
            display: 'flex',
            alignItems: 'center',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <span style={{ paddingLeft: 14, paddingRight: 4, fontSize: 13, fontWeight: 700, color: '#1C1010', flexShrink: 0 }} aria-hidden>+7</span>
          <input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={13}
            value={formatInnerPhoneInputDisplay(form.phone_digits)}
            onChange={e => {
              const raw = clampPhoneFieldDigitBuffer(e.currentTarget.value)
              setForm((prev) => ({ ...prev, phone_digits: raw }))
            }}
            onKeyDown={(e) =>
              innerPhoneDigitsKeyDown(e, form.phone_digits, (raw) =>
                setForm((prev) => ({ ...prev, phone_digits: raw }))
              )
            }
            required placeholder="707 000 00 00"
            onFocus={() => setFocusField(`${prefix}_phone`)} onBlur={() => setFocusField(null)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              padding: '11px 14px 11px 4px',
              fontSize: 13,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              color: '#1C1010',
            }}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Уақытша құпия сөз</label>
        <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
          required minLength={PW_MIN_ADMIN} placeholder="Кем дегенде 8 таңба" type="password"
          onFocus={() => setFocusField(`${prefix}_pw`)} onBlur={() => setFocusField(null)}
          style={{ ...inputStyle, ...focusStyleFor(`${prefix}_pw`) }} />
      </div>
    </>
  )

  const visibleUsers = roleFilter === 'all'
    ? users
    : users.filter(u => (u.role || 'client') === roleFilter)

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    const r = u.role || 'client'
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {})

  const FILTER_TABS: Array<{ key: typeof roleFilter; label: string; count: number }> = [
    { key: 'all',     label: 'Барлығы',    count: users.length },
    { key: 'admin',   label: 'Админдер',   count: roleCounts.admin   || 0 },
    { key: 'manager', label: 'Менеджерлер',count: roleCounts.manager || 0 },
    { key: 'editor',  label: 'Редакторлар',count: roleCounts.editor  || 0 },
    { key: 'client',  label: 'Клиенттер',  count: roleCounts.client  || 0 },
  ]

  return (
    <div style={{ padding: '40px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C1010', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Пайдаланушылар</h1>
          <p style={{ fontSize: 13, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>{users.length} тіркелген</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => { setShowCreateManager(true); setError(null) }}
            style={{ background: 'white', color: '#0EA5A4', border: '1.5px solid rgba(14,165,164,0.22)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms', boxShadow: '0 1px 4px rgba(14,165,164,0.10)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ECFEFF'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'translateY(0)' }}>
            + Менеджер қосу
          </button>
          <button onClick={() => { setShowCreateEditor(true); setError(null) }}
            style={{ background: 'white', color: '#7C3AED', border: '1.5px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms', boxShadow: '0 1px 4px rgba(124,58,237,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'translateY(0)' }}>
            + Редактор қосу
          </button>
          <button onClick={() => { setShowCreate(true); setError(null) }}
            style={{ background: W, color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(82,29,29,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)' }}>
            + Клиент қосу
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {FILTER_TABS.map(tab => {
          const active = roleFilter === tab.key
          return (
            <button key={tab.key} type="button" onClick={() => setRoleFilter(tab.key)}
              style={{
                background: active ? W : 'white',
                color: active ? 'white' : '#7A6060',
                border: active ? `1.5px solid ${W}` : '1.5px solid #EDE6E6',
                borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 180ms',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 14px rgba(82,29,29,0.20)' : 'none',
              }}>
              {tab.label}
              <span style={{ fontSize: 11, fontWeight: 700, opacity: active ? 0.85 : 0.55 }}>{tab.count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 14, padding: '18px 24px', height: 58, opacity: 1 - i * 0.18, boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)' }}>
              <div style={{ width: `${38 - i * 4}%`, height: 13, background: '#F0EAEA', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ width: `${22 - i * 2}%`, height: 10, background: '#F5F0F0', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div style={{ background: '#FFF5F5', borderRadius: 14, padding: '24px 28px', border: '1px solid rgba(153,27,27,0.15)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#991B1B', margin: '0 0 8px' }}>Деректерді жүктеу мүмкін болмады</p>
          <p style={{ fontSize: 13, color: '#7A6060', margin: '0 0 14px', lineHeight: 1.55 }}>{loadError}</p>
          <button type="button" onClick={() => fetchAll()}
            style={{ background: W, color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Қайта көріңіз
          </button>
        </div>
      ) : visibleUsers.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 18, padding: '64px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 20px rgba(82,29,29,0.04)' }}>
          <p style={{ fontSize: 14, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>
            {roleFilter === 'all' ? 'Пайдаланушылар жоқ' : 'Бұл сүзгі бойынша ешкім жоқ'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F5F0F0', background: '#FDFCFC' }}>
                {['Аты-жөні', 'Телефон', 'Тіркелді', 'Кітаптары', 'Рөлі', ''].map(h => (
                  <th key={h} style={{ padding: '13px 20px', fontSize: 10, fontWeight: 700, color: '#B8A8A8', textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u, i) => {
                const uOrders = userOrders(u.id)
                const roleLabel =
                  u.role === 'admin'   ? 'Админ' :
                  u.role === 'editor'  ? 'Редактор' :
                  u.role === 'manager' ? 'Менеджер' : 'Клиент'
                const roleColor =
                  u.role === 'admin'   ? '#DC2626' :
                  u.role === 'editor'  ? '#7C3AED' :
                  u.role === 'manager' ? '#0E9794' : '#2563EB'
                const roleBg =
                  u.role === 'admin'   ? '#FEF2F2' :
                  u.role === 'editor'  ? '#F5F3FF' :
                  u.role === 'manager' ? '#ECFEFF' : '#EFF6FF'
                return (
                  <tr key={u.id} style={{ borderBottom: i < visibleUsers.length - 1 ? '1px solid #FAF6F6' : 'none', transition: 'background 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FDFCFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '15px 20px' }}>
                      {(u.role || 'client') === 'client' ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1010', fontVariantNumeric: 'tabular-nums' }}>
                            {u.phone ? (
                              <a
                                href={`tel:${String(u.phone).replace(/\D/g, '')}`}
                                style={{ color: '#1C1010', textDecoration: 'none', borderBottom: `1px solid rgba(82,29,29,0.22)` }}
                              >
                                {formatPhoneForDisplay(u.phone)}
                              </a>
                            ) : (
                              <span style={{ color: '#D4C4C4' }}>—</span>
                            )}
                          </div>
                          {u.full_name?.trim() ? (
                            <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: '#B8A8A8' }}>{u.full_name.trim()}</div>
                          ) : null}
                        </>
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1010' }}>{u.full_name || '—'}</div>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px', fontSize: 13 }}>
                      {(u.role || 'client') === 'client' ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#B8A8A8' }}>Клиенттік нөмір</span>
                      ) : u.phone ? (
                        <a
                          href={`tel:${String(u.phone).replace(/\D/g, '')}`}
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                            color: W,
                            fontWeight: 700,
                            textDecoration: 'none',
                            borderBottom: `1px solid rgba(82,29,29,0.25)`,
                          }}
                        >
                          {formatPhoneForDisplay(u.phone)}
                        </a>
                      ) : (
                        <span style={{ color: '#D4C4C4' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px', fontSize: 11, color: '#B8A8A8', whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      {uOrders.length === 0 ? (
                        <span style={{ fontSize: 12, color: '#D4C4C4', fontWeight: 500 }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {uOrders.map((o, j) => {
                            const catName = categories.find(c => c.id === o.category_id)?.title_kk || o.book_title
                            return (
                              <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: W, background: '#F5EDEC', borderRadius: 6, padding: '3px 8px 3px 9px', fontWeight: 600 }}>
                                {catName}
                                <button type="button" aria-label="Жою" onClick={() => { setError(null); setDeleteOrderConfirm({ id: o.id, catName }) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4A8A8', padding: '2px', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms', touchAction: 'manipulation' }}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#991B1B')}
                                  onMouseLeave={e => (e.currentTarget.style.color = '#C4A8A8')}>
                                  <IconX className="size-3.5" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ background: roleBg, color: roleColor, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{roleLabel}</span>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {u.role === 'client' && (
                          <button onClick={() => { setGiveAccessUser(u); setAccessCategoryId(''); setError(null) }}
                            style={{ fontSize: 11, color: '#2563EB', background: '#EFF6FF', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 150ms' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#EFF6FF')}>
                            Қолжеткізу беру
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            setPasswordUser({
                              id: u.id,
                              name: String(u.full_name || u.phone || u.id).trim() || 'Пайдаланушы',
                            })
                            setPasswordForm({ password: '', confirm: '' })
                          }}
                          style={{
                            fontSize: 11,
                            color: W,
                            background: '#F5EDEC',
                            border: 'none',
                            borderRadius: 7,
                            padding: '5px 12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            transition: 'all 150ms',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EDE3E3')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#F5EDEC')}
                        >
                          Парольді өзгерту
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            disabled={currentUserId !== null && u.id === currentUserId}
                            title={currentUserId !== null && u.id === currentUserId ? 'Өзіңізді жоюға болмайды' : undefined}
                            onClick={() => {
                              setError(null)
                              setDeleteUserConfirm({
                                id: u.id,
                                name: String(u.full_name || u.phone || u.id).trim() || 'Пайдаланушы',
                              })
                            }}
                            style={{
                              fontSize: 11,
                              color: '#DC2626',
                              background: '#FEF2F2',
                              border: 'none',
                              borderRadius: 7,
                              padding: '5px 12px',
                              cursor: currentUserId !== null && u.id === currentUserId ? 'not-allowed' : 'pointer',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              transition: 'all 150ms',
                              opacity: currentUserId !== null && u.id === currentUserId ? 0.45 : 1,
                            }}
                            onMouseEnter={e => {
                              if (currentUserId !== null && u.id === currentUserId) return
                              e.currentTarget.style.background = '#FEE2E2'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#FEF2F2'
                            }}
                          >
                            Өшіру
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Клиент қосу" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {userForm(createForm, setCreateForm, 'c')}
            {error && <div style={{ background: '#FFF5F5', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid rgba(153,27,27,0.12)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
                Болдырмау
              </button>
              <button type="submit" disabled={isPending}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)', opacity: isPending ? 0.75 : 1 }}>
                {isPending ? 'Қосылуда...' : 'Қосу'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateEditor && (
        <Modal title="Редактор қосу" onClose={() => setShowCreateEditor(false)}>
          <form onSubmit={handleCreateEditor} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {userForm(editorForm, setEditorForm, 'e')}
            {error && <div style={{ background: '#FFF5F5', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid rgba(153,27,27,0.12)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowCreateEditor(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
                Болдырмау
              </button>
              <button type="submit" disabled={isPending}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: '#7C3AED', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(124,58,237,0.3)', opacity: isPending ? 0.75 : 1 }}>
                {isPending ? 'Қосылуда...' : 'Редактор қосу'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showCreateManager && (
        <Modal title="Менеджер қосу" onClose={() => setShowCreateManager(false)}>
          <form onSubmit={handleCreateManager} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {userForm(managerForm, setManagerForm, 'm')}
            <div style={{ background: '#ECFEFF', border: '1px solid rgba(14,165,164,0.18)', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#0E7E7C', lineHeight: 1.55 }}>
              Менеджер клиент қосуға, кітап үлгісіне қолжеткізу беруге және алып тастауға, клиентті өшіруге құқылы.
            </div>
            {error && <div style={{ background: '#FFF5F5', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid rgba(153,27,27,0.12)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setShowCreateManager(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
                Болдырмау
              </button>
              <button type="submit" disabled={isPending}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: '#0EA5A4', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(14,165,164,0.32)', opacity: isPending ? 0.75 : 1 }}>
                {isPending ? 'Қосылуда...' : 'Менеджер қосу'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {passwordUser && (
        <Modal
          title="Парольді өзгерту"
          onClose={() => {
            if (!isPending) {
              setPasswordUser(null)
              setPasswordForm({ password: '', confirm: '' })
              setError(null)
            }
          }}
        >
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ fontSize: 13, color: '#4A3D3D', margin: 0, lineHeight: 1.55 }}>
              <strong style={{ color: '#1C1010' }}>{passwordUser.name}</strong> үшін жаңа құпия сөзді орнатыңыз.
              Ескі құпия сөз қажет емес.
            </p>
            <div>
              <label style={labelStyle}>Жаңа құпия сөз</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={PW_MIN_ADMIN}
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((f) => ({ ...f, password: e.target.value }))}
                onFocus={() => setFocusField('pw-new')}
                onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusStyleFor('pw-new') }}
              />
            </div>
            <div>
              <label style={labelStyle}>Қайталау</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={PW_MIN_ADMIN}
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                onFocus={() => setFocusField('pw-confirm')}
                onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusStyleFor('pw-confirm') }}
              />
            </div>
            {error && (
              <div style={{ background: '#FFF5F5', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid rgba(153,27,27,0.12)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setPasswordUser(null)
                  setPasswordForm({ password: '', confirm: '' })
                  setError(null)
                }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: isPending ? 'wait' : 'pointer', color: '#7A6060', fontWeight: 600 }}
              >
                Болдырмау
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: isPending ? 'wait' : 'pointer', opacity: isPending ? 0.75 : 1 }}
              >
                {isPending ? 'Сақталуда…' : 'Сақтау'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteUserConfirm && (
        <Modal
          title="Пайдаланушыны жою"
          onClose={() => {
            if (!isPending) setDeleteUserConfirm(null)
          }}
        >
          <p style={{ fontSize: 14, color: '#4A3D3D', margin: '0 0 8px', lineHeight: 1.55, fontWeight: 500 }}>
            <strong style={{ color: '#1C1010' }}>«{deleteUserConfirm.name}»</strong> пайдаланушысын жойғыңыз келетініне сенімдісіз бе?
          </p>
          <p style={{ fontSize: 12, color: '#B8A8A8', margin: '0 0 22px', lineHeight: 1.5 }}>
            Бұл әрекетті қайтару мүмкін емес: профиль, кіру және байланысты деректер жойылады.
          </p>
          {error && (
            <div
              style={{
                background: '#FFF5F5',
                color: '#991B1B',
                padding: '12px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid rgba(153,27,27,0.12)',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setError(null)
                setDeleteUserConfirm(null)
              }}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: '1.5px solid #EDE6E6',
                background: 'white',
                fontSize: 13,
                cursor: isPending ? 'wait' : 'pointer',
                color: '#7A6060',
                fontWeight: 600,
              }}
            >
              Болдырмау
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void executeDeleteUser()}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: '#DC2626',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: isPending ? 'wait' : 'pointer',
                opacity: isPending ? 0.75 : 1,
              }}
            >
              {isPending ? 'Жойылуда…' : 'Иә, жою'}
            </button>
          </div>
        </Modal>
      )}

      {deleteOrderConfirm && (
        <Modal
          title="Кітапты жою"
          onClose={() => {
            if (!isPending) setDeleteOrderConfirm(null)
          }}
        >
          <p style={{ fontSize: 14, color: '#4A3D3D', margin: '0 0 8px', lineHeight: 1.55, fontWeight: 500 }}>
            <strong style={{ color: '#1C1010' }}>«{deleteOrderConfirm.catName}»</strong> тапсырысын пайдаланушыдан алып тастағыңыз келетініне сенімдісіз бе?
          </p>
          <p style={{ fontSize: 12, color: '#B8A8A8', margin: '0 0 22px', lineHeight: 1.5 }}>
            Жауаптар мен фотолар қоса жойылуы мүмкін. Әрекетті қайтару қиын.
          </p>
          {error && (
            <div
              style={{
                background: '#FFF5F5',
                color: '#991B1B',
                padding: '12px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid rgba(153,27,27,0.12)',
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setError(null)
                setDeleteOrderConfirm(null)
              }}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: '1.5px solid #EDE6E6',
                background: 'white',
                fontSize: 13,
                cursor: isPending ? 'wait' : 'pointer',
                color: '#7A6060',
                fontWeight: 600,
              }}
            >
              Болдырмау
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void executeDeleteOrder()}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: 'none',
                background: '#DC2626',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: isPending ? 'wait' : 'pointer',
                opacity: isPending ? 0.75 : 1,
              }}
            >
              {isPending ? 'Жойылуда…' : 'Иә, жою'}
            </button>
          </div>
        </Modal>
      )}

      {giveAccessUser && (
        <Modal title={`Қолжеткізу — ${giveAccessUser.full_name || giveAccessUser.phone}`} onClose={() => setGiveAccessUser(null)}>
          <form onSubmit={handleGiveAccess} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Кітап үлгісі</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map(cat => {
                  const sel = accessCategoryId === cat.id
                  const alreadyHas = orders.some(o => o.client_id === giveAccessUser?.id && o.category_id === cat.id)
                  return (
                    <button key={cat.id} type="button"
                      onClick={() => !alreadyHas && setAccessCategoryId(sel ? '' : cat.id)}
                      style={{
                        padding: '8px 16px', borderRadius: 10, border: 'none',
                        background: sel ? W : alreadyHas ? '#FAF6F6' : '#F5F0F0',
                        color: sel ? 'white' : alreadyHas ? '#D4C4C4' : '#7A6060',
                        fontSize: 13, cursor: alreadyHas ? 'default' : 'pointer',
                        fontWeight: sel ? 700 : 500,
                        boxShadow: sel ? 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(82,29,29,0.25)' : 'none',
                        transition: 'all 200ms',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                      {cat.title_kk}
                      {alreadyHas && <span style={{ fontSize: 10, opacity: 0.5 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#B8A8A8', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
              Кітап атауы, автор және алушы — пайдаланушы өзі толтырады.
            </p>
            {error && <div style={{ background: '#FFF5F5', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid rgba(153,27,27,0.12)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setGiveAccessUser(null)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
                Болдырмау
              </button>
              <button type="submit" disabled={isPending || !accessCategoryId}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)', opacity: !accessCategoryId || isPending ? 0.5 : 1, transition: 'opacity 200ms' }}>
                {isPending ? 'Берілуде...' : 'Қолжеткізу беру'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
