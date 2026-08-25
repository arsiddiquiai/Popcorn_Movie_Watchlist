/**
 * Canvas render of a shareable watchlist card — top posters plus the
 * Popcorn wordmark, themed to whatever theme is active when it's
 * generated. Pure canvas/DOM work, no React, same separation as
 * ratingScale.ts's pure maths.
 */

export interface ShareCardTheme {
  bg: string
  surface: string
  text: string
  muted: string
  accentWarm: string
  hero: string
}

export interface ShareCardPoster {
  url: string
  title: string
}

const WIDTH = 1080
const HEIGHT = 1350

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

/** Renders the card and resolves with a PNG Blob. Throws if canvas or any
 *  poster image genuinely can't be produced — callers decide how to
 *  surface that. */
export async function renderShareCard(
  posters: ShareCardPoster[],
  theme: ShareCardTheme,
  statLine: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')

  // Custom web fonts have to actually be loaded into the document's font
  // set before canvas text will use them — otherwise it silently falls
  // back to a system font.
  await Promise.all([
    document.fonts.load('700 40px "Space Grotesk"'),
    document.fonts.load('600 28px "Manrope"'),
  ]).catch(() => {
    // Font loading can fail (offline, slow network) — canvas text just
    // falls back to a system sans-serif in that case, not a hard failure.
  })

  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Wordmark: gradient kernel box + "Popcorn", the same recipe as
  // layout/Logo.tsx's <Logo />.
  const markX = 64
  const markY = 64
  const markSize = 64
  const gradient = ctx.createLinearGradient(markX, markY, markX + markSize, markY + markSize)
  gradient.addColorStop(0, theme.hero)
  gradient.addColorStop(1, theme.accentWarm)
  ctx.fillStyle = gradient
  roundedRectPath(ctx, markX, markY, markSize, markSize, 14)
  ctx.fill()

  ctx.save()
  ctx.translate(markX + markSize / 2 - 16, markY + markSize / 2 - 16)
  ctx.fillStyle = theme.bg
  ctx.fill(new Path2D(KERNEL_PATH))
  ctx.restore()

  ctx.fillStyle = theme.text
  ctx.font = '700 40px "Space Grotesk"'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText('Popcorn', markX + markSize + 20, markY + markSize / 2 + 2)

  // Poster grid.
  const cols = 3
  const gap = 20
  const marginX = 64
  const gridTop = 200
  const cellW = (WIDTH - marginX * 2 - gap * (cols - 1)) / cols
  const cellH = cellW * 1.5

  const images = await Promise.all(
    posters.map(async (poster) => {
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
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = marginX + col * (cellW + gap)
    const y = gridTop + row * (cellH + gap)
    ctx.save()
    roundedRectPath(ctx, x, y, cellW, cellH, 16)
    ctx.clip()
    ctx.drawImage(img, x, y, cellW, cellH)
    ctx.restore()
    lastRowBottom = Math.max(lastRowBottom, y + cellH)
  })

  ctx.fillStyle = theme.muted
  ctx.font = '600 28px "Manrope"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(statLine, WIDTH / 2, lastRowBottom + 56)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not export the card as an image.'))
    }, 'image/png')
  })
}

export type ShareCardOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/**
 * Tries the Web Share API with the PNG file first (native share sheet,
 * matching the pattern share.ts already uses for rating shares); falls
 * back to triggering a browser download when navigator.share/canShare
 * isn't available or doesn't accept files (desktop Safari/Firefox, most
 * desktop browsers generally).
 */
export async function shareOrDownloadCard(blob: Blob, filename = 'popcorn-watchlist.png'): Promise<ShareCardOutcome> {
  const file = new File([blob], filename, { type: 'image/png' })

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: 'My Popcorn Watchlist' })
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
