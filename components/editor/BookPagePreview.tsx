'use client'
import { memo, useMemo, useState, useEffect, type CSSProperties } from 'react'
import type { Question, CustomPage } from '@/lib/types'
import { useEditorTypography } from '@/lib/store/editorStore'
import {
  BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM,
  BOOK_BRAND_FOOTER_FONT_MM,
  BOOK_CONTENT_BOTTOM_MM,
  BOOK_FOOTER_LABEL_FROM_BOTTOM_MM,
  BOOK_FOOTER_RULE_FROM_BOTTOM_MM,
  BOOK_MARGIN_MM,
  BOOK_PAGE_VERSE_BRAND_FONT_MM,
  COVER_AUTHOR_FONT_MM,
  COVER_CONTENT_BLOCK_TOP_MM,
  COVER_PRODUCT_TAGLINE_KK,
  COVER_TAGLINE_FONT_MM,
  COVER_TITLE_FONT_MM,
  CUSTOM_TEXT_TOP_MM,
  QUESTION_ANSWER_TOP_MM,
  QUESTION_TITLE_BLOCK_H_MM,
  QUESTION_TITLE_TOP_MM,
  SECTION_BODY_TOP_MM,
  BODY_LINE_HEIGHT_RATIO,
  TOC_PREVIEW_ROW_GAP_MM,
  TOC_ROWS_TOP_MM,
  answerPresetToBodyMm,
  mergeTypographyWithCustomPage,
  mergeTypographyWithOrderSection,
  type AnswerTextAlign,
} from '@/lib/bookLayout'
import { sanitizeAnswerHtmlFragment, stripInlineTextAlignFromHtml } from '@/lib/utils/answerHtml'
import { getPhotoCountFromTitleKk, resolveOverlayShadowOpacity } from '@/lib/utils/customPagePhotoMeta'
import { normalizeOverlayComposite, type OverlayVertical } from '@/lib/utils/overlayParts'
import { normalizeQrSizeKey, QR_BACKGROUND_RADIUS_MM, QR_INTERIOR_PADDING_MM, QR_SIZE_MM } from '@/lib/utils/overlayQrRules'
import {
  answerDisplaysAsPhotoContent,
  splitPhotoAnswerRawSegments,
  splitPhotoAnswerToResolvedUrls,
} from '@/lib/utils/bookPhotoUrl'
import { normalizeFixedRectangleColor } from '@/lib/utils/fixedChapterRectPalette'
import { SignedBookPhotoImg } from '@/components/editor/SignedBookPhotoImg'

const SCALE = 1.6
const mm = (v: number) => Math.round(v * SCALE)
/** Avoid rounding drift vs PDF mm anchors (continuation pages vs first slice). */
const mmPrecise = (v: number) => v * SCALE

const PHOTO_EDGE_INSET_PREVIEW_MM = 12

const PhotoQrPreview = memo(function PhotoQrPreview({
  url,
  qrSizeRaw,
  vertical,
}: {
  url: string
  qrSizeRaw: string | null | undefined
  vertical: OverlayVertical
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let ok = true
    import('qrcode').then(({ default: QR }) => {
      QR.toDataURL(url.trim(), { margin: 3, width: 320 }).then((d) => ok && setSrc(d))
    })
    return () => {
      ok = false
    }
  }, [url])
  if (!src) return null
  const sizeKey = normalizeQrSizeKey(qrSizeRaw)
  const sideMm = QR_SIZE_MM[sizeKey]
  const padMm = QR_INTERIOR_PADDING_MM
  const side = mm(sideMm)
  const pad = mm(padMm)
  const inset = mm(PHOTO_EDGE_INSET_PREVIEW_MM)
  const innerBox: CSSProperties = {
    position: 'absolute',
    left: '50%',
    width: side,
    height: side,
    padding: pad,
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.97)',
    borderRadius: mm(QR_BACKGROUND_RADIUS_MM),
    boxShadow: '0 2px 14px rgba(15, 23, 42, 0.16), 0 1px 4px rgba(15, 23, 42, 0.09)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  }
  const imgStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  }
  if (vertical === 'top')
    return (
      <div style={{ ...innerBox, top: inset, transform: 'translateX(-50%)' }}>
        <img src={src} alt="" style={imgStyle} />
      </div>
    )
  if (vertical === 'bottom')
    return (
      <div style={{ ...innerBox, bottom: inset, transform: 'translateX(-50%)' }}>
        <img src={src} alt="" style={imgStyle} />
      </div>
    )
  return (
    <div style={{ ...innerBox, top: '50%', transform: 'translate(-50%, -50%)' }}>
      <img src={src} alt="" style={imgStyle} />
    </div>
  )
})

