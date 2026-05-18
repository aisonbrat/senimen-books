/**
 * PostgREST `.select(...)` fragments for slim queries (avoid `*` on hot paths).
 * Keep aligned with preview/PDF (`buildPreviewPages`, `exportBookToPDF`) and editor UI.
 */

/** `useEditorData` initial load: book row + nested category faktiler flags only. */
export const ORDERS_EDITOR_SELECT = [
  'id',
  'client_id',
  'category_id',
  'author_name',
  'book_title',
  'recipient_name',
  'delivery_address',
  'status',
  'assigned_editor',
  'created_at',
  'updated_at',
  'submitted_at',
  'completed_at',
  'faktiler_text',
  'faktiler_photo_path',
  'faktiler_facts',
  'client_ai_enabled',
  'trial_mode',
  'trial_whatsapp_clicked_at',
  'admin_cover_print_path',
  'answer_font_preset',
  'answer_text_align',
  'algy_font_preset',
  'hat_font_preset',
  'fixed_rectangle_color',
  'algy_soz',
  'hat_text',
  'categories(faktiler_enabled,faktiler_example_facts)',
].join(',')

export const ANSWERS_TEXT_ONLY_SELECT = 'question_id,text_content'

/** Admin order progress — count filled answers per book. */
export const ANSWERS_PROGRESS_SELECT = 'order_id,question_id,text_content,photo_path,is_skipped'

/** Server/client PDF export — photo answers may live in `photo_path` when `text_content` is empty. */
export const ANSWERS_PDF_EXPORT_SELECT = [
  'question_id',
  'text_content',
  'photo_path',
  'is_skipped',
].join(',')

/** Full custom page row shape used by editor cards, preview, and PDF. */
export const CUSTOM_PAGES_EDITOR_SELECT = [
  'id',
  'order_id',
  'page_type',
  'sort_order',
  'title_kk',
  'text_content',
  'photo_path',
  'overlay_text',
  'overlay_position',
  'poem_stanza_lines',
  'hidden_from_book',
  'qr_url',
  'qr_size',
  'qr_vertical',
  'overlay_in_book',
  'qr_in_book',
  'text_font_preset',
  'overlay_shadow_opacity',
  'photo_dpi',
  'selected_phrase_id',
  'created_at',
  'updated_at',
].join(',')

/** Client `/dashboard` list + rename modal. */
export const ORDERS_DASHBOARD_CLIENT_SELECT = [
  'id',
  'book_title',
  'category_id',
  'status',
  'recipient_name',
  'author_name',
].join(',')

/** Admin orders table / PDF export (`PDFButton` spreads row into `exportBookToPDF`). */
export const ORDERS_ADMIN_LIST_SELECT = [
  'id',
  'client_id',
  'category_id',
  'author_name',
  'book_title',
  'recipient_name',
  'delivery_address',
  'status',
  'assigned_editor',
  'created_at',
  'updated_at',
  'submitted_at',
  'completed_at',
  'client_ai_enabled',
  'trial_mode',
  'admin_cover_print_path',
  'faktiler_text',
  'faktiler_photo_path',
  'faktiler_facts',
  'answer_font_preset',
  'answer_text_align',
  'algy_font_preset',
  'hat_font_preset',
  'fixed_rectangle_color',
  'algy_soz',
  'hat_text',
].join(',')
