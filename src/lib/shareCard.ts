/**
 * Canvas render of Popcorn's shareable cards — the watchlist grid, the
 * "Most Buried" grid, and single-movie cards (a 9-or-10 rating, a Pick For
 * Me result) — themed to whatever theme is active when it's generated. Pure
 * canvas/DOM work, no React, same separation as ratingScale.ts's pure maths.
 */

export interface ShareCardTheme {
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  accentWarm: string
  hero: string
}

export interface ShareCardPoster {
  url: string
  title: string
}

/** Reads the live CSS custom properties for whichever theme is currently
 *  active, with sane nightcap-theme fallbacks for any that somehow resolve
 *  empty. Shared by every share-card entry point (ShareWatchlistCard,
 *  ShareSingleMovieButton) so the fallback palette only has to be defined
 *  once. */
export function readShareCardTheme(): ShareCardTheme {
  const styles = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    bg: get('--bg', '#161211'),
    surface: get('--surface', '#211b19'),
    border: get('--border', '#3a2e29'),
    text: get('--text', '#f2e9de'),
    muted: get('--muted', '#a89a8c'),
    accentWarm: get('--accent-warm', '#d4a24c'),
    hero: get('--hero', '#c8442d'),
  }
}

/** 'story' (9:16, Instagram/WhatsApp Stories) is the primary/default format
 *  per the share-card brief — 'classic' (3:4, closer to a square feed post)
 *  stays available as the secondary option in the share UI's format
 *  toggle. Both share the same WIDTH so the grid math below only has to
 *  branch on height. */
export type ShareCardAspect = 'story' | 'classic'

const WIDTH = 1080
const CLASSIC_HEIGHT = 1440
const STORY_HEIGHT = 1920

function heightFor(aspect: ShareCardAspect): number {
  return aspect === 'story' ? STORY_HEIGHT : CLASSIC_HEIGHT
}

/** Story is taller than classic at the same width. Rather than re-deriving
 *  every layout number per aspect, the whole classic-tuned composition is
 *  shifted down by roughly half the extra height (a little more than half,
 *  to clear Stories' own reply-bar/profile chrome near the top) and the
 *  rest is left as natural bottom margin — both safe-zone padding Stories
 *  viewers expect anyway. */
function topPadFor(aspect: ShareCardAspect): number {
  return aspect === 'story' ? (STORY_HEIGHT - CLASSIC_HEIGHT) * 0.55 : 0
}

// Six, not nine — three-by-two leaves the title and footer real room
// instead of the grid competing with them for space (live-review redesign,
// which added both).
const GRID_COLS = 3
const GRID_ROWS = 2
// --radius-poster is 12px against a ~130px-wide UI card (about a 9%
// ratio) — this canvas draws posters far larger, so the radius is scaled
// up to read as the same proportional rounding rather than a literal 12px,
// which would look almost square at this size.
const POSTER_RADIUS = 22

// The exact path from layout/Logo.tsx's KernelMark — one shape, drawn on
// canvas via Path2D instead of re-approximated by hand, so the wordmark on
// the card is recognisably the same mark as everywhere else in the app.
const KERNEL_PATH =
  'M13.5 4.2c-2.1.4-3.6 2-3.6 3.9 0 .5.1.9.3 1.3-2.5.7-4.3 2.6-4.3 4.9 0 .9.3 1.7.8 2.4L5.1 26.1c-.1.9.6 1.7 1.6 1.7h1.9l1-9.4a1 1 0 0 1 2 .2l-1 9.2h2.2l.6-9.6a1 1 0 0 1 2 .1l-.6 9.5h2.1l-.2-9.6a1 1 0 0 1 2-.1l.3 9.7h2l-1-9.4a1 1 0 0 1 2-.2l1 9.6h1.8c1 0 1.7-.8 1.6-1.7l-1.6-9.4c.5-.7.8-1.5.8-2.4 0-2.3-1.8-4.2-4.3-4.9.2-.4.3-.8.3-1.3 0-2.1-1.9-3.8-4.3-3.8-1 0-2 .3-2.7.9-.6-.5-1.5-.8-2.4-.8Z'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // TMDB's image CDN sends CORS headers permissively, so this doesn't
    // taint the canvas — required for canvas.toBlob() to work at all with
    // a cross-origin source image.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function loadCardFonts() {
  await Promise.all([
    document.fonts.load('700 52px "Space Grotesk"'),
    document.fonts.load('700 40px "Space Grotesk"'),
    document.fonts.load('600 28px "Manrope"'),
    document.fonts.load('500 22px "Manrope"'),
  ]).catch(() => {
    // Font loading can fail (offline, slow network) — canvas text just
    // falls back to a system sans-serif in that case, not a hard failure.
  })
}

