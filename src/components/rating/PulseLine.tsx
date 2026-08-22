import { useEffect, useRef } from 'react'
import { buildPulsePath, pulseSpeed } from '../../lib/ratingScale'

const WIDTH = 320
const HEIGHT = 36

interface PulseLineProps {
  score: number
  /** Animate only while the slider is focused or being dragged. */
  active: boolean
  color: string
  reducedMotion: boolean
}

export function PulseLine({ score, active, color, reducedMotion }: PulseLineProps) {
  const pathRef = useRef<SVGPathElement>(null)
  // The animation loop reads the score from a ref so that dragging doesn't
  // tear down and restart the loop (which would reset the wave's phase) on
  // every step.
  const scoreRef = useRef(score)
  scoreRef.current = score

  useEffect(() => {
    if (reducedMotion || !active) return

    let frame = 0
    const started = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - started) / 1000
      const current = scoreRef.current
      pathRef.current?.setAttribute('d', buildPulsePath(current, elapsed * pulseSpeed(current), WIDTH, HEIGHT))
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, reducedMotion])

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-9 w-full"
    >
      <path
        ref={pathRef}
        // Static resting shape. While the loop is running it overwrites
        // this attribute directly each frame.
        d={buildPulsePath(score, 0, WIDTH, HEIGHT)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  )
}
