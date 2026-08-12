import { useEffect } from 'react'

/**
 * Builds the lens mask: a disc of square tiles, solid in the middle and
 * dissolving into scattered tiles at the rim.
 *
 * The falloff is squared so tiles thin out quickly once past the solid core —
 * a linear ramp leaves too many stragglers at the outer edge and the fringe
 * reads as a soft blur rather than a dither.
 *
 * Returned as an SVG data URI so it can be handed straight to `mask-image`.
 * It is generated once and then only repositioned, so the pattern is stable
 * while the cursor moves.
 */
function buildLensMask({ size, tile, coreRatio }) {
  const cells = Math.ceil(size / tile)
  const centre = size / 2
  const outer = size / 2
  const core = outer * coreRatio
  const rects = []

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const x = col * tile
      const y = row * tile
      const distance = Math.hypot(x + tile / 2 - centre, y + tile / 2 - centre)

      if (distance > outer) continue

      if (distance > core) {
        const falloff = 1 - (distance - core) / (outer - core)
        if (Math.random() > falloff * falloff) continue
      }

      rects.push(`<rect x="${x}" y="${y}" width="${tile}" height="${tile}"/>`)
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<g fill="#fff">${rects.join('')}</g></svg>`

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * Drives the cursor reveal over the era backdrop.
 *
 * Publishes three custom properties on the root element — the mask itself, its
 * position, and an on/off flag — which `.backdrop__reveal` consumes. Only the
 * two position values change as the pointer moves, so a move costs one style
 * write per frame rather than any React work.
 *
 * Skipped entirely on coarse pointers: there is no cursor to follow on a
 * touchscreen, and the layer stays hidden rather than sitting stuck wherever
 * the last tap landed.
 */
export default function useCursorLens({ tileRem = 2, sizeRem = 26, coreRatio = 0.58 } = {}) {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const root = document.documentElement
    const rootFontSize = parseFloat(getComputedStyle(root).fontSize) || 16
    const tile = tileRem * rootFontSize
    // Snapped to whole tiles so the disc never ends on a clipped square.
    const size = Math.round((sizeRem * rootFontSize) / tile) * tile

    root.style.setProperty('--lens-mask', buildLensMask({ size, tile, coreRatio }))
    root.classList.add('has-lens')

    let frame = null
    let x = 0
    let y = 0

    const onMove = (event) => {
      x = event.clientX
      y = event.clientY
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = null
        root.style.setProperty('--lens-x', `${x - size / 2}px`)
        root.style.setProperty('--lens-y', `${y - size / 2}px`)
        root.style.setProperty('--lens-on', '1')
      })
    }

    const onLeave = () => root.style.setProperty('--lens-on', '0')

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      root.classList.remove('has-lens')
      root.style.removeProperty('--lens-mask')
      root.style.removeProperty('--lens-x')
      root.style.removeProperty('--lens-y')
      root.style.removeProperty('--lens-on')
    }
  }, [tileRem, sizeRem, coreRatio])
}