export type PreviewPage =
  | { type: 'cover'; bookTitle: string; authorName: string }
  | { type: 'chapter_break'; title: string; chapterNum: number; minFlatQuestionIndex: number }
  | {
      type: 'question'
      data: Question
      answer: string
      /** First slice shows the question header; continuation pages align body to the same top band */
      showQuestionHeader?: boolean
    }
  | { type: 'custom'; data: CustomPage; answer: string; customTextContinuation?: boolean }
  | { type: 'algy_soz'; text: string; showSectionTitle?: boolean }
  | {
      type: 'contents'
      chapters: Array<{ title: string; pageNum: number; chapterNum: number }>
      faktilerPageNum?: number
      hatPageNum?: number
    }
  | { type: 'hat'; text?: string; showSectionTitle?: boolean }
  | { type: 'faktiler_divider'; title: string; chapterNum: number }
  | {
      type: 'faktiler_text'
      text: string
      faktilerTextContinuation?: boolean
    }
  | { type: 'faktiler_photo'; photoUrl: string }
  | {
      type: 'fixed_chapter'
      chapterId: string
      phrase: string
      photoPath: string
      rectColor: string
      minFlatQuestionIndex: number
    }

interface BookPagePreviewProps {
  page: PreviewPage | null
  pageNum: number
  bookTitle: string
  isLeft: boolean
}

