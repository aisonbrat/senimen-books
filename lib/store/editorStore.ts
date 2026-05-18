import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { Chapter, CustomPage, Order, Answers, FaktilerFactSlot } from '@/lib/types'
import { newFaktilerFactId } from '@/lib/utils/faktilerFacts'
import { normalizeGlobalFontPreset, normalizeSectionFontPreset, type AnswerFontPreset, type AnswerTextAlign } from '@/lib/bookLayout'

interface EditorState {
  // Data
  order: Order | null
  chapters: Chapter[]
  answers: Answers
  savedAnswers: Answers
  customPages: CustomPage[]
  algy_soz: string
  hat_text: string
  faktiler_facts: FaktilerFactSlot[]
  /** From category row (examples / optional product flag). */
  faktiler_category_enabled: boolean
  faktiler_example_facts: string
  answerFontPreset: AnswerFontPreset
  answerTextAlign: AnswerTextAlign
  /** null = inherit global answer_font_preset for that section */
  algyFontPresetOverride: AnswerFontPreset | null
  hatFontPresetOverride: AnswerFontPreset | null
  /** User photos for fixed chapter pages (chapterId → public/storage URL). */
  chapterFixedPhotos: Record<string, string>

  // UI State
  activeChapterId: string | null
  spreadIndex: number
  saving: boolean
  lastSaved: Date | null
  loading: boolean

  // Actions — Data
  setOrder: (order: Order) => void
  setChapters: (chapters: Chapter[]) => void
  setCustomPages: (pages: CustomPage[]) => void
  setAnswer: (questionId: string, value: string) => void
  setSavedAnswers: (answers: Answers) => void
  updateCustomPage: (id: string, patch: Partial<CustomPage>) => void
  addCustomPage: (page: CustomPage) => void
  removeCustomPage: (id: string) => void
  setAlgySoz: (v: string) => void
  setHatText: (v: string) => void
  setFaktilerFacts: (facts: FaktilerFactSlot[]) => void
  updateFaktilerFact: (index: number, patch: Partial<Pick<FaktilerFactSlot, 'text' | 'photo_path'>>) => void
  setFaktilerPhotoAt: (index: number, photoPath: string) => void
  addFaktilerFactSlot: () => void
  removeFaktilerFactAt: (index: number) => void
  /** Atomically updates book typography (mirrored to orders row on save). */
  setAnswerTypography: (patch: Partial<{ preset: AnswerFontPreset; align: AnswerTextAlign }>) => void
  setSectionFontPresetOverride: (section: 'algy' | 'hat', preset: AnswerFontPreset | null) => void
  setChapterFixedPhotoPath: (chapterId: string, photoPath: string | null) => void

  /** Clears editor slices before loading another order (avoids stale answers leaking across navigations). */
  clearEditorSessionForNewOrder: () => void

  /** Single atomic apply after a successful fetch — avoids many `setAnswer` updates and duplicate autosave triggers. */
  hydrateEditorSession: (payload: {
    order: Order
    chapters: Chapter[]
    answers: Answers
    customPages: CustomPage[]
    algy_soz: string
    hat_text: string
    faktiler_facts: FaktilerFactSlot[]
    faktiler_category_enabled?: boolean
    faktiler_example_facts?: string
    activeChapterId: string | null
    answerFontPreset?: AnswerFontPreset
    answerTextAlign?: AnswerTextAlign
    algyFontPresetOverride?: AnswerFontPreset | null
    hatFontPresetOverride?: AnswerFontPreset | null
    chapterFixedPhotos?: Record<string, string>
  }) => void

  // Actions — UI
  setActiveChapter: (id: string) => void
  setSpreadIndex: (index: number) => void
  setSaving: (saving: boolean) => void
  setLastSaved: (date: Date) => void
  setLoading: (loading: boolean) => void

  // Derived helpers
  getUnsavedPairs: () => Array<[string, string]>
  getAllQuestionsFlat: () => import('@/lib/types').Question[]
  getAllPages: () => import('@/lib/types').BookPage[]
}