/** Wordmark: gradient kernel box + "Popcorn", the same recipe as
 *  layout/Logo.tsx's <Logo />. Returns the y-coordinate just below it, so
 *  callers can stack the next element without re-deriving markY/markSize. */
function drawWordmark(ctx: CanvasRenderingContext2D, theme: ShareCardTheme, marginX: number, topPad: number): number {
  const markY = 64 + topPad
  const markSize = 64
  const kernelGradient = ctx.createLinearGradient(marginX, markY, marginX + markSize, markY + markSize)
  kernelGradient.addColorStop(0, theme.hero)
  kernelGradient.addColorStop(1, theme.accentWarm)
  ctx.fillStyle = kernelGradient
  roundedRectPath(ctx, marginX, markY, markSize, markSize, 14)
  ctx.fill()

  ctx.save()
  ctx.translate(marginX + markSize / 2 - 16, markY + markSize / 2 - 16)
  ctx.fillStyle = theme.bg
  ctx.fill(new Path2D(KERNEL_PATH))
  ctx.restore()

  ctx.fillStyle = theme.text
  ctx.font = '700 40px "Space Grotesk"'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('Popcorn', marginX + markSize + 20, markY + markSize / 2 + 2)

  return markY + markSize
}

/** The footer shared by every card type: a thin divider, the tagline, and
 *  the live public link (or a static invite when there isn't one — the
 *  single-movie cards below always have one for the caller's own film, but
 *  keeping the fallback means this stays reusable if that ever changes).
 *  Returns nothing; draws from `y` downward. */
function drawFooter(ctx: CanvasRenderingContext2D, theme: ShareCardTheme, y: number, shareUrl?: string) {
  const dividerWidth = 160
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - dividerWidth / 2, y)
  ctx.lineTo(WIDTH / 2 + dividerWidth / 2, y)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = theme.muted
  ctx.font = '500 24px "Manrope"'
  ctx.fillText('Decide what to watch, faster.', WIDTH / 2, y + 44)

  ctx.fillStyle = theme.accentWarm
  ctx.font = '700 22px "Manrope"'
  // Strip the protocol — nobody needs to read "https://" on a shared image.
  ctx.fillText(shareUrl ? shareUrl.replace(/^https?:\/\//, '') : 'Try Popcorn', WIDTH / 2, y + 80)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not export the card as an image.'))
    }, 'image/png')
  })
}

/** Renders the watchlist-grid card (also reused for "Most Buried" — same
 *  layout, a different poster pool/title/statLine) and resolves with a PNG
 *  Blob. Throws if canvas or any poster image genuinely can't be produced —
 *  callers decide how to surface that.
 *
 *  `title` is the card's headline — "My Watchlist"/"{name}'s Watchlist" for
 *  the watchlist grid, "My Graveyard" for Most Buried; the caller decides
 *  which (never the account's email — see ShareWatchlistCard's own
 *  reasoning on that). `verdict` is the optional AI-generated one-line
 *  description (mode:'verdict'); `badge` is the optional self-relative
 *  taste stat — both drawn between the grid and the footer when present. */
