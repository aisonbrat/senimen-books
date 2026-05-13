'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { IconPlus, IconX, IconPencil, IconTrash, IconQuotes, IconRows } from '@/components/ui/icons'

const W = '#731616'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #EDE6E6',
  background: 'white', fontSize: 13, boxSizing: 'border-box', outline: 'none',
  color: '#1C1010', fontFamily: 'inherit',
  transition: 'border-color 200ms cubic-bezier(0.4,0,0.2,1), box-shadow 200ms cubic-bezier(0.4,0,0.2,1)',
}

export default function TemplatesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [titleKk, setTitleKk] = useState('')
  const [descKk, setDescKk] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title_kk: '',
    description_kk: '',
    faktiler_enabled: false,
    faktiler_example_facts: '',
    pdf_colophon_template_kk: '',
  })
  const [focusField, setFocusField] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { fetchCategories() }, [])

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*, chapters(count)').order('sort_order')
    setCategories(data || [])
    setLoading(false)
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('categories').insert({ title_kk: titleKk, description_kk: descKk, sort_order: categories.length })
    setTitleKk(''); setDescKk(''); setShowForm(false); setSaving(false)
    fetchCategories()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await supabase
      .from('categories')
      .update({
        title_kk: editForm.title_kk,
        description_kk: editForm.description_kk,
        faktiler_enabled: editForm.faktiler_enabled,
        faktiler_example_facts: editForm.faktiler_example_facts.trim() || null,
        pdf_colophon_template_kk: editForm.pdf_colophon_template_kk.trim() || null,
      })
      .eq('id', id)
    setEditingId(null); setSaving(false)
    fetchCategories()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Санатты жойғыңыз келе ме?')) return
    await supabase.from('categories').delete().eq('id', id)
    fetchCategories()
  }

  const focusFor = (key: string) => focusField === key
    ? { borderColor: W, boxShadow: `0 0 0 3px rgba(82,29,29,0.08), 0 1px 4px rgba(82,29,29,0.1)` }
    : {}

  return (
    <div style={{ padding: '40px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C1010', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Кітап үлгілері</h1>
          <p style={{ fontSize: 13, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Санаттар мен сұрақтарды басқарыңыз</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: showForm ? '#F5EDEC' : W, color: showForm ? W : 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', boxShadow: showForm ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)' }}
          onMouseEnter={e => { if (!showForm) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(82,29,29,0.35)' } }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = showForm ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)' }}>
          {showForm ? (
            <>
              <IconX className="size-[15px] shrink-0" />
              Жабу
            </>
          ) : (
            <>
              <IconPlus className="size-[15px] shrink-0" />
              Жаңа санат
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 18, padding: '32px 32px', marginBottom: 20, boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1C1010', margin: '0 0 24px', letterSpacing: '-0.02em' }}>Жаңа санат</h3>
          <form onSubmit={createCategory} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Атауы</label>
              <input value={titleKk} onChange={e => setTitleKk(e.target.value)} required placeholder="Мысалы: Анаға арналған"
                onFocus={() => setFocusField('title')} onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusFor('title') }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Сипаттамасы</label>
              <input value={descKk} onChange={e => setDescKk(e.target.value)} placeholder="Қысқаша сипаттама"
                onFocus={() => setFocusField('desc')} onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusFor('desc') }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600, transition: 'all 150ms' }}>
                Болдырмау
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(82,29,29,0.25)', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Сақталуда...' : 'Сақтау'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 16, padding: '22px 28px', height: 72, opacity: 1 - i * 0.25, boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)' }}>
              <div style={{ width: `${36 - i * 4}%`, height: 14, background: '#F0EAEA', borderRadius: 6, marginBottom: 10 }} />
              <div style={{ width: `${20 - i * 3}%`, height: 10, background: '#F5F0F0', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 18, padding: '64px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 20px rgba(82,29,29,0.04)' }}>
          <p style={{ fontSize: 14, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Санаттар жоқ</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '18px 18px 16px',
                boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)',
                transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
                minHeight: 120,
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 2px 8px rgba(82,29,29,0.08), 0 8px 24px rgba(82,29,29,0.08)'
                el.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)'
                el.style.transform = 'translateY(0)'
              }}
            >
              {editingId === cat.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    value={editForm.title_kk}
                    onChange={(e) => setEditForm({ ...editForm, title_kk: e.target.value })}
                    onFocus={() => setFocusField(`edit_title_${cat.id}`)}
                    onBlur={() => setFocusField(null)}
                    style={{ ...inputStyle, ...focusFor(`edit_title_${cat.id}`) }}
                    placeholder="Атауы"
                  />
                  <input
                    value={editForm.description_kk}
                    onChange={(e) => setEditForm({ ...editForm, description_kk: e.target.value })}
                    onFocus={() => setFocusField(`edit_desc_${cat.id}`)}
                    onBlur={() => setFocusField(null)}
                    style={{ ...inputStyle, ...focusFor(`edit_desc_${cat.id}`) }}
                    placeholder="Сипаттамасы"
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#333' }}>
                    <input
                      type="checkbox"
                      checked={editForm.faktiler_enabled}
                      onChange={(e) => setEditForm({ ...editForm, faktiler_enabled: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: '#0F0F0F' }}
                    />
                    «Фактілер» бөлімі (кітапта тарау түрі арқылы орналасады)
                  </label>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Мысал фактілер (әр жол — бір мысал)
                    </label>
                    <textarea
                      value={editForm.faktiler_example_facts}
                      onChange={(e) => setEditForm({ ...editForm, faktiler_example_facts: e.target.value })}
                      rows={5}
                      placeholder={'Ол қанша жерден аш болса да, тамақтың ең тәтті бөлігін маған қалдырады\n...'}
                      style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      PDF соңғы бет (превьюде көрінбейді)
                    </label>
                    <p style={{ fontSize: 11, color: '#A89898', margin: '0 0 8px', lineHeight: 1.45 }}>
                      <code style={{ fontSize: 11 }}>{'{{author}}'}</code> — кітап авторы, <code style={{ fontSize: 11 }}>{'{{date}}'}</code> — күні (12.05.2026). Бос қалса, PDF-ке қосылмайды.
                    </p>
                    <textarea
                      value={editForm.pdf_colophon_template_kk}
                      onChange={(e) => setEditForm({ ...editForm, pdf_colophon_template_kk: e.target.value })}
                      rows={3}
                      placeholder="Бұл кітапты {{author}} {{date}} күні өзінің махаббатына арнап жазды."
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => saveEdit(cat.id)}
                      disabled={saving}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 9,
                        border: 'none',
                        background: W,
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 10px rgba(82,29,29,0.25)',
                      }}
                    >
                      {saving ? '...' : 'Сақтау'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 9,
                        border: '1.5px solid #EDE6E6',
                        background: 'white',
                        fontSize: 12,
                        cursor: 'pointer',
                        color: '#7A6060',
                        fontWeight: 600,
                      }}>
                      Болдырмау
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1010', marginBottom: 4, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                      {cat.title_kk}
                    </div>
                    {cat.description_kk && (
                      <div style={{ fontSize: 12, color: '#B8A8A8', fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>
                        {cat.description_kk}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#D4C4C4', fontWeight: 600 }}>
                      {cat.chapters?.[0]?.count ?? 0} тарау
                      {cat.faktiler_enabled ? (
                        <span style={{ marginLeft: 8, color: '#521D1D', fontWeight: 700 }}>· Фактілер қосулы</span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 6,
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: '1px solid #F5F0F0',
                    }}
                  >
                    <button
                      type="button"
                      title="Фразалар"
                      aria-label="Фразалар"
                      onClick={() => router.push(`/admin/templates/${cat.id}/phrases`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: 'none',
                        background: '#F5F0F0',
                        color: '#7A6060',
                        cursor: 'pointer',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#EDE6E6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#F5F0F0')}
                    >
                      <IconQuotes className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Өңдеу"
                      aria-label="Өңдеу"
                      onClick={() => {
                        setEditingId(cat.id)
                        setEditForm({
                          title_kk: cat.title_kk,
                          description_kk: cat.description_kk || '',
                          faktiler_enabled: !!cat.faktiler_enabled,
                          faktiler_example_facts: cat.faktiler_example_facts || '',
                          pdf_colophon_template_kk: cat.pdf_colophon_template_kk || '',
                        })
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: 'none',
                        background: '#F5F0F0',
                        color: '#7A6060',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#EDE6E6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#F5F0F0')}
                    >
                      <IconPencil className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Тараулар"
                      aria-label="Тараулар"
                      onClick={() => router.push(`/admin/templates/${cat.id}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: 'none',
                        background: '#F5EDEC',
                        color: W,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#EDE3E3')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#F5EDEC')}
                    >
                      <IconRows className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      title="Жою"
                      aria-label="Жою"
                      onClick={() => deleteCategory(cat.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        border: 'none',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#FEE2E2')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                    >
                      <IconTrash className="size-[18px]" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