export function BookPagePreview({ page, pageNum, bookTitle, isLeft }: BookPagePreviewProps) {
  // Single subscription for all four typography fields — `useShallow` avoids
  // re-renders unless one of them actually changes, replacing four
  // independent subscriptions that previously fired on every store mutation.
  const { answerFontPreset, answerTextAlign, algyFontPresetOverride, hatFontPresetOverride } =
    useEditorTypography()

  const baseTypo = useMemo(
    () => ({ fontPreset: answerFontPreset, textAlign: answerTextAlign }),
    [answerFontPreset, answerTextAlign]
  )

  const orderMini = useMemo(
    () => ({ algy_font_preset: algyFontPresetOverride, hat_font_preset: hatFontPresetOverride }),
    [algyFontPresetOverride, hatFontPresetOverride]
  )

  const bodyFontMm = useMemo(() => {
    if (!page) return answerPresetToBodyMm(answerFontPreset)
    if (page.type === 'algy_soz') {
      return answerPresetToBodyMm(mergeTypographyWithOrderSection(baseTypo, orderMini, 'algy').fontPreset)
    }
    if (page.type === 'hat') {
      return answerPresetToBodyMm(mergeTypographyWithOrderSection(baseTypo, orderMini, 'hat').fontPreset)
    }
    if (page.type === 'faktiler_text') {
      return answerPresetToBodyMm(answerFontPreset)
    }
    if (page.type === 'custom') {
      const ans = page.answer || ''
      const isPhoto = !!(ans && answerDisplaysAsPhotoContent(ans))
      if (!isPhoto && (page.data.page_type === 'custom_text' || page.data.page_type === 'custom_poem')) {
        return answerPresetToBodyMm(mergeTypographyWithCustomPage(baseTypo, page.data).fontPreset)
      }
    }
    return answerPresetToBodyMm(answerFontPreset)
  }, [page, answerFontPreset, baseTypo, orderMini])

  if (!page) return <BlankPage />
  if (page.type === 'cover')
    return <CoverPage bookTitle={page.bookTitle} authorName={page.authorName} />
  if (page.type === 'chapter_break') return <ChapterBreakPage title={page.title} chapterNum={page.chapterNum} />
  if (page.type === 'algy_soz')
    return (
      <AlgySozPage
        text={page.text}
        pageNum={pageNum}
        bookTitle={bookTitle}
        isLeft={isLeft}
        showTitle={page.showSectionTitle !== false}
        bodyFontMm={bodyFontMm}
        textAlign={answerTextAlign}
      />
    )
  if (page.type === 'contents')
    return (
      <ContentsPage
        chapters={page.chapters}
        faktilerPageNum={page.faktilerPageNum}
        hatPageNum={page.hatPageNum}
        pageNum={pageNum}
        isLeft={isLeft}
      />
    )
  if (page.type === 'hat')
    return (
      <HatPage
        text={page.text}
        pageNum={pageNum}
        bookTitle={bookTitle}
        isLeft={isLeft}
        showTitle={page.showSectionTitle !== false}
        bodyFontMm={bodyFontMm}
        textAlign={answerTextAlign}
      />
    )
  if (page.type === 'faktiler_divider')
    return <ChapterBreakPage title={page.title} chapterNum={page.chapterNum} />
  if (page.type === 'faktiler_text')
    return <FaktilerTextPage text={page.text} isContinuation={!!page.faktilerTextContinuation} bodyFontMm={bodyFontMm} />
  if (page.type === 'faktiler_photo') return <FaktilerPhotoPage photoUrl={page.photoUrl} />
  if (page.type === 'fixed_chapter')
    return (
      <FixedChapterPage
        phrase={page.phrase}
        photoPath={page.photoPath}
        rectColor={normalizeFixedRectangleColor(page.rectColor)}
      />
    )

  const question = page.type === 'question' ? (page.data as Question) : null
  const customPage = page.type === 'custom' ? (page.data as CustomPage) : null
  const answer = page.answer
  const photos = answer ? splitPhotoAnswerToResolvedUrls(answer) : []
  const photoRawSegments = answer ? splitPhotoAnswerRawSegments(answer) : []
  const isPhoto = answer && answerDisplaysAsPhotoContent(answer)
  const photoCount = getPhotoCountFromTitleKk(customPage?.title_kk) || photos.length || 1
  const overlayShadowPct = customPage ? resolveOverlayShadowOpacity(customPage) : 45

  const showQuestionHeader = page.type === 'question' && question && page.showQuestionHeader !== false

  /** Continuation question pages align body top with the question headline band (matches PDF). */
  const answerBodyTopMm = question
    ? showQuestionHeader
      ? QUESTION_ANSWER_TOP_MM
      : QUESTION_TITLE_TOP_MM
    : CUSTOM_TEXT_TOP_MM

  const contentBottom = mmPrecise(BOOK_CONTENT_BOTTOM_MM)

  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {isPhoto ? (
        <>
          {photoCount === 1 && photos[0] && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <SignedBookPhotoImg
                storageRef={photoRawSegments[0] || photos[0]}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
          {photoCount === 2 && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: '1fr 1fr' }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ overflow: 'hidden', background: '#eee' }}>
                  {photos[i] ? (
                    <SignedBookPhotoImg
                      storageRef={photoRawSegments[i] || photos[i]}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {photoCount === 4 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ overflow: 'hidden', background: '#eee' }}>
                  {photos[i] ? (
                    <SignedBookPhotoImg
                      storageRef={photoRawSegments[i] || photos[i]}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {customPage?.overlay_in_book === true && customPage?.overlay_text && (
            <Overlay
              text={customPage.overlay_text}
              position={customPage.overlay_position}
              opacity={customPage.photo_dpi}
              size={parseInt(customPage.text_content || '18', 10)}
              shadowOpacity={overlayShadowPct}
            />
          )}
          {customPage?.qr_in_book !== false &&
          customPage?.qr_url?.trim() &&
          /^https?:\/\//i.test(customPage.qr_url.trim()) ? (
            <PhotoQrPreview
              url={customPage.qr_url.trim()}
              qrSizeRaw={customPage.qr_size}
              vertical={(customPage.qr_vertical || 'bottom') as OverlayVertical}
            />
          ) : null}
        </>
      ) : (
        <>
          {question && showQuestionHeader && (
            <div
              style={{
                position: 'absolute',
                top: mm(QUESTION_TITLE_TOP_MM),
                left: mm(BOOK_MARGIN_MM),
                right: mm(BOOK_MARGIN_MM),
                height: mm(QUESTION_TITLE_BLOCK_H_MM),
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: mm(5.05), color: '#1a1a1a', lineHeight: 1.22, fontWeight: 600 }}>
                {question.question_kk}
              </div>
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              top: mmPrecise(answerBodyTopMm),
              left: mm(BOOK_MARGIN_MM),
              right: mm(BOOK_MARGIN_MM),
              bottom: contentBottom,
              overflow: 'hidden',
            }}
          >
            <RichAnswerHtml
              key={`${pageNum}-${answerTextAlign}-${bodyFontMm}`}
              html={answer || ''}
              fontMm={bodyFontMm}
              textAlign={answerTextAlign}
            />
          </div>
          <PageFooter pageNum={pageNum} bookTitle={bookTitle} isLeft={isLeft} />
        </>
      )}
    </div>
  )
}