export async function renderShareCard(
  posters: ShareCardPoster[],
  theme: ShareCardTheme,
  title: string,
  statLine: string,
  /** The public /w/{token} link (see lib/shareLink.ts) — drawn in place of
   *  the old static "Try Popcorn" line, so the card itself carries a live
   *  path back into the app rather than just naming it. Optional so this
   *  function still works for the Most Buried card, which has no
   *  whole-watchlist link that makes sense to show (it isn't the live
   *  want-list the public page reflects). */
  shareUrl?: string,
  verdict?: string | null,
  badge?: string | null,
  aspect: ShareCardAspect = 'story',
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = heightFor(aspect)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  await loadCardFonts()

  const topPad = topPadFor(aspect)

  // Subtle themed background — a diagonal wash from --bg into --surface,
  // not a flat fill, so the card reads as designed rather than a plain
  // colour swatch. Still uses only the two darkest/base theme tokens, so
  // it stays quiet behind the posters rather than competing with them.
  const backgroundGradient = ctx.createLinearGradient(0, 0, WIDTH, canvas.height)
  backgroundGradient.addColorStop(0, theme.bg)
  backgroundGradient.addColorStop(1, theme.surface)
  ctx.fillStyle = backgroundGradient
  ctx.fillRect(0, 0, WIDTH, canvas.height)

  const marginX = 64
  const wordmarkBottom = drawWordmark(ctx, theme, marginX, topPad)

  // Title — the card's actual headline, sized and weighted well past the
  // wordmark so it reads as the point of the image, not a caption on it.
  const titleY = wordmarkBottom + 76
  ctx.fillStyle = theme.text
  ctx.font = '700 52px "Space Grotesk"'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText(title, marginX, titleY)

  // Poster grid — tightened gutters and a consistent margin matching the
  // wordmark/title's own left edge, corners rounded so thumbnails read as
  // designed tiles rather than a raw screenshot strip.
  const gap = 16
  const gridTop = titleY + 48
  const cellW = (WIDTH - marginX * 2 - gap * (GRID_COLS - 1)) / GRID_COLS
  const cellH = cellW * 1.5

  const images = await Promise.all(
    posters.slice(0, GRID_COLS * GRID_ROWS).map(async (poster) => {
      try {
        return await loadImage(poster.url)
      } catch {
        return null
      }
    }),
  )

  let lastRowBottom = gridTop
  images.forEach((img, index) => {
    if (!img) return
    const col = index % GRID_COLS
    const row = Math.floor(index / GRID_COLS)
    const x = marginX + col * (cellW + gap)
    const y = gridTop + row * (cellH + gap)
    ctx.save()
    roundedRectPath(ctx, x, y, cellW, cellH, POSTER_RADIUS)
    ctx.clip()
    ctx.drawImage(img, x, y, cellW, cellH)
    ctx.restore()
    lastRowBottom = Math.max(lastRowBottom, y + cellH)
  })

  // Stat line, then the optional verdict/badge lines — each its own row,
  // in the same quiet muted tone, so a missing verdict (e.g. the cache
  // migration hasn't run yet, or the caller opted out) just tightens the
  // gap to the footer instead of leaving a blank line.
  ctx.fillStyle = theme.muted
  ctx.font = '600 28px "Manrope"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  let cursorY = lastRowBottom + 56
  ctx.fillText(statLine, WIDTH / 2, cursorY)

  if (verdict) {
    cursorY += 42
    ctx.font = '500 24px "Manrope"'
    ctx.fillStyle = theme.text
    ctx.fillText(verdict, WIDTH / 2, cursorY)
  }
  if (badge) {
    cursorY += verdict ? 38 : 42
    ctx.font = '600 22px "Manrope"'
    ctx.fillStyle = theme.accentWarm
    ctx.fillText(badge, WIDTH / 2, cursorY)
  }

  drawFooter(ctx, theme, cursorY + 34, shareUrl)

  return canvasToBlob(canvas)
}

/**
 * Single-movie card — a 9-or-10 rating or a Pick For Me result, poster-led
 * rather than a grid since there's exactly one film to show. `tagline` is
 * the caption under the title: the verdict word ("All-timer") for a rating
 * share, or the pick's own one-line reason for a Pick For Me share — the
 * caller decides which, this function just draws whatever string it's
 * given.
 */
