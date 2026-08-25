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

/** 8s total budget for a poster load, split across two fetch() attempts
 *  (see IMAGE_LOAD_ATTEMPTS) plus a final <img>-tag fallback — a hard
 *  ceiling so a slow/hanging load can never stall the whole card
 *  indefinitely, without this, a poster that never resolves would leave
 *  the "Making…" button spinning forever with nothing to show. */
const IMAGE_LOAD_TIMEOUT_MS = 8_000
/** Real-device testing (see loadImage's own doc comment) showed a single
 *  fetch() attempt failing with a bare "Failed to fetch" TypeError — the
 *  generic signature of a transient mobile-network blip — for a poster
 *  loaded on its own (a single-movie card), while a grid of 6 posters
 *  loaded moments earlier in the same session succeeded outright. One
 *  retry is cheap and matches the pattern api/ai.ts's tmdbGetJson already
 *  uses for the exact same class of intermittent connection reset. */
const IMAGE_LOAD_ATTEMPTS = 2
const IMAGE_LOAD_ATTEMPT_TIMEOUT_MS = IMAGE_LOAD_TIMEOUT_MS / IMAGE_LOAD_ATTEMPTS

/**
 * TEMPORARY DIAGNOSTIC — safe to delete once real-device poster-load
 * failures are understood and fixed. Server logs show nothing about this
 * (the card renders entirely client-side, in the browser, never touching
 * a Vercel function), and a phone's devtools console usually isn't
 * reachable without USB debugging — so the actual failure reason is drawn
 * directly onto the failed poster's placeholder panel, visible right in
 * the resulting screenshot/share. Flip this to `false` (or delete the two
 * `drawPosterPlaceholder` call sites' debug-message argument, and this
 * flag, and the on-canvas branch inside drawPosterPlaceholder itself) once
 * done — nothing else depends on it.
 */
export const DEBUG_POSTER_FAILURES_ON_CARD = true

/** One fetch() attempt: a real HTTP status on a non-2xx, and a
 *  distinguishable timeout vs. network/CORS TypeError on failure — see
 *  loadImage's own doc comment for why this replaced a plain `<img
 *  crossorigin src>` in the first place. */
async function fetchImageBlob(src: string): Promise<Blob> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_LOAD_ATTEMPT_TIMEOUT_MS)
  try {
    const response = await fetch(src, { signal: controller.signal, mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.blob()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Timed out after ${IMAGE_LOAD_ATTEMPT_TIMEOUT_MS / 1000}s`)
    }
    if (err instanceof TypeError) {
      // The Fetch spec deliberately doesn't distinguish "blocked by CORS"
      // from "genuine network failure" in the TypeError it throws (that
      // distinction would itself leak cross-origin information) — this is
      // as precise as the platform allows, but it's still real signal:
      // narrows the cause to "never got a response at all", ruling out a
      // bad/missing poster (which would show as an HTTP status instead).
      throw new Error(`Network/CORS error: ${err.message}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function decodeBlobAsImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob)
  const decode = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Downloaded but failed to decode as an image'))
    img.src = objectUrl
  })
  // The Image has its own decoded bitmap once onload fires, so the object
  // URL is safe to revoke as soon as the promise settles either way — no
  // delayed revoke needed here (unlike shareOrDownloadCard's download
  // link, which a browser may still be reading from asynchronously after
  // click()).
  return decode.finally(() => URL.revokeObjectURL(objectUrl))
}

/** Last-resort fallback after every fetch() attempt has failed: a plain
 *  `<img crossorigin src>` load. Worth trying on its own merits, not just
 *  as a formality — it has different failure characteristics than a
 *  strict CORS-mode fetch() (notably, it can be served straight from the
 *  browser's own HTTP image cache even when a fresh network request hit a
 *  transient blip), so it can succeed in exactly the case that motivated
 *  this whole retry chain. Whatever this raises is discarded by the
 *  caller in favour of the original fetch() failure reason, which is more
 *  diagnostic (an HTTP status or a distinguishable timeout/network error,
 *  vs. this path's single opaque "error" event).
 */