/** Pagination emits serialized HTML (`data-book-line`, para gaps). Mirrors PDF `drawSerializedRichHtml`. */
function RichAnswerHtml({
  html,
  fontMm,
  textAlign,
}: {
  html: string
  fontMm: number
  textAlign: AnswerTextAlign | 'center'
}) {
  let safe = sanitizeAnswerHtmlFragment(html)
  if (textAlign === 'justify') safe = stripInlineTextAlignFromHtml(safe)
  const cssAlign =
    textAlign === 'left' ? ('left' as const) : textAlign === 'center' ? ('center' as const) : ('justify' as const)

  return (
    <div
      lang="kk"
      data-book-align={textAlign}
      className="book-rich-root font-preview-book"
      style={{
        width: '100%',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        fontSize: mm(fontMm),
        lineHeight: BODY_LINE_HEIGHT_RATIO,
        fontWeight: 500,
        color: '#1a1a1a',
        textAlign: cssAlign,
        ...(textAlign === 'center' ? { textAlignLast: 'center' as const } : {}),
        wordBreak: 'normal' as const,
        overflowWrap: 'break-word' as const,
        ...(textAlign === 'justify' ? { hyphens: 'manual' as const } : {}),
      }}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}

function PageFooter({ pageNum, bookTitle, isLeft }: { pageNum: number; bookTitle: string; isLeft: boolean }) {
  /** Preview labels: bottom = baseline-from-bottom − ~3mm (cap-height correction so labels visually sit at the PDF baseline). */
  const labelBottomMm = Math.max(2, BOOK_FOOTER_LABEL_FROM_BOTTOM_MM - 3)
  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: mm(BOOK_FOOTER_RULE_FROM_BOTTOM_MM),
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          height: '0.3px',
          background: '#1a1a1a',
        }}
      />
      {isLeft ? (
        <>
          <div style={{ position: 'absolute', bottom: mm(labelBottomMm), left: mm(BOOK_MARGIN_MM), fontSize: mm(5.64), color: '#1a1a1a' }}>
            {pageNum}
          </div>
          <div style={{ position: 'absolute', bottom: mm(labelBottomMm), right: mm(BOOK_MARGIN_MM), fontSize: mm(4.23), color: '#1a1a1a' }}>
            {bookTitle}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: mm(labelBottomMm),
              left: mm(BOOK_MARGIN_MM),
              fontSize: mm(BOOK_PAGE_VERSE_BRAND_FONT_MM),
              color: '#969696',
              fontWeight: 400,
              lineHeight: 1.05,
              fontFamily: "'Cormorant', Georgia, serif",
            }}
          >
            senimen.books
          </div>
          <div style={{ position: 'absolute', bottom: mm(labelBottomMm), right: mm(BOOK_MARGIN_MM), fontSize: mm(5.64), color: '#1a1a1a' }}>
            {pageNum}
          </div>
        </>
      )}
    </>
  )
}

function BlankPage() {
  return <div style={{ width: mm(148), height: mm(210), background: '#F7F7F5', border: '0.5px solid #ddd', flexShrink: 0 }} />
}