export const useEditorStore = create<EditorState>()(
  devtools(
    (set, get) => ({
      order: null,
      chapters: [],
      answers: {},
      savedAnswers: {},
      customPages: [],
      algy_soz: '',
      hat_text: '',
      faktiler_facts: [],
      faktiler_category_enabled: false,
      faktiler_example_facts: '',
      answerFontPreset: '18',
      answerTextAlign: 'left',
      algyFontPresetOverride: null,
      hatFontPresetOverride: null,
      chapterFixedPhotos: {},
      activeChapterId: null,
      spreadIndex: 0,
      saving: false,
      lastSaved: null,
      loading: true,

      setOrder: (order) => set({ order }),
      setChapters: (chapters) => set({ chapters }),
      setCustomPages: (pages) => set({ customPages: pages }),
      setSavedAnswers: (savedAnswers) => set({ savedAnswers }),
      setLoading: (loading) => set({ loading }),
      setSaving: (saving) => set({ saving }),
      setLastSaved: (date) => set({ lastSaved: date }),
      setActiveChapter: (id) => set({ activeChapterId: id }),
      setSpreadIndex: (index) => set({ spreadIndex: index }),

      setAnswer: (questionId, value) =>
        set((state) => ({
          answers: { ...state.answers, [questionId]: value },
        })),

      updateCustomPage: (id, patch) =>
        set((state) => ({
          customPages: state.customPages.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),

      addCustomPage: (page) =>
        set((state) => ({
          customPages: [...state.customPages, page],
        })),

      removeCustomPage: (id) =>
        set((state) => ({
          customPages: state.customPages.filter((p) => p.id !== id),
        })),

      setAlgySoz: (v) => set({ algy_soz: v }),
      setHatText: (v) => set({ hat_text: v }),
      setFaktilerFacts: (facts) => set({ faktiler_facts: facts }),
      updateFaktilerFact: (index, patch) =>
        set((state) => ({
          faktiler_facts: state.faktiler_facts.map((row, i) =>
            i === index ? { ...row, ...patch } : row
          ),
        })),
      setFaktilerPhotoAt: (index, photoPath) =>
        set((state) => ({
          faktiler_facts: state.faktiler_facts.map((row, i) =>
            i === index ? { ...row, photo_path: photoPath } : row
          ),
        })),
      addFaktilerFactSlot: () =>
        set((state) => ({
          faktiler_facts: [
            ...state.faktiler_facts,
            { id: newFaktilerFactId(), text: '', photo_path: '' },
          ],
        })),
      removeFaktilerFactAt: (index) =>
        set((state) => {
          const rows = state.faktiler_facts
          if (rows.length <= 1) {
            return {
              faktiler_facts: [{ id: newFaktilerFactId(), text: '', photo_path: '' }],
            }
          }
          return { faktiler_facts: rows.filter((_, i) => i !== index) }
        }),

      setAnswerTypography: (patch) =>
        set((state) => ({
          answerFontPreset:
            patch.preset !== undefined ? normalizeGlobalFontPreset(patch.preset) : state.answerFontPreset,
          answerTextAlign: patch.align ?? state.answerTextAlign,
        })),

      setSectionFontPresetOverride: (section, preset) =>
        set(
          section === 'algy'
            ? {
                algyFontPresetOverride:
                  preset === null ? null : normalizeSectionFontPreset(preset) ?? null,
              }
            : {
                hatFontPresetOverride:
                  preset === null ? null : normalizeSectionFontPreset(preset) ?? null,
              }
        ),

      setChapterFixedPhotoPath: (chapterId, photoPath) =>
        set((state) => {
          const next = { ...state.chapterFixedPhotos }
          if (photoPath && photoPath.trim()) next[chapterId] = photoPath.trim()
          else delete next[chapterId]
          return { chapterFixedPhotos: next }
        }),

      clearEditorSessionForNewOrder: () =>
        set({
          order: null,
          chapters: [],
          answers: {},
          savedAnswers: {},
          customPages: [],
          algy_soz: '',
          hat_text: '',
          faktiler_facts: [],
          faktiler_category_enabled: false,
          faktiler_example_facts: '',
          answerFontPreset: '18',
          answerTextAlign: 'left',
          algyFontPresetOverride: null,
          hatFontPresetOverride: null,
          chapterFixedPhotos: {},
          activeChapterId: null,
          spreadIndex: 0,
        }),

      hydrateEditorSession: (payload) =>
        set({
          order: payload.order,
          chapters: payload.chapters,
          answers: payload.answers,
          savedAnswers: { ...payload.answers },
          customPages: [...payload.customPages].sort((a, b) => a.sort_order - b.sort_order),
          algy_soz: payload.algy_soz,
          hat_text: payload.hat_text,
          faktiler_facts: payload.faktiler_facts ?? [],
          faktiler_category_enabled: payload.faktiler_category_enabled ?? false,
          faktiler_example_facts: payload.faktiler_example_facts ?? '',
          answerFontPreset: payload.answerFontPreset ?? '18',
          answerTextAlign: payload.answerTextAlign ?? 'left',
          algyFontPresetOverride: payload.algyFontPresetOverride ?? null,
          hatFontPresetOverride: payload.hatFontPresetOverride ?? null,
          chapterFixedPhotos: { ...(payload.chapterFixedPhotos ?? {}) },
          activeChapterId: payload.activeChapterId,
          spreadIndex: 0,
        }),

      getUnsavedPairs: () => {
        const { answers, savedAnswers } = get()
        return Object.entries(answers).filter(([k, v]) => savedAnswers[k] !== v)
      },

      getAllQuestionsFlat: () => {
        return get()
          .chapters.filter((c) => c.part_kind !== 'faktiler')
          .flatMap((c) => c.questions ?? [])
      },

      getAllPages: () => {
        const { customPages } = get()
        const questions = get().getAllQuestionsFlat()
        const n = questions.length
        const pages: import('@/lib/types').BookPage[] = []
        questions.forEach((q, idx) => {
          pages.push({ type: 'question', data: q })
          const nextIdx = idx + 1 < n ? idx + 1 : 9999
          const low = idx * 100 + 50
          const high = nextIdx * 100 + 50
          const attached = customPages
            .filter((cp) => cp.sort_order >= low && cp.sort_order < high)
            .sort((a, b) => a.sort_order - b.sort_order)
          attached.forEach((cp) => pages.push({ type: 'custom', data: cp }))
        })
        return pages
      },
    }),
    { name: 'editor-store' }
  )
)

/**
 * Atomic typography selector — components that only need typography read all
 * four fields in a single subscription to avoid the 4× re-render storm that a
 * naïve `useEditorStore(s => s.X)` × 4 would create on every keystroke.
 *
 * `useShallow` ensures equal references when nothing changed.
 */
export const useEditorTypography = () =>
  useEditorStore(
    useShallow((s) => ({
      answerFontPreset: s.answerFontPreset,
      answerTextAlign: s.answerTextAlign,
      algyFontPresetOverride: s.algyFontPresetOverride,
      hatFontPresetOverride: s.hatFontPresetOverride,
    }))
  )