function loadImageViaImgTagFallback(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => reject(new Error('<img> fallback timed out')), IMAGE_LOAD_ATTEMPT_TIMEOUT_MS)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('<img> fallback also failed'))
    }
    img.src = src
  })
}

/**
 * Loads an image via fetch() + an object URL rather than setting `<img
 * crossorigin src>` directly, retrying once, then falling back to the
 * `<img>` approach as a last resort. Two real reasons for fetch() first,
 * not just style:
 *
 * 1. Diagnosis. An <img>'s onerror event carries NO detail at all — a 404,
 *    a CORS block, and a genuine network failure all fire the identical
 *    bare "error" event, which is exactly why an earlier version's
 *    console.error could only ever say "Failed to load <url>" and nothing
 *    about WHY. fetch()'s Response exposes the real HTTP status on a
 *    non-2xx, and a network/CORS failure throws a distinguishable
 *    TypeError — actual signal instead of a shrug.
 * 2. Safety. A blob: URL is always same-origin, so there is no tainted-
 *    canvas risk at all (a plain `<img crossorigin>` load relies on TMDB's
 *    CDN choosing to keep sending permissive CORS headers) — canvas.
 *    toBlob() can never fail for that reason on the fetch() path.
 *
 * The retry + <img> fallback exist because real-device testing showed
 * fetch() alone failing with "Failed to fetch" (a transient network blip,
 * not a genuine block — see IMAGE_LOAD_ATTEMPTS' own comment) for a
 * single-movie card's one poster load, moments after a 6-poster grid
 * succeeded outright in the same session.
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  let lastError: unknown
  for (let attempt = 1; attempt <= IMAGE_LOAD_ATTEMPTS; attempt += 1) {
    try {
      return await decodeBlobAsImage(await fetchImageBlob(src))
    } catch (err) {
      lastError = err
    }
  }
  try {
    return await loadImageViaImgTagFallback(src)
  } catch {
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

/**
 * Drawn wherever a poster image genuinely couldn't be loaded — a themed
 * panel with a visible outline, not just a flat theme.surface fill. Bug
 * found via an actual rendered screenshot: theme.surface sits close enough
 * to theme.bg's own gradient that an unbordered fallback panel read as
 * empty/blank rather than as a deliberate placeholder, which is exactly
 * what made a real image-load failure indistinguishable from "nothing
 * rendered at all". The border makes the box's presence obvious regardless
 * of how close the fill happens to sit to the background.
 */
function drawPosterPlaceholder(
  ctx: CanvasRenderingContext2D,
  theme: ShareCardTheme,
  x: number,
  y: number,
  w: number,
  h: number,
  /** TEMPORARY — see DEBUG_POSTER_FAILURES_ON_CARD's doc comment. The
   *  actual loadImage() failure reason (e.g. "HTTP 404", "Timed out after
   *  8s", "Network/CORS error: Failed to fetch"), drawn inside the
   *  placeholder when the flag is on. Undefined/ignored once removed. */
  debugMessage?: string,
) {
  roundedRectPath(ctx, x, y, w, h, POSTER_RADIUS)
  ctx.fillStyle = theme.surface
  ctx.fill()
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 2
  roundedRectPath(ctx, x + 1, y + 1, w - 2, h - 2, POSTER_RADIUS)
  ctx.stroke()

  if (DEBUG_POSTER_FAILURES_ON_CARD && debugMessage) {
    ctx.save()
    roundedRectPath(ctx, x, y, w, h, POSTER_RADIUS)
    ctx.clip()
    ctx.fillStyle = theme.accentWarm
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const pad = 10
    const debugFontSize = 13
    ctx.font = `600 ${debugFontSize}px "Manrope"`
    const lines = wrapText(ctx, debugMessage, w - pad * 2, 10)
    lines.forEach((line, i) => ctx.fillText(line, x + pad, y + pad + i * (debugFontSize + 4)))
    ctx.restore()
  }
}

