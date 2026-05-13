'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { IconPlus, IconX } from '@/components/ui/icons'

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

export default function ChaptersPage() {
  const [category, setCategory] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [titleKk, setTitleKk] = useState('')
  const [newPartKind, setNewPartKind] = useState<'standard' | 'faktiler'>('standard')
  const [newFixedPhraseId, setNewFixedPhraseId] = useState('')
  const [categoryPhrases, setCategoryPhrases] = useState<Array<{ id: string; phrase_kk: string }>>([])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [focusField, setFocusField] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const categoryId = params.categoryId as string
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: cat }, { data: chaps }, { data: ph }] = await Promise.all([
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('chapters').select('*, questions(count)').eq('category_id', categoryId).order('sort_order'),
      supabase.from('category_phrases').select('id, phrase_kk, sort_order').eq('category_id', categoryId).order('sort_order'),
    ])
    setCategory(cat)
    setChapters(chaps || [])
    setCategoryPhrases((ph || []).map((p: { id: string; phrase_kk: string }) => ({ id: p.id, phrase_kk: p.phrase_kk })))
    setLoading(false)
  }

  async function createChapter(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('chapters').insert({
      category_id: categoryId,
      title_kk: titleKk,
      sort_order: chapters.length,
      part_kind: newPartKind,
      fixed_phrase_id:
        newPartKind === 'standard' && newFixedPhraseId ? newFixedPhraseId : null,
    })
    setTitleKk('')
    setNewPartKind('standard')
    setNewFixedPhraseId('')
    setShowForm(false)
    setSaving(false)
    fetchData()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await supabase.from('chapters').update({ title_kk: editTitle }).eq('id', id)
    setEditingId(null); setSaving(false)
    fetchData()
  }

  async function deleteChapter(id: string) {
    if (!confirm('Тарауды жойғыңыз келе ме?')) return
    await supabase.from('chapters').delete().eq('id', id)
    fetchData()
  }

  async function setChapterFixedPhrase(chapterId: string, phraseId: string) {
    setSaving(true)
    await supabase
      .from('chapters')
      .update({ fixed_phrase_id: phraseId || null })
      .eq('id', chapterId)
    setSaving(false)
    fetchData()
  }

  async function addDefaultChapters() {
    setSaving(true)
    await supabase.from('chapters').insert([
      { category_id: categoryId, title_kk: 'Алғы сөз', sort_order: 0, is_foreword: true },
      { category_id: categoryId, title_kk: 'Соңғы сөз', sort_order: 999, is_afterword: true },
    ])
    setSaving(false)
    fetchData()
  }

  const focusFor = (key: string) => focusField === key
    ? { borderColor: W, boxShadow: `0 0 0 3px rgba(82,29,29,0.08), 0 1px 4px rgba(82,29,29,0.1)` }
    : {}

  if (loading) return (
    <div style={{ padding: '40px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: 'white', borderRadius: 14, padding: '20px 24px', height: 64, opacity: 1 - i * 0.25, boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)' }}>
            <div style={{ width: `${36 - i * 4}%`, height: 13, background: '#F0EAEA', borderRadius: 6, marginBottom: 8 }} />
            <div style={{ width: `${18 - i * 2}%`, height: 10, background: '#F5F0F0', borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ padding: '40px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <button onClick={() => router.push('/admin/templates')}
          style={{ background: 'none', border: 'none', color: '#B8A8A8', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, transition: 'color 150ms' }}
          onMouseEnter={e => (e.currentTarget.style.color = W)}
          onMouseLeave={e => (e.currentTarget.style.color = '#B8A8A8')}>
          Үлгілер
        </button>
        <span style={{ color: '#D4C4C4', fontSize: 13 }}>/</span>
        <span style={{ color: '#1C1010', fontSize: 13, fontWeight: 600 }}>{category?.title_kk}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C1010', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{category?.title_kk}</h1>
          <p style={{ fontSize: 13, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Тараулар мен сұрақтарды басқарыңыз</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {chapters.length === 0 && (
            <button onClick={addDefaultChapters} disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', color: '#7A6060', border: '1.5px solid #EDE6E6', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', boxShadow: '0 1px 4px rgba(82,29,29,0.06)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9F6F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              <IconPlus className="size-[14px] shrink-0" />
              Алғы/Соңғы сөз
            </button>
          )}
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
                Жаңа тарау
              </>
            )}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 18, padding: '28px 32px', marginBottom: 20, boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1010', margin: '0 0 20px', letterSpacing: '-0.02em' }}>Жаңа тарау</h3>
          <form onSubmit={createChapter} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Тарау атауы</label>
              <input value={titleKk} onChange={e => setTitleKk(e.target.value)} required placeholder="Мысалы: Балалық шақ"
                onFocus={() => setFocusField('title')} onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusFor('title') }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Тарау түрі</label>
              <select
                value={newPartKind}
                onChange={(e) => setNewPartKind(e.target.value as 'standard' | 'faktiler')}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="standard">Стандарт тарау (сұрақтар)</option>
                <option value="faktiler">Фактілер (бөлініс + мәтін + фото беттері)</option>
              </select>
              <p style={{ fontSize: 11, color: '#B8A8A8', margin: '8px 0 0', lineHeight: 1.45 }}>
                Үлгіде «Фактілер» тарауы болғанда, ол клиент редакторында барлық стандарт тараулардан кейін, «Хат» алдында көрінеді. Бір үлгіде бір «Фактілер» тарауы жеткілікті.
              </p>
            </div>
            {newPartKind === 'standard' && categoryPhrases.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Тұрақты бет фразасы (қосымша)
                </label>
                <select
                  value={newFixedPhraseId}
                  onChange={(e) => setNewFixedPhraseId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">— Таңдамау —</option>
                  {categoryPhrases
                    .filter(
                      (p) =>
                        !chapters.some((c: any) => c.fixed_phrase_id === p.id) || p.id === newFixedPhraseId
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.phrase_kk.length > 80 ? `${p.phrase_kk.slice(0, 80)}…` : p.phrase_kk}
                      </option>
                    ))}
                </select>
                <p style={{ fontSize: 11, color: '#B8A8A8', margin: '8px 0 0', lineHeight: 1.45 }}>
                  Таңдалса, осы тараудың атау бетінен кейін 60/40 фото+түсті блок беті қосылады. Бір фраза бір тарауда ғана.
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
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

      {chapters.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 18, padding: '64px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 20px rgba(82,29,29,0.04)' }}>
          <p style={{ fontSize: 14, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Тараулар жоқ</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chapters.map(chapter => (
            <div key={chapter.id} style={{ background: 'white', borderRadius: 16, padding: '20px 28px', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 2px 8px rgba(82,29,29,0.08), 0 8px 24px rgba(82,29,29,0.08)'; el.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 4px rgba(82,29,29,0.05), 0 4px 16px rgba(82,29,29,0.04)'; el.style.transform = 'translateY(0)' }}>
              {editingId === chapter.id ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onFocus={() => setFocusField(`edit_${chapter.id}`)} onBlur={() => setFocusField(null)}
                    style={{ ...inputStyle, flex: 1, ...focusFor(`edit_${chapter.id}`) }} />
                  <button onClick={() => saveEdit(chapter.id)} disabled={saving}
                    style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: W, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 10px rgba(82,29,29,0.25)' }}>
                    {saving ? '...' : 'Сақтау'}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    style={{ padding: '9px 16px', borderRadius: 9, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 12, cursor: 'pointer', color: '#7A6060', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Болдырмау
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {chapter.is_foreword && <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', borderRadius: 6, padding: '3px 9px', letterSpacing: '0.02em' }}>АЛҒЫ СӨЗ</span>}
                    {chapter.is_afterword && <span style={{ fontSize: 10, fontWeight: 700, background: '#F0FDF4', color: '#16A34A', borderRadius: 6, padding: '3px 9px', letterSpacing: '0.02em' }}>СОҢҒЫ СӨЗ</span>}
                    {chapter.part_kind === 'faktiler' && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#FDF2F2', color: '#521D1D', borderRadius: 6, padding: '3px 9px', letterSpacing: '0.06em' }}>ФАКТІЛЕР</span>
                    )}
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1010', letterSpacing: '-0.01em' }}>{chapter.title_kk}</span>
                      {chapter.part_kind === 'faktiler' ? (
                        <span style={{ fontSize: 11, color: '#D4C4C4', marginLeft: 10, fontWeight: 600 }}>сұрақсыз блок</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#D4C4C4', marginLeft: 10, fontWeight: 600 }}>{chapter.questions?.[0]?.count ?? 0} сұрақ</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => { setEditingId(chapter.id); setEditTitle(chapter.title_kk) }}
                      style={{ fontSize: 12, color: '#7A6060', background: '#F5F0F0', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, transition: 'all 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#EDE6E6')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#F5F0F0')}>
                      Өңдеу
                    </button>
                    {chapter.part_kind !== 'faktiler' && categoryPhrases.length > 0 ? (
                      <select
                        value={(chapter as { fixed_phrase_id?: string }).fixed_phrase_id || ''}
                        onChange={(e) => void setChapterFixedPhrase(chapter.id, e.target.value)}
                        disabled={saving}
                        style={{
                          maxWidth: 200,
                          fontSize: 11,
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: '1.5px solid #EDE6E6',
                          background: 'white',
                          color: '#1C1010',
                          cursor: saving ? 'wait' : 'pointer',
                        }}
                        title="Тұрақты бет фразасы"
                      >
                        <option value="">Тұрақты фраза жоқ</option>
                        {categoryPhrases
                          .filter(
                            (p) =>
                              !chapters.some(
                                (c: any) => c.id !== chapter.id && c.fixed_phrase_id === p.id
                              ) || p.id === (chapter as { fixed_phrase_id?: string }).fixed_phrase_id
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.phrase_kk.length > 48 ? `${p.phrase_kk.slice(0, 48)}…` : p.phrase_kk}
                            </option>
                          ))}
                      </select>
                    ) : null}
                    {chapter.part_kind !== 'faktiler' ? (
                      <button onClick={() => router.push(`/admin/templates/${categoryId}/${chapter.id}`)}
                        style={{ fontSize: 12, color: W, background: '#F5EDEC', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, transition: 'all 150ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EDE3E3')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#F5EDEC')}>
                        Сұрақтар →
                      </button>
                    ) : null}
                    <button onClick={() => deleteChapter(chapter.id)}
                      style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, transition: 'all 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#FEF2F2')}>
                      Жою
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
