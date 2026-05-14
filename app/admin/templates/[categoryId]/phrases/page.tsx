'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

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

export default function PhrasesPage() {
  const [category, setCategory] = useState<any>(null)
  const [phrases, setPhrases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newPhrase, setNewPhrase] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [focusField, setFocusField] = useState<string | null>(null)
  const [jsonBulk, setJsonBulk] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const categoryId = params.categoryId as string
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: cat }, { data: ph }] = await Promise.all([
      supabase.from('categories').select('id, title_kk').eq('id', categoryId).single(),
      supabase.from('category_phrases').select('*').eq('category_id', categoryId).order('sort_order'),
    ])
    setCategory(cat)
    setPhrases(ph || [])
    setLoading(false)
  }

  async function addPhrase(e: React.FormEvent) {
    e.preventDefault()
    if (!newPhrase.trim()) return
    setSaving(true)
    await supabase.from('category_phrases').insert({
      category_id: categoryId, phrase_kk: newPhrase.trim(), sort_order: phrases.length,
    })
    setNewPhrase(''); setSaving(false)
    fetchData()
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    setSaving(true)
    await supabase.from('category_phrases').update({ phrase_kk: editText.trim() }).eq('id', id)
    setEditingId(null); setSaving(false)
    fetchData()
  }

  async function deletePhrase(id: string) {
    await supabase.from('category_phrases').delete().eq('id', id)
    fetchData()
  }

  async function importFromJson() {
    setJsonError(null)
    let lines: string[] = []
    try {
      const parsed = JSON.parse(jsonBulk) as unknown
      if (!Array.isArray(parsed)) {
        setJsonError('JSON массив болуы керек, мысалы: ["фраза 1", "фраза 2"]')
        return
      }
      lines = parsed.map((x) => String(x).trim()).filter(Boolean)
    } catch {
      setJsonError('JSON оқылмады. Тырнақшаларды тексеріңіз.')
      return
    }
    if (lines.length === 0) {
      setJsonError('Бос массив')
      return
    }
    setSaving(true)
    const start = phrases.length
    const rows = lines.map((phrase_kk, i) => ({
      category_id: categoryId,
      phrase_kk,
      sort_order: start + i,
    }))
    const { error } = await supabase.from('category_phrases').insert(rows)
    setSaving(false)
    if (error) {
      setJsonError(error.message || 'Қосу сәтсіз')
      return
    }
    setJsonBulk('')
    fetchData()
  }

  const focusFor = (key: string) => focusField === key
    ? { borderColor: W, boxShadow: `0 0 0 3px rgba(82,29,29,0.08), 0 1px 4px rgba(82,29,29,0.1)` }
    : {}

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
        <span style={{ color: '#1C1010', fontSize: 13, fontWeight: 600 }}>Фразалар</span>
      </div>

      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C1010', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Фото мәтін фразалары</h1>
        <p style={{ fontSize: 13, color: '#B8A8A8', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
          «{category?.title_kk}» үлгісіндегі кітаптарда фото үстіне мәтін жазғанда ұсынылады
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: '28px 32px', marginBottom: 20, boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>JSON көлемімен қосу</label>
        <p style={{ fontSize: 12, color: '#B8A8A8', margin: '0 0 10px', lineHeight: 1.5 }}>
          Мысалы: <code style={{ fontSize: 11, background: '#F5F0F0', padding: '2px 6px', borderRadius: 4 }}>[&quot;Сөз 1&quot;, &quot;Сөз 2&quot;]</code>
        </p>
        <textarea
          value={jsonBulk}
          onChange={(e) => setJsonBulk(e.target.value)}
          placeholder='["фраза...", "..."]'
          rows={4}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 10 }}
        />
        {jsonError ? <p style={{ color: '#DC2626', fontSize: 12, margin: '0 0 8px', fontWeight: 600 }}>{jsonError}</p> : null}
        <button
          type="button"
          disabled={saving || !jsonBulk.trim()}
          onClick={() => void importFromJson()}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !jsonBulk.trim() ? 0.45 : 1 }}
        >
          {saving ? '…' : 'JSON импорттау'}
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: '28px 32px', marginBottom: 20, boxShadow: '0 2px 12px rgba(82,29,29,0.06), 0 1px 4px rgba(82,29,29,0.04)' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A6060', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Жаңа фраза қосу</label>
        <form onSubmit={addPhrase} style={{ display: 'flex', gap: 10 }}>
          <input value={newPhrase} onChange={e => setNewPhrase(e.target.value)}
            placeholder="Мысалы: Сені сүйемін"
            onFocus={() => setFocusField('new')} onBlur={() => setFocusField(null)}
            style={{ ...inputStyle, flex: 1, ...focusFor('new') }} />
          <button type="submit" disabled={saving || !newPhrase.trim()}
            style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: W, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(82,29,29,0.25)', opacity: !newPhrase.trim() ? 0.5 : 1, transition: 'opacity 200ms' }}>
            {saving ? '...' : '+ Қосу'}
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: 'white', borderRadius: 14, padding: '16px 24px', height: 52, opacity: 1 - i * 0.25, boxShadow: '0 1px 4px rgba(82,29,29,0.05)' }}>
              <div style={{ width: `${50 - i * 8}%`, height: 13, background: '#F0EAEA', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : phrases.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 18, padding: '56px 40px', textAlign: 'center', boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 4px 20px rgba(82,29,29,0.04)' }}>
          <p style={{ fontSize: 14, color: '#B8A8A8', margin: '0 0 6px', fontWeight: 500 }}>Фразалар жоқ</p>
          <p style={{ fontSize: 12, color: '#D4C4C4', margin: 0 }}>Жоғарыдан фраза қосыңыз</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {phrases.map((p, i) => (
            <div key={p.id} style={{ background: 'white', borderRadius: 14, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(82,29,29,0.05), 0 2px 8px rgba(82,29,29,0.03)', transition: 'all 200ms' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 2px 8px rgba(82,29,29,0.08), 0 4px 16px rgba(82,29,29,0.06)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 1px 4px rgba(82,29,29,0.05), 0 2px 8px rgba(82,29,29,0.03)' }}>
              <span style={{ fontSize: 11, color: '#D4C4C4', minWidth: 22, fontWeight: 700 }}>{i + 1}</span>
              {editingId === p.id ? (
                <>
                  <input value={editText} onChange={e => setEditText(e.target.value)}
                    onFocus={() => setFocusField(`edit_${p.id}`)} onBlur={() => setFocusField(null)}
                    style={{ ...inputStyle, flex: 1, ...focusFor(`edit_${p.id}`) }} autoFocus />
                  <button onClick={() => saveEdit(p.id)} disabled={saving}
                    style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: W, color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 10px rgba(82,29,29,0.25)' }}>
                    {saving ? '...' : 'Сақтау'}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #EDE6E6', background: 'white', fontSize: 12, cursor: 'pointer', color: '#7A6060', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Болдырмау
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14, color: '#1C1010', fontFamily: "'Cormorant', Georgia, serif", fontWeight: 500 }}>{p.phrase_kk}</span>
                  <button onClick={() => { setEditingId(p.id); setEditText(p.phrase_kk) }}
                    style={{ fontSize: 12, color: '#7A6060', background: '#F5F0F0', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#EDE6E6')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F5F0F0')}>
                    Өңдеу
                  </button>
                  <button onClick={() => deletePhrase(p.id)}
                    style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, transition: 'all 150ms' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FEF2F2')}>
                    Жою
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: '16px 20px', background: '#FFFBEB', borderRadius: 12, border: '1px solid rgba(217,119,6,0.2)' }}>
        <p style={{ fontSize: 12, color: '#92400E', margin: '0 0 8px', fontWeight: 600 }}>Дерекқор миграциясы</p>
        <code style={{ display: 'block', fontSize: 11, color: '#78350F', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.7 }}>
          {`CREATE TABLE IF NOT EXISTS category_phrases (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,\n  phrase_kk TEXT NOT NULL,\n  sort_order INT NOT NULL DEFAULT 0,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`}
        </code>
      </div>
    </div>
  )
}