/**
 * Shrinks `text` (in 2px steps down to `minSize`) until it fits `maxWidth`
 * under the given font, then truncates with an ellipsis as a last resort
 * if even the minimum size doesn't fit. Used for every single-line string
 * on a card — stat line, verdict, taste badge, and the footer's share URL
 * — none of which previously had any width check at all, so a longer than
 * typical AI-generated line (or a long share URL, which has no spaces to
 * wrap on) simply ran off the right edge of the canvas.
 *
 * Sets ctx.font/ctx.fillStyle are the CALLER's responsibility beforehand
 * for colour; this function owns ctx.font's size/weight/family only, since
 * it has to keep re-measuring as it shrinks.
 */
function fitSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  family: string,
  startSize: number,
  minSize: number,
  maxWidth: number,
): { text: string; size: number } {
  let size = startSize
  ctx.font = `${weight} ${size}px "${family}"`
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = `${weight} ${size}px "${family}"`
  }
  let fitted = text
  if (ctx.measureText(fitted).width > maxWidth) {
    while (fitted.length > 1 && ctx.measureText(`${fitted}…`).width > maxWidth) {
      fitted = fitted.slice(0, -1)
    }
    fitted = `${fitted}…`
  }
  return { text: fitted, size }
}

/**
 * Greedy word-wrap into at most `maxLines` lines that each fit `maxWidth`
 * under ctx's CURRENT font (caller sets it beforehand and doesn't change
 * it between calling this and drawing the returned lines). If the text
 * doesn't fit within maxLines, the last line is ellipsized and anything
 * past it is dropped — "readable and complete, capped at a sane length"
 * beats guaranteeing every word shows on a card meant to be glanced at.
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word
    if (line && ctx.measureText(attempt).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = attempt
    }
  }
  if (line) lines.push(line)

  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines)
    let last = truncated[maxLines - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1)
    }
    truncated[maxLines - 1] = `${last}…`
    return truncated
  }
  return lines
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
function drawFooter(ctx: CanvasRenderingContext2D, theme: ShareCardTheme, y: number, shareUrl?: string, marginX = 64) {
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
  // Strip the protocol — nobody needs to read "https://" on a shared image.
  // Shrunk-to-fit rather than drawn raw: a share URL has no spaces to wrap
  // on, so an unusually long token previously just ran off both edges of
  // the canvas — see fitSingleLine's own doc comment.
  const linkText = shareUrl ? shareUrl.replace(/^https?:\/\//, '') : 'Try Popcorn'
  const fitted = fitSingleLine(ctx, linkText, 700, 'Manrope', 22, 15, WIDTH - marginX * 2)
  ctx.textAlign = 'center'
  ctx.fillText(fitted.text, WIDTH / 2, y + 80)
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

  // BUG FIX: a failed poster load previously produced `null` and the draw
  // loop below just skipped it — no log, no placeholder, nothing drawn.
  // Verified against an actual rendered screenshot with every poster URL
  // failing: the result was indistinguishable from "the grid never
  // rendered at all", which is exactly the reported bug. Every failure is
  // now logged with its URL, and drawPosterPlaceholder below makes a
  // failed tile visibly a deliberate placeholder rather than empty space.
  const images = await Promise.all(
    posters.slice(0, GRID_COLS * GRID_ROWS).map(async (poster) => {
      try {
        return { img: await loadImage(poster.url), error: null as string | null }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`Watchlist card: poster failed to load for "${poster.title}" (${poster.url}):`, err)
        return { img: null, error: `${poster.title}: ${message}` }
      }
    }),
  )

  let lastRowBottom = gridTop
  images.forEach(({ img, error }, index) => {
    const col = index % GRID_COLS
    const row = Math.floor(index / GRID_COLS)
    const x = marginX + col * (cellW + gap)
    const y = gridTop + row * (cellH + gap)
    if (img) {
      ctx.save()
      roundedRectPath(ctx, x, y, cellW, cellH, POSTER_RADIUS)
      ctx.clip()
      ctx.drawImage(img, x, y, cellW, cellH)
      ctx.restore()
    } else {
      drawPosterPlaceholder(ctx, theme, x, y, cellW, cellH, error ?? undefined)
    }
    lastRowBottom = Math.max(lastRowBottom, y + cellH)
  })

  // Stat line, then the optional verdict/badge lines — each its own row,
  // in the same quiet muted tone, so a missing verdict (e.g. the cache
  // migration hasn't run yet, or the caller opted out) just tightens the
  // gap to the footer instead of leaving a blank line. Every line is
  // shrunk-to-fit (fitSingleLine) rather than drawn raw — none of these
  // previously had any width check, so an unusually long AI-generated
  // verdict/badge could run off the canvas edge.
  const textMaxWidth = WIDTH - marginX * 2
  ctx.fillStyle = theme.muted
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  let cursorY = lastRowBottom + 56
  ctx.fillText(fitSingleLine(ctx, statLine, 600, 'Manrope', 28, 18, textMaxWidth).text, WIDTH / 2, cursorY)

  if (verdict) {
    cursorY += 42
    ctx.fillStyle = theme.text
    ctx.textAlign = 'center'
    ctx.fillText(fitSingleLine(ctx, verdict, 500, 'Manrope', 24, 16, textMaxWidth).text, WIDTH / 2, cursorY)
  }
  if (badge) {
    cursorY += verdict ? 38 : 42
    ctx.fillStyle = theme.accentWarm
    ctx.textAlign = 'center'
    ctx.fillText(fitSingleLine(ctx, badge, 600, 'Manrope', 22, 15, textMaxWidth).text, WIDTH / 2, cursorY)
  }

  drawFooter(ctx, theme, cursorY + 34, shareUrl, marginX)

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
  //
  // BUG FIX: this used to size the poster purely from the available WIDTH
  // (full margin-to-margin, times 1.5 for the 2:3 ratio) with no regard for
  // how much canvas HEIGHT was actually left afterward. At full width that
  // poster is 1428px tall — on the default 'story' canvas (1920px) that
  // left title/tagline/footer starting past y=1968, off the bottom of a
  // 1920px canvas entirely (and far worse on 'classic', 1440px). They were
  // being drawn, just outside the canvas — invisible, which read as "the
  // card is blank" even though the poster itself mostly fit. Fixed by
  // capping the poster's height to whatever room is actually left after
  // reserving fixed space for two title lines + tagline + footer, and
  // narrowing (not stretching) the poster width to match — still a true
  // 2:3 crop, just smaller and centered, never distorted.
  const posterTop = eyebrowY + 28
  const fullWidthPosterW = WIDTH - marginX * 2
  const maxWidth = WIDTH - marginX * 2
  const TITLE_LINE_HEIGHT = 58
  const TITLE_MAX_LINES = 2
  const TAGLINE_LINE_HEIGHT = 36
  // tagline can be a full sentence (a Pick For Me reason, "the product"
  // per ResultCard's own comment) — worth real word-wrap, not a shrink or
  // a truncation that would cut off the actual recommendation text.
  const TAGLINE_MAX_LINES = 3
  // Reserved for the MAX case (2 title lines + 3 tagline lines), not
  // however many lines this specific call happens to need — a poster
  // sized off an optimistic estimate is exactly how the previous overflow
  // bug happened. Title lines + gap + tagline lines + gap + footer
  // (divider + two lines) + a bottom safety margin.
  const RESERVED_BELOW_POSTER =
    TITLE_MAX_LINES * TITLE_LINE_HEIGHT + 48 + TAGLINE_MAX_LINES * TAGLINE_LINE_HEIGHT + 40 + 80 + 40
  const maxPosterH = canvas.height - posterTop - RESERVED_BELOW_POSTER
  const posterH = Math.min(fullWidthPosterW * 1.5, Math.max(maxPosterH, 200))
  const posterW = posterH / 1.5
  const posterX = marginX + (fullWidthPosterW - posterW) / 2
  try {
    const img = await loadImage(poster.url)
    ctx.save()
    roundedRectPath(ctx, posterX, posterTop, posterW, posterH, POSTER_RADIUS)
    ctx.clip()
    ctx.drawImage(img, posterX, posterTop, posterW, posterH)
    ctx.restore()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Single-movie card: poster failed to load for "${poster.title}" (${poster.url}):`, err)
    // No poster image reachable — draw a visible placeholder (see
    // drawPosterPlaceholder's own doc comment on why an unbordered fill
    // alone read as "nothing rendered" in an actual screenshot) so the
    // card still renders something coherent rather than failing.
    drawPosterPlaceholder(ctx, theme, posterX, posterTop, posterW, posterH, `${poster.title}: ${message}`)
  }

  // Title — word-wrapped up to TITLE_MAX_LINES, same helper the grid
  // card's text uses, rather than the ad-hoc inline loop this used to be.
  ctx.fillStyle = theme.text
  ctx.font = '700 52px "Space Grotesk"'
  ctx.textAlign = 'left'
  const titleLines = wrapText(ctx, poster.title, maxWidth, TITLE_MAX_LINES)
  let cursorY = posterTop + posterH + 64
  titleLines.forEach((line, i) => {
    if (i > 0) cursorY += TITLE_LINE_HEIGHT
    ctx.fillText(line, marginX, cursorY)
  })

  // Tagline — previously drawn as one unwrapped line, which ran a longer
  // rating verdict or Pick For Me reason straight off the right edge of
  // the canvas (confirmed via an actual rendered screenshot). Now wrapped
  // the same way as the title.
  cursorY += 48
  ctx.fillStyle = theme.muted
  ctx.font = '500 26px "Manrope"'
  const taglineLines = wrapText(ctx, tagline, maxWidth, TAGLINE_MAX_LINES)
  taglineLines.forEach((line, i) => {
    if (i > 0) cursorY += TAGLINE_LINE_HEIGHT
    ctx.fillText(line, marginX, cursorY)
  })

  drawFooter(ctx, theme, cursorY + 40, shareUrl, marginX)

  return canvasToBlob(canvas)
}

export type ShareCardOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/**
 * Tries the Web Share API with the PNG file first (native share sheet,
 * matching the pattern share.ts already uses for rating shares); falls
 * back to triggering a browser download when navigator.share/canShare
 * isn't available or doesn't accept files (desktop Safari/Firefox, most
 * desktop browsers generally).
 *
 * A silent fall-through to download also happens on a THIRD case that
 * isn't about capability at all: navigator.share() requires an active
 * "user activation" from the click that started this whole async chain,
 * and Chromium's activation window is a fixed ~5s from that click — not
 * from whenever this function happens to run. On a real device this threw
 * NotAllowedError (not AbortError) whenever the caller's own async work
 * (watchlist fetch, share-token creation, an AI verdict call, poster image
 * loads) ate enough of that budget, and the error was being swallowed here
 * with no logging at all — which is exactly why it looked like "share is
 * just downloading instead" with nothing to go on. Now logged by name, and
 * see ShareWatchlistCard.tsx's handleShare for the actual latency fix
 * (parallelizing + capping the slow steps so this budget isn't blown).
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
        console.error(
          'navigator.share() failed, falling back to download:',
          err instanceof DOMException ? `${err.name}: ${err.message}` : err,
        )
        // Fall through to download rather than reporting failure outright.
      }
    } else {
      console.error('navigator.canShare({files}) returned false — falling back to download.')
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