function CoverPage({ bookTitle, authorName }: { bookTitle: string; authorName: string }) {
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', top: mm(20), left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <img src="/logo.svg" alt="Сенімен" style={{ height: mm(10), width: 'auto', objectFit: 'contain' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: mm(COVER_CONTENT_BLOCK_TOP_MM),
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: mm(COVER_TITLE_FONT_MM),
            fontWeight: 700,
            color: '#111111',
            lineHeight: 1.14,
            marginBottom: mm(5),
          }}
        >
          {bookTitle}
        </div>
        <div
          style={{
            fontSize: mm(COVER_TAGLINE_FONT_MM),
            fontWeight: 700,
            color: '#111111',
            lineHeight: 1.32,
            marginBottom: mm(1.5),
          }}
        >
          {COVER_PRODUCT_TAGLINE_KK}
        </div>
        {authorName ? (
          <div style={{ fontSize: mm(COVER_AUTHOR_FONT_MM), fontWeight: 400, color: '#111111', lineHeight: 1.32 }}>
            Кітап авторы – {authorName}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: mm(Math.max(2, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM - 3)),
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: mm(BOOK_BRAND_FOOTER_FONT_MM),
          color: '#111111',
          fontWeight: 500,
        }}
      >
        senimen.books
      </div>
    </div>
  )
}

function FaktilerTextPage({
  text,
  isContinuation,
  bodyFontMm,
}: {
  text: string
  isContinuation: boolean
  bodyFontMm: number
}) {
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: isContinuation ? mm(QUESTION_TITLE_TOP_MM) : mm(20),
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          bottom: mm(BOOK_CONTENT_BOTTOM_MM),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isContinuation ? 'flex-start' : 'center',
          alignItems: 'stretch',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '100%', flexShrink: 0 }}>
          <RichAnswerHtml html={text} fontMm={bodyFontMm} textAlign="center" />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: mm(Math.max(2, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM - 3)),
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: mm(BOOK_BRAND_FOOTER_FONT_MM),
          color: '#111111',
          fontWeight: 500,
        }}
      >
        senimen.books
      </div>
    </div>
  )
}

