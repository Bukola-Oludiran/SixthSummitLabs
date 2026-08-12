import { useEffect, useRef, useState } from 'react'

/**
 * Reports when an element gets within `rootMargin` of the viewport, once.
 *
 * Used to decide when to attach image sources for content that native lazy
 * loading can't judge correctly — see EraCarousel.
 *
 * Returns `[ref, near]`: attach `ref` to the element you're watching, and
 * `near` flips to true when it approaches and stays true afterwards.
 */
export default function useNearViewport(rootMargin = '600px') {
  const ref = useRef(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!('IntersectionObserver' in window)) {
      setNear(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return [ref, near]
}