export async function renderSingleMovieCard(
  poster: ShareCardPoster,
  theme: ShareCardTheme,
  eyebrow: string,
  tagline: string,
  shareUrl?: string,
  aspect: ShareCardAspect = 'story',
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = heightFor(aspect)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  await loadCardFonts()

  const topPad = topPadFor(aspect)
  const marginX = 64

  const backgroundGradient = ctx.createLinearGradient(0, 0, WIDTH, canvas.height)
  backgroundGradient.addColorStop(0, theme.bg)
  backgroundGradient.addColorStop(1, theme.surface)
  ctx.fillStyle = backgroundGradient
  ctx.fillRect(0, 0, WIDTH, canvas.height)

  const wordmarkBottom = drawWordmark(ctx, theme, marginX, topPad)

  ctx.fillStyle = theme.accentWarm
  ctx.font = '700 24px "Manrope"'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const eyebrowY = wordmarkBottom + 56
  ctx.fillText(eyebrow.toUpperCase(), marginX, eyebrowY)

  // One large poster — the point of this card. Cropped to a fixed 2:3
  // (TMDB's own poster ratio) so a portrait source image never distorts.
  const posterTop = eyebrowY + 28
  const posterW = WIDTH - marginX * 2
  const posterH = posterW * 1.5
  try {
    const img = await loadImage(poster.url)
    ctx.save()
    roundedRectPath(ctx, marginX, posterTop, posterW, posterH, POSTER_RADIUS)
    ctx.clip()
    ctx.drawImage(img, marginX, posterTop, posterW, posterH)
    ctx.restore()
  } catch {
    // No poster image reachable — draw a plain themed panel with the title
    // so the card still renders something coherent rather than failing.
    roundedRectPath(ctx, marginX, posterTop, posterW, posterH, POSTER_RADIUS)
    ctx.fillStyle = theme.surface
    ctx.fill()
  }

  const titleY = posterTop + posterH + 64
  ctx.fillStyle = theme.text
  ctx.font = '700 52px "Space Grotesk"'
  ctx.textAlign = 'left'
  // Long titles wrap onto a second line rather than overflowing the card —
  // a simple greedy word-wrap is enough here since this is at most two
  // lines in practice.
  const words = poster.title.split(' ')
  let line = ''
  let lineY = titleY
  const maxWidth = WIDTH - marginX * 2
  const lineHeight = 58
  let linesDrawn = 0
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word
    if (ctx.measureText(attempt).width > maxWidth && line) {
      ctx.fillText(line, marginX, lineY)
      line = word
      lineY += lineHeight
      linesDrawn += 1
      if (linesDrawn >= 2) break
    } else {
      line = attempt
    }
  }
  if (linesDrawn < 2 && line) ctx.fillText(line, marginX, lineY)

  ctx.fillStyle = theme.muted
  ctx.font = '500 26px "Manrope"'
  const taglineY = lineY + 48
  ctx.fillText(tagline, marginX, taglineY)

  drawFooter(ctx, theme, taglineY + 40, shareUrl)

  return canvasToBlob(canvas)
}

export type ShareCardOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/**
 * Tries the Web Share API with the PNG file first (native share sheet,
 * matching the pattern share.ts already uses for rating shares); falls
 * back to triggering a browser download when navigator.share/canShare
 * isn't available or doesn't accept files (desktop Safari/Firefox, most
 * desktop browsers generally).
 */
export async function shareOrDownloadCard(
  blob: Blob,
  filename = 'popcorn-watchlist.png',
  /** The public /w/{token} link, when there is one — passed alongside the
   *  image so a share target that supports it (not all do, when files are
   *  also present) gives the recipient a tappable link, not just a
   *  picture of one. */
  url?: string,
): Promise<ShareCardOutcome> {
  const file = new File([blob], filename, { type: 'image/png' })

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: 'My Popcorn Watchlist', url })
        return 'shared'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
        // Fall through to download rather than reporting failure outright.
      }
    }
  }

  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoked on a delay rather than immediately after click() — some
    // browsers start the download asynchronously, and revoking the object
    // URL too early can cancel it before it's actually read.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