function FixedChapterPage({
  phrase,
  photoPath,
  rectColor,
}: {
  phrase: string
  photoPath: string
  rectColor: string
}) {
  const raw = (photoPath || '').trim()
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: '#E8E6E3',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: '3 1 0',
          minHeight: 0,
          width: '100%',
          position: 'relative',
          background: '#E8E6E3',
        }}
      >
        {raw ? (
          <SignedBookPhotoImg
            storageRef={raw}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9A9290',
              fontSize: mm(3.8),
              fontWeight: 600,
              textAlign: 'center',
              padding: mm(4),
            }}
          >
            Фото қосыңыз
          </div>
        )}
      </div>
      <div
        style={{
          flex: '2 1 0',
          minHeight: 0,
          width: '100%',
          background: rectColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${mm(5)} ${mm(8)} ${mm(3)}`,
            boxSizing: 'border-box',
          }}
        >
          <p
            style={{
              margin: 0,
              textAlign: 'center',
              color: '#FFFFFF',
              fontSize: mm(7.15),
              lineHeight: 1.38,
              fontWeight: 700,
              fontFamily: "'Cormorant', Georgia, serif",
              maxWidth: '100%',
            }}
          >
            {phrase}
          </p>
        </div>
        <div
          style={{
            flexShrink: 0,
            paddingBottom: mm(Math.max(2, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM - 3)),
            paddingTop: mm(2),
            textAlign: 'center',
            fontSize: mm(BOOK_BRAND_FOOTER_FONT_MM),
            color: 'rgba(235,235,235,0.98)',
            fontWeight: 500,
            letterSpacing: '0.02em',
            fontFamily: "'Cormorant', Georgia, serif",
          }}
        >
          senimen.books
        </div>
      </div>
    </div>
  )
}

function FaktilerPhotoPage({ photoUrl }: { photoUrl: string }) {
  const raw = (photoUrl || '').trim()
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: '#111',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {raw ? (
        <SignedBookPhotoImg
          storageRef={raw}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: mm(4) }}>
          Фото қосыңыз
        </div>
      )}
    </div>
  )
}

function ChapterBreakPage({ title, chapterNum }: { title: string; chapterNum: number }) {
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', top: mm(20), left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <img src="/logo.svg" alt="Сенімен" style={{ height: mm(10), width: 'auto', objectFit: 'contain' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          transform: 'translateY(-52%)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: mm(6.45),
            color: '#111111',
            fontWeight: 700,
            marginBottom: mm(6),
            lineHeight: 1.12,
            fontFamily: "'Cormorant', Georgia, serif",
          }}
        >
          {chapterNum}-бөлім
        </div>
        <div
          style={{
            fontSize: mm(11.25),
            fontWeight: 400,
            color: '#111111',
            lineHeight: 1.28,
            letterSpacing: '-0.02em',
            fontFamily: "'Cormorant', Georgia, serif",
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: mm(Math.max(2, BOOK_BRAND_FOOTER_BASELINE_FROM_BOTTOM_MM - 3)),
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: mm(BOOK_BRAND_FOOTER_FONT_MM),
          color: '#111111',
          fontWeight: 500,
        }}
      >
        senimen.books
      </div>
    </div>
  )
}

function AlgySozPage({
  text,
  pageNum,
  bookTitle,
  isLeft,
  showTitle,
  bodyFontMm,
  textAlign,
}: {
  text: string
  pageNum: number
  bookTitle: string
  isLeft: boolean
  showTitle: boolean
  bodyFontMm: number
  textAlign: AnswerTextAlign
}) {
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {showTitle && (
        <div style={{ position: 'absolute', top: mm(16), left: mm(BOOK_MARGIN_MM), right: mm(BOOK_MARGIN_MM) }}>
          <div style={{ fontSize: mm(11), fontWeight: '600', color: '#1a1a1a', lineHeight: 1.2, marginBottom: mm(5) }}>
            Алғы сөз
          </div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: mmPrecise(showTitle ? SECTION_BODY_TOP_MM : QUESTION_TITLE_TOP_MM),
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          bottom: mmPrecise(BOOK_CONTENT_BOTTOM_MM),
          overflow: 'hidden',
        }}
      >
        <RichAnswerHtml html={text} fontMm={bodyFontMm} textAlign={textAlign} />
      </div>
      <PageFooter pageNum={pageNum} bookTitle={bookTitle} isLeft={isLeft} />
    </div>
  )
}

function ContentsPage({
  chapters,
  faktilerPageNum,
  hatPageNum,
  pageNum,
  isLeft,
}: {
  chapters: Array<{ title: string; pageNum: number; chapterNum: number }>
  faktilerPageNum?: number
  hatPageNum?: number
  pageNum: number
  isLeft: boolean
}) {
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div style={{ position: 'absolute', top: mm(16), left: mm(BOOK_MARGIN_MM), right: mm(BOOK_MARGIN_MM) }}>
        <div style={{ fontSize: mm(11), fontWeight: '600', color: '#1a1a1a', lineHeight: 1.2 }}>Мазмұны</div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: mm(TOC_ROWS_TOP_MM),
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          bottom: mmPrecise(BOOK_CONTENT_BOTTOM_MM),
          display: 'flex',
          flexDirection: 'column',
          gap: mm(TOC_PREVIEW_ROW_GAP_MM),
        }}
      >
        {chapters.map((ch, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: mm(1.5) }}>
            <span style={{ fontSize: mm(6), color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '62%' }}>
              {ch.title}
            </span>
            <span
              style={{
                flex: 1,
                borderBottom: '0.5px dotted #ccc',
                marginBottom: mm(0.5),
                minWidth: mm(4),
              }}
            />
            <span style={{ fontSize: mm(6), color: '#1a1a1a', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {ch.pageNum}
            </span>
          </div>
        ))}
        {faktilerPageNum != null ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: mm(1.5) }}>
            <span style={{ fontSize: mm(6), color: '#1a1a1a' }}>Фактілер</span>
            <span
              style={{
                flex: 1,
                borderBottom: '0.5px dotted #ccc',
                marginBottom: mm(0.5),
                minWidth: mm(4),
              }}
            />
            <span
              style={{
                fontSize: mm(6),
                color: '#1a1a1a',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {faktilerPageNum}
            </span>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: mm(1.5) }}>
          <span style={{ fontSize: mm(6), color: '#1a1a1a' }}>Хат</span>
          <span
            style={{
              flex: 1,
              borderBottom: '0.5px dotted #ccc',
              marginBottom: mm(0.5),
              minWidth: mm(4),
            }}
          />
          <span
            style={{
              fontSize: mm(6),
              color: hatPageNum ? '#1a1a1a' : '#aaa',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {hatPageNum ?? '…'}
          </span>
        </div>
      </div>
      <PageFooter pageNum={pageNum} bookTitle="" isLeft={isLeft} />
    </div>
  )
}

function HatPage({
  text,
  pageNum,
  bookTitle,
  isLeft,
  showTitle,
  bodyFontMm,
  textAlign,
}: {
  text?: string
  pageNum: number
  bookTitle: string
  isLeft: boolean
  showTitle: boolean
  bodyFontMm: number
  textAlign: AnswerTextAlign
}) {
  const content = text?.trim() ?? ''
  return (
    <div
      className="font-preview-book"
      style={{
        width: mm(148),
        height: mm(210),
        background: 'white',
        border: '0.5px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {showTitle && (
        <div style={{ position: 'absolute', top: mm(16), left: mm(BOOK_MARGIN_MM), right: mm(BOOK_MARGIN_MM) }}>
          <div style={{ fontSize: mm(11), fontWeight: '600', color: '#1a1a1a', lineHeight: 1.2, marginBottom: mm(5) }}>Хат</div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: mmPrecise(showTitle ? SECTION_BODY_TOP_MM : QUESTION_TITLE_TOP_MM),
          left: mm(BOOK_MARGIN_MM),
          right: mm(BOOK_MARGIN_MM),
          bottom: mmPrecise(BOOK_CONTENT_BOTTOM_MM),
          overflow: 'hidden',
        }}
      >
        <RichAnswerHtml html={content} fontMm={bodyFontMm} textAlign={textAlign} />
      </div>
      <PageFooter pageNum={pageNum} bookTitle={bookTitle} isLeft={isLeft} />
    </div>
  )
}

const Overlay = memo(function Overlay({
  text,
  position,
  opacity,
  size,
  shadowOpacity,
}: {
  text: string
  position?: string
  opacity?: number
  size?: number
  shadowOpacity?: number | null
}) {
  const { vertical: pos, bg: bgType } = normalizeOverlayComposite(position)
  const op = (opacity ?? 60) / 100
  const fontSize = mm((size || 18) * 0.28)
  const shadowStrength = shadowOpacity == null ? 45 : Math.min(100, Math.max(0, shadowOpacity))
  const shadow =
    shadowStrength > 0
      ? `0 ${mm(0.35)}px ${mm(1.2)}px rgba(0,0,0,${(shadowStrength / 100).toFixed(2)})`
      : undefined
  const bgStyle =
    bgType === 'none'
      ? 'transparent'
      : bgType === 'solid'
        ? `rgba(0,0,0,${op})`
        : pos === 'top'
          ? `linear-gradient(to bottom, rgba(0,0,0,${op}), transparent)`
          : pos === 'bottom'
            ? `linear-gradient(to top, rgba(0,0,0,${op}), transparent)`
            : `linear-gradient(to bottom, transparent, rgba(0,0,0,${op}), transparent)`
  const topStyle =
    bgType === 'solid'
      ? { top: 0, left: 0, right: 0, bottom: 0 }
      : pos === 'top'
        ? { top: 0, left: 0, right: 0, height: '45%' }
        : pos === 'bottom'
          ? { bottom: 0, left: 0, right: 0, height: '45%' }
          : { top: '25%', left: 0, right: 0, height: '50%' }
  return (
    <div
      style={{
        position: 'absolute',
        ...topStyle,
        background: bgStyle,
        display: 'flex',
        alignItems: pos === 'top' ? 'flex-start' : pos === 'bottom' ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: mm(PHOTO_EDGE_INSET_PREVIEW_MM),
      }}
    >
      <span
        style={{
          fontSize,
          color: 'white',
          letterSpacing: '0.03em',
          textAlign: 'center',
          lineHeight: 1.3,
          textShadow: shadow,
        }}
      >
        {text}
      </span>
    </div>
  )
})
