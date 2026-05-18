import type { Question, CustomPage, Order } from '@/lib/types'
import {
  BOOK_CONTENT_BOTTOM_MM,
  BOOK_FOOTER_LABEL_FROM_BOTTOM_MM,
  BOOK_FOOTER_RULE_FROM_BOTTOM_MM,
  BOOK_MARGIN_MM,
  BOOK_PAGE_VERSE_BRAND_FONT_MM,
} from '@/lib/bookLayout'
import { getPhotoCountFromTitleKk, resolveOverlayShadowOpacity } from '@/lib/utils/customPagePhotoMeta'
import { normalizeOverlayComposite } from '@/lib/utils/overlayParts'
import { answerDisplaysAsPhotoContent, splitPhotoAnswerToResolvedUrls } from '@/lib/utils/bookPhotoUrl'

const mm = (v: number) => v * 3.7795

function PDFPage({ question, customPage, answer, pageNum, bookTitle, isLeft }: {
  question: Question | null
  customPage: CustomPage | null
  answer: string
  pageNum: number
  bookTitle: string
  isLeft: boolean
}) {
  const photos = answer ? splitPhotoAnswerToResolvedUrls(answer) : []
  const isPhoto = answer && answerDisplaysAsPhotoContent(answer)
  const photoCount = getPhotoCountFromTitleKk(customPage?.title_kk) || photos.length || 1
  const overlayShadowPct = customPage ? resolveOverlayShadowOpacity(customPage) : 45

  const w = mm(148)
  const h = mm(210)

  return (
    <div
      data-pdf-page
      style={{ width: w, height: h, background: 'white', position: 'relative', overflow: 'hidden', fontFamily: "'Cormorant', Georgia, serif", flexShrink: 0 }}
    >
      {isPhoto ? (
        <>
          {photoCount === 1 && (
            <img src={photos[0] || answer} alt="" crossOrigin="anonymous"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {photoCount === 2 && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateRows: '1fr 1fr' }}>
              {[0, 1].map(i => (
                <div key={i} style={{ overflow: 'hidden', background: '#eee' }}>
                  {photos[i] && <img src={photos[i]} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              ))}
            </div>
          )}
          {photoCount === 4 && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ overflow: 'hidden', background: '#eee' }}>
                  {photos[i] && <img src={photos[i]} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              ))}
            </div>
          )}
          {customPage?.overlay_in_book !== false && customPage?.overlay_text && (
            <PDFOverlay
              text={customPage.overlay_text}
              position={customPage.overlay_position}
              opacity={customPage.photo_dpi}
              size={parseInt(customPage.text_content || '18')}
              shadowOpacity={overlayShadowPct}
            />
          )}
        </>
      ) : (
        <>
          {question && (
            <div style={{ position: 'absolute', top: mm(18.9), left: mm(BOOK_MARGIN_MM), right: mm(BOOK_MARGIN_MM), height: mm(12), overflow: 'hidden' }}>
              <div style={{ fontSize: mm(5.05), color: '#1a1a1a', lineHeight: 1.35, fontWeight: '600' }}>{question.question_kk}</div>
            </div>
          )}
          <div style={{ position: 'absolute', top: question ? mm(38.4) : mm(18.9), left: mm(BOOK_MARGIN_MM), right: mm(BOOK_MARGIN_MM), bottom: mm(BOOK_CONTENT_BOTTOM_MM), overflow: 'hidden' }}>
            <div style={{ fontSize: mm(7.05), color: '#1a1a1a', lineHeight: 1.5, textAlign: 'justify', textAlignLast: 'left', fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {answer || ''}
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: mm(BOOK_FOOTER_RULE_FROM_BOTTOM_MM), left: mm(BOOK_MARGIN_MM), right: mm(BOOK_MARGIN_MM), height: 0.5, background: '#1a1a1a' }} />
          {(() => {
            const labelB = mm(Math.max(2, BOOK_FOOTER_LABEL_FROM_BOTTOM_MM - 3))
            return isLeft ? (
              <>
                <div style={{ position: 'absolute', bottom: labelB, left: mm(BOOK_MARGIN_MM), fontSize: mm(5.64), color: '#1a1a1a' }}>{pageNum}</div>
                <div style={{ position: 'absolute', bottom: labelB, right: mm(BOOK_MARGIN_MM), fontSize: mm(4.23), color: '#1a1a1a' }}>{bookTitle}</div>
              </>
            ) : (
              <>
                <div
                  style={{
                    position: 'absolute',
                    bottom: labelB,
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
                <div style={{ position: 'absolute', bottom: labelB, right: mm(BOOK_MARGIN_MM), fontSize: mm(5.64), color: '#1a1a1a' }}>{pageNum}</div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}

function PDFOverlay({ text, position, opacity, size, shadowOpacity }: {
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
  const textShadow =
    shadowStrength > 0
      ? `0 ${mm(0.35)}px ${mm(1.2)}px rgba(0,0,0,${(shadowStrength / 100).toFixed(2)})`
      : undefined

  const bgStyle = bgType === 'none' ? 'transparent'
    : bgType === 'solid' ? `rgba(0,0,0,${op})`
    : pos === 'top' ? `linear-gradient(to bottom, rgba(0,0,0,${op}), transparent)`
    : pos === 'bottom' ? `linear-gradient(to top, rgba(0,0,0,${op}), transparent)`
    : `linear-gradient(to bottom, transparent, rgba(0,0,0,${op}), transparent)`

  const posStyle = bgType === 'solid'
    ? { top: 0, left: 0, right: 0, bottom: 0 }
    : pos === 'top' ? { top: 0, left: 0, right: 0, height: '45%' }
    : pos === 'bottom' ? { bottom: 0, left: 0, right: 0, height: '45%' }
    : { top: '25%', left: 0, right: 0, height: '50%' }

  return (
    <div style={{
      position: 'absolute', ...posStyle, background: bgStyle,
      display: 'flex',
      alignItems: pos === 'top' ? 'flex-start' : pos === 'bottom' ? 'flex-end' : 'center',
      justifyContent: 'center',
      padding: `${mm(22)}px ${mm(12)}px`,
    }}>
      <span style={{
        fontFamily: "'Cormorant', Georgia, serif",
        fontSize, color: 'white', fontWeight: '400',
        letterSpacing: '0.03em', textAlign: 'center', lineHeight: 1.3,
        textShadow,
      }}>{text}</span>
    </div>
  )
}

export function PDFExportContainer({ order, allPages, answers }: {
  order: Order
  allPages: Array<{ type: 'question' | 'custom', data: any }>
  answers: Record<string, string>
}) {
  return (
    <div
      id="pdf-export-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        opacity: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      {allPages.map((page, i) => {
        const isLeft = i % 2 === 0
        const pageNum = i + 2
        const question = page.type === 'question' ? page.data : null
        const customPage = page.type === 'custom' ? page.data : null
        const answer = question
          ? (answers[question.id] || '')
          : (customPage?.photo_path || customPage?.text_content || '')

        return (
          <PDFPage
            key={i}
            question={question}
            customPage={customPage}
            answer={answer}
            pageNum={pageNum}
            bookTitle={order.book_title}
            isLeft={isLeft}
          />
        )
      })}
    </div>
  )
}
