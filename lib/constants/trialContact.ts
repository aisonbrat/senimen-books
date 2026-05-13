import { TRIAL_FREE_QUESTION_COUNT } from '@/lib/constants/trialBook'

/** Trial CTA — WhatsApp (Kazakh pre-filled message). */
export const TRIAL_WHATSAPP_HREF =
  'https://wa.me/77067074748?text=' +
  encodeURIComponent(
    'Сұрақтарға тегін жауап беріп көрдім. Маған ұнады, мен кітапқа тапсырыс беремін.'
  )

export const TRIAL_BANNER_KK = `Тегін кезең: тек алғашқы ${TRIAL_FREE_QUESTION_COUNT} сұрақты толтыра аласыз. Қалған бөлімдер құлыпталған — толық кітап үшін әкімшіге хабарласыңыз.`

/** Shown on locked regions and preview thumbnails (replaces older «Құлыпталған» label). */
export const TRIAL_LOCK_HEADLINE_KK =
  'Кітапты толық жазу үшін біздің менеджерге жазыңыз.'
