'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { IconPlus, IconX } from '@/components/ui/icons'
import { normalizeQuestionFromJson } from '@/lib/admin/templateJsonImport'

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

export default function QuestionsPage() {
  const [chapter, setChapter] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState({ question_kk: '', hint_kk: '', is_required: false })
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ question_kk: '', hint_kk: '', is_required: false })
  const [focusField, setFocusField] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const { categoryId, chapterId } = params as { categoryId: string; chapterId: string }
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: chap }, { data: cat }, { data: qs }] = await Promise.all([
      supabase.from('chapters').select('*').eq('id', chapterId).single(),
      supabase.from('categories').select('*').eq('id', categoryId).single(),
      supabase.from('questions').select('*').eq('chapter_id', chapterId).order('sort_order'),
    ])
    setChapter(chap); setCategory(cat); setQuestions(qs || [])
    setLoading(false)
  }

  async function createQuestion(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('questions').insert({
      chapter_id: chapterId, question_kk: form.question_kk,
      hint_kk: form.hint_kk, question_type: 'textarea',
      is_required: form.is_required, sort_order: questions.length,
    })
    setForm({ question_kk: '', hint_kk: '', is_required: false })
    setShowForm(false); setSaving(false)
    fetchData()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await supabase.from('questions').update({
      question_kk: editForm.question_kk,
      hint_kk: editForm.hint_kk || null,
      is_required: editForm.is_required,
    }).eq('id', id)
    setEditingId(null); setSaving(false)
    fetchData()
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Сұрақты жойғыңыз келе ме?')) return
    await supabase.from('questions').delete().eq('id', id)
    fetchData()
  }

  async function importQuestions(e: React.FormEvent) {
    e.preventDefault()
    setImportError(null)
    let parsed: unknown
    try {
      const trimmed = importText.trim().replace(/^\uFEFF/, '')
      parsed = JSON.parse(trimmed)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'JSON қатесі')
      return
    }
    if (!Array.isArray(parsed)) {
      setImportError('JSON массив болуы керек')
      return
    }

    const normalized = parsed
      .map((item: unknown) => normalizeQuestionFromJson(item, chapterId))
      .filter(Boolean) as Array<{
      chapter_id: string
      question_kk: string
      hint_kk: string | null
      question_type: string
      is_required: boolean
      max_chars?: number | null
    }>

    if (normalized.length === 0) {
      setImportError('Жарамды сұрақтар табылмады')
      return
    }

    const maxSort = questions.reduce(
      (m, q) => Math.max(m, typeof q.sort_order === 'number' ? q.sort_order : 0),
      -1
    )
    const rows = normalized.map((r, idx) => ({
      ...r,
      sort_order: maxSort + 1 + idx,
    }))

    setSaving(true)
    const { error } = await supabase.from('questions').insert(rows)
    if (error) {
      setImportError(error.message)
      setSaving(false)
      return
    }
    setImportText('')
    setShowImport(false)
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
          <div key={i} style={{ background: 'white', borderRadius: 14, padding: '20px 24px', height: 64, opacity: 1 - i * 0.25, boxShadow: '0 1px 4px rgba(82,29,29,0.05)' }}>
            <div style={{ width: `${50 - i * 6}%`, height: 13, background: '#F0EAEA', borderRadius: 6, marginBottom: 8 }} />
            <div style={{ width: `${28 - i * 4}%`, height: 10, background: '#F5F0F0', borderRadius: 6 }} />
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
        <button onClick={() => router.push(`/admin/templates/${categoryId}`)}
          style={{ background: 'none', border: 'none', color: '#B8A8A8', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, transition: 'color 150ms' }}
          onMouseEnter={e => (e.currentTarget.style.color = W)}
          onMouseLeave={e => (e.currentTarget.style.color = '#B8A8A8')}>
          {category?.title_kk}
        </button>
        <span style={{ color: '#D4C4C4', fontSize: 13 }}>/</span>
        <span style={{ color: '#1C1010', fontSize: 13, fontWeight: 600 }}>{chapter?.title_kk}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C1010', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{chapter?.title_kk}</h1>
          <p style={{ fontSize: 13, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>{questions.length} сұрақ</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setShowImport(!showImport); setShowForm(false) }}
            style={{ background: showImport ? '#F5EDEC' : 'white', color: showImport ? W : '#7A6060', border: '1.5px solid #EDE6E6', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', boxShadow: '0 1px 4px rgba(82,29,29,0.06)' }}>
            JSON жүктеу
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowImport(false) }}
            style={{ background: showForm ? '#F5EDEC' : W, color: showForm ? W : 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)', boxShadow: showForm ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)' }}
            onMouseEnter={e => { if (!showForm) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(82,29,29,0.35)' } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = showForm ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(82,29,29,0.3)' }}>
            {showForm ? (
              <>
                <IconX className="mr-1.5 inline size-3.5 align-[-2px]" />
                Жабу
              </>
            ) : (
              <>
                <IconPlus className="mr-1.5 inline size-3.5 align-[-2px]" />
                Жаңа сұрақ
              </>
            )}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: 18, padding: '28px 32px', marginBottom: 20, boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1010', margin: '0 0 22px', letterSpacing: '-0.02em' }}>Жаңа сұрақ</h3>
          <form onSubmit={createQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Сұрақ мәтіні</label>
              <input value={form.question_kk} onChange={e => setForm({ ...form, question_kk: e.target.value })} required
                placeholder="Мысалы: Балалық шағыңыз туралы айтыңыз"
                onFocus={() => setFocusField('q')} onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusFor('q') }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Көмек мәтіні</label>
              <input value={form.hint_kk} onChange={e => setForm({ ...form, hint_kk: e.target.value })}
                placeholder="Мысалы: Ең жақсы естеліктеріңізді жазыңыз..."
                onFocus={() => setFocusField('hint')} onBlur={() => setFocusField(null)}
                style={{ ...inputStyle, ...focusFor('hint') }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: W, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: '#7A6060', fontWeight: 500 }}>Міндетті сұрақ</span>
            </label>
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

      {showImport && (
        <div style={{ background: 'white', borderRadius: 18, padding: '28px 32px', marginBottom: 20, boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1010', margin: '0 0 8px', letterSpacing: '-0.02em' }}>JSON-дан импорттау</h3>
          <p style={{ fontSize: 12, color: '#B8A8A8', margin: '0 0 16px', fontWeight: 500 }}>
            Формат: <code style={{ background: '#F5F0F0', padding: '2px 6px', borderRadius: 5, fontSize: 11, color: W }}>{'[{"question_kk":"...","hint_kk":"...","is_required":false}]'}</code>
          </p>
          <form onSubmit={importQuestions} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} required rows={6}
              placeholder={'[\n  {"question_kk": "Сұрақ мәтіні", "hint_kk": "Ескерту", "is_required": false}\n]'}
              onFocus={() => setFocusField('import')} onBlur={() => setFocusField(null)}
              style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical', minHeight: 140, ...focusFor('import') }} />
            {importError && <div style={{ background: '#FFF5F5', color: '#991B1B', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: '1px solid rgba(153,27,27,0.12)' }}>{importError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setShowImport(false); setImportError(null) }}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 13, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
                Болдырмау
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(82,29,29,0.25)', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Импорттауда...' : 'Импорттау'}
              </button>
            </div>
          </form>
        </div>
      )}

      {questions.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 18, padding: '64px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 20px rgba(82,29,29,0.04)' }}>
          <p style={{ fontSize: 14, color: '#B8A8A8', margin: 0, fontWeight: 500 }}>Сұрақтар жоқ</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{ background: 'white', borderRadius: 14, padding: '18px 24px', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 2px 8px rgba(82,29,29,0.03)', transition: 'all 200ms' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 2px 8px rgba(82,29,29,0.08), 0 6px 20px rgba(82,29,29,0.06)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 4px rgba(82,29,29,0.05), 0 2px 8px rgba(82,29,29,0.03)' }}>
              {editingId === q.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input value={editForm.question_kk} onChange={e => setEditForm({ ...editForm, question_kk: e.target.value })}
                    onFocus={() => setFocusField(`eq_${q.id}`)} onBlur={() => setFocusField(null)}
                    style={{ ...inputStyle, ...focusFor(`eq_${q.id}`) }} placeholder="Сұрақ мәтіні" />
                  <input value={editForm.hint_kk} onChange={e => setEditForm({ ...editForm, hint_kk: e.target.value })}
                    onFocus={() => setFocusField(`eh_${q.id}`)} onBlur={() => setFocusField(null)}
                    style={{ ...inputStyle, ...focusFor(`eh_${q.id}`) }} placeholder="Көмек мәтіні" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={editForm.is_required} onChange={e => setEditForm({ ...editForm, is_required: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: W, cursor: 'pointer' }} />
                    <span style={{ fontSize: 13, color: '#7A6060', fontWeight: 500 }}>Міндетті</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveEdit(q.id)} disabled={saving}
                      style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: W, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 10px rgba(82,29,29,0.25)' }}>
                      {saving ? '...' : 'Сақтау'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 12, cursor: 'pointer', color: '#7A6060', fontWeight: 600 }}>
                      Болдырмау
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                    <span style={{ fontSize: 11, color: '#D4C4C4', fontWeight: 700, minWidth: 22, marginTop: 2 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1010', marginBottom: 6, letterSpacing: '-0.01em' }}>{q.question_kk}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {q.is_required && <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF2F2', color: '#DC2626', borderRadius: 5, padding: '2px 8px' }}>МІНДЕТТІ</span>}
                        {q.hint_kk && <span style={{ fontSize: 12, color: '#B8A8A8', fontWeight: 500 }}>— {q.hint_kk}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => { setEditingId(q.id); setEditForm({ question_kk: q.question_kk, hint_kk: q.hint_kk || '', is_required: q.is_required }) }}
                      style={{ fontSize: 12, color: '#7A6060', background: '#F5F0F0', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, transition: 'all 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#EDE6E6')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#F5F0F0')}>
                      Өңдеу
                    </button>
                    <button onClick={() => deleteQuestion(q.id)}
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
