import { useEffect } from 'react'

/**
 * Drives the depth effect on the hero ridge and the CTA plate.
 *
 * Elements opt in with `data-depth="0.42"` — higher values drift further as the
 * page scrolls. Adding `data-scale` also grows the element by up to 7%.
 *
 * Layers inside the hero (`#ss-ridge`) track raw scroll position, since they
 * start at the top of the document. Layers further down track their own
 * distance from the fold instead, so they only begin moving once they approach
 * the viewport rather than arriving already displaced.
 *
 * Writes are batched into a single rAF callback so a fast scroll can't queue up
 * more style recalculations than the browser can paint.
 */
export default function useParallax() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ridge = document.getElementById('ss-ridge')
    if (!ridge) return

    const layers = Array.from(document.querySelectorAll('[data-depth]'))
    let frame = null

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = null
        const y = window.scrollY || 0
        const vh = window.innerHeight || 1

        layers.forEach((layer) => {
          const depth = parseFloat(layer.getAttribute('data-depth')) || 0
          const inHero = ridge.contains(layer)
          const progress = inHero ? y : y - (layer.getBoundingClientRect().top + y - vh)
          const shift = -Math.max(inHero ? 0 : -vh, progress) * depth
          const scale = layer.hasAttribute('data-scale') ? 1 + Math.min(y / vh, 1) * 0.07 : 1

          layer.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`
        })

        ridge.style.opacity = String(Math.max(0.15, 1 - y / (vh * 1.5)))
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
}
