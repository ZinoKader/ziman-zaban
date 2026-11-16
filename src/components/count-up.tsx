import { animate, MotionGlobalConfig, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useState } from 'react'

/** Counts from 0 to `value` once, after `delay` seconds. */
export function CountUp({ value, format = String, delay = 0 }: { value: number; format?: (n: number) => string; delay?: number }) {
  const still = useReducedMotion()
  const [shown, setShown] = useState(value)
  useLayoutEffect(() => {
    if (still || MotionGlobalConfig.skipAnimations || value === 0) return setShown(value)
    setShown(0)
    const controls = animate(0, value, {
      duration: Math.min(1.1, 0.5 + value / 100),
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => setShown(Math.round(n)),
      onComplete: () => setShown(value),
    })
    return () => controls.stop()
  }, [value, delay, still])
  return <>{format(shown)}</>
}
