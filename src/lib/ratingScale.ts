// Pure maths for the rating slider's live reactions. No React, no DOM —
// the colours themselves are read from CSS variables by the caller (see
// useRatingColors) so all three themes stay correct and nothing here
// hardcodes a hex value.

export interface Rgb {
  r: number
  g: number
  b: number
}

/** The exact verdict words from CLAUDE.md, indexed by score - 1. */
export const VERDICTS = [
  'Never again',
  'Regret it',
  'Weak',
  'Meh',
  'Fine',
  'Decent',
  'Solid',
  'Really good',
  'Loved it',
  'All-timer',
] as const

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function verdictFor(score: number): string {
  return VERDICTS[clamp(Math.round(score), 1, 10) - 1]
}

/** Parses the value of a CSS custom property (hex or rgb()) into components. */
export function parseCssColor(value: string): Rgb {
  const raw = value.trim()

  if (raw.startsWith('#')) {
    const hex = raw.length === 4 ? raw.slice(1).replace(/./g, (c) => c + c) : raw.slice(1)
    const n = Number.parseInt(hex, 16)
    if (Number.isNaN(n)) return { r: 128, g: 128, b: 128 }
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }

  const match = raw.match(/rgba?\(([^)]+)\)/)
  if (match) {
    const [r = 128, g = 128, b = 128] = match[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { r, g, b }
  }

  return { r: 128, g: 128, b: 128 }
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

/**
 * Interpolates cold (1) -> neutral (5) -> warm (10) in RGB space.
 *
 * RGB rather than HSL deliberately: cold is a blue and warm is an orange,
 * which sit on opposite sides of the hue wheel, so an HSL sweep would
 * travel through unrelated greens or magentas. Pivoting through the
 * desaturated neutral in RGB keeps every intermediate step on the
 * cold -> grey -> warm line the design actually describes.
 */
export function interpolateScoreColor(score: number, cold: Rgb, neutral: Rgb, warm: Rgb): Rgb {
  const s = clamp(score, 1, 10)
  return s <= 5 ? mix(cold, neutral, (s - 1) / 4) : mix(neutral, warm, (s - 5) / 5)
}

export function rgbString({ r, g, b }: Rgb): string {
  return `rgb(${r} ${g} ${b})`
}

export function rgbaString({ r, g, b }: Rgb, alpha: number): string {
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

export interface PosterReaction {
  filter: string
  transform: string
  boxShadow: string
  /** Opacity of the warm bloom sitting behind the poster (0 below score 8). */
  glowOpacity: number
}

/**
 * Continuous poster reaction. Every term is a smooth ramp rather than a
 * per-band lookup, so dragging moves through the bands rather than
 * snapping between them:
 *   1-3  greyscale, tilted away, dimmed
 *   4-6  neutral
 *   7-8  saturation returns, slight scale-up and lift
 *   9-10 larger scale-up plus the warm bloom fading in
 */
export function posterReaction(score: number | null): PosterReaction {
  if (score === null) {
    return { filter: 'none', transform: 'none', boxShadow: 'none', glowOpacity: 0 }
  }

  const s = clamp(score, 1, 10)
  const low = clamp((4 - s) / 3, 0, 1) // 1 at score 1, 0 from score 4 up
  const high = clamp((s - 6) / 2, 0, 1) // 0 up to score 6, 1 from score 8 up

  const grayscale = low
  const opacity = 1 - low * 0.35
  const saturate = 1 + high * 0.2
  const tilt = -low * 6
  const lift = -high * 8
  const scale = s <= 6 ? 1 : s <= 8 ? 1 + ((s - 6) / 2) * 0.03 : 1.03 + ((s - 8) / 2) * 0.05
  const glowOpacity = clamp((s - 8) / 2, 0, 1)

  return {
    filter: `grayscale(${grayscale.toFixed(3)}) saturate(${saturate.toFixed(3)}) opacity(${opacity.toFixed(3)})`,
    transform: `translateY(${lift.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
    boxShadow: high > 0 ? `0 ${(high * 18).toFixed(1)}px ${(high * 36).toFixed(1)}px rgb(0 0 0 / ${(high * 0.45).toFixed(3)})` : 'none',
    glowOpacity,
  }
}

export type ReleaseEffect = 'bloom' | 'shake' | null

/** 9-10 blooms, 1-2 shakes, everything between just settles. */
export function releaseEffectFor(score: number): ReleaseEffect {
  if (score >= 9) return 'bloom'
  if (score <= 2) return 'shake'
  return null
}

/**
 * Traveling waveform for the pulse line. Amplitude and frequency both
 * scale with the score, so it reads flat and slow at 1 and tall and rapid
 * at 10. sin cubed keeps the baseline flatter and the peaks narrower than
 * a plain sine, giving it the EKG character CLAUDE.md asks for while
 * staying cheap enough to rebuild every frame.
 */
export function buildPulsePath(score: number, phase: number, width: number, height: number): string {
  const mid = height / 2
  const intensity = clamp((score - 1) / 9, 0, 1)
  const amplitude = 1 + intensity * (mid - 3)
  const cycles = 1 + intensity * 5
  const steps = 96

  let path = ''
  for (let i = 0; i <= steps; i += 1) {
    const progress = i / steps
    const x = progress * width
    const theta = progress * cycles * Math.PI * 2 + phase
    const y = mid - amplitude * Math.sin(theta) ** 3
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}${i < steps ? ' ' : ''}`
  }
  return path
}

/** Radians per second the waveform travels at, for a given score. */
export function pulseSpeed(score: number): number {
  return 1.2 + clamp((score - 1) / 9, 0, 1) * 5.5
}
