import { useEffect } from 'react'

/**
 * Builds one frame of the lens mask: a disc of square tiles, solid in the
 * middle and dissolving into scattered tiles at the rim.
 *
 * The falloff is squared so tiles thin out quickly once past the solid core —
 * a linear ramp leaves too many stragglers at the outer edge and the fringe
 * reads as a soft blur rather than a dither.
 *
 * `flare` scales how far the light reaches. Frames are built across a range of
 * flare values; walking between them is what makes the pool of light gutter.
 *
 * Returned as an SVG data URI so it can be handed straight to `mask-image`.
 */
function buildLensMask({ size, tile, coreRatio, flare }) {
  const cells = Math.ceil(size / tile)
  const centre = size / 2
  const outer = (size / 2) * flare
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
 * Reflects an index back inside `0..n-1` instead of wrapping it.
 *
 * Wrapping would jump straight from the widest frame to the narrowest, which
 * snaps; bouncing off each end keeps the flare walking through neighbouring
 * values.
 */
function reflect(index, n) {
  if (n < 2) return 0
  const period = 2 * (n - 1)
  const m = ((index % period) + period) % period
  return m < n ? m : period - m
}

/**
 * Drives the cursor reveal over the era backdrop — a pixelated torch.
 *
 * Publishes three custom properties on the root element — the mask, its
 * position, and an on/off flag — which `.backdrop__reveal` consumes. Only the
 * two position values change as the pointer moves, so a move costs one style
 * write per frame and no React work at all.
 *
 * The guttering comes from two things happening at once. Frames are built
 * across a range of `flare` values, so the pool of light reaches further in
 * some than others; and each frame randomises its own fringe tiles. Walking
 * between neighbouring frames on a jittered interval makes the light breathe
 * and its edge crackle, rather than strobing between unrelated shapes on a
 * metronome.
 *
 * Skipped entirely on coarse pointers: there is no cursor to follow on a
 * touchscreen, and the layer stays hidden rather than sitting stuck wherever
 * the last tap landed.
 */
export default function useCursorLens({
  tileRem = 2,
  sizeRem = 26,
  coreRatio = 0.58,
  frames = 12,
  // Scalars rather than a [min, max] tuple: a fresh array literal would change
  // identity on every render and rebuild the whole mask set each time.
  flareMin = 0.84,
  flareMax = 1,
  shimmerMs = 110,
} = {}) {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const root = document.documentElement
    const rootFontSize = parseFloat(getComputedStyle(root).fontSize) || 16
    const tile = tileRem * rootFontSize
    // Snapped to whole tiles so the disc never ends on a clipped square.
    const size = Math.round((sizeRem * rootFontSize) / tile) * tile

    const count = Math.max(1, frames)
    const masks = Array.from({ length: count }, (_, i) =>
      buildLensMask({
        size,
        tile,
        coreRatio,
        flare: count < 2 ? flareMax : flareMin + (i / (count - 1)) * (flareMax - flareMin),
      }),
    )

    root.style.setProperty('--lens-mask', masks[masks.length - 1])
    root.classList.add('has-lens')

    const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let frame = null
    let timer = null
    let current = masks.length - 1
    let visible = false
    let x = 0
    let y = 0

    const onMove = (event) => {
      x = event.clientX
      y = event.clientY
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = null
        visible = true
        root.style.setProperty('--lens-x', `${x - size / 2}px`)
        root.style.setProperty('--lens-y', `${y - size / 2}px`)
        root.style.setProperty('--lens-on', '1')
      })
    }

    const onLeave = () => {
      visible = false
      root.style.setProperty('--lens-on', '0')
    }

    /*
     * A flickering edge is exactly what reduced-motion asks us not to do, so
     * that preference holds the flame still. Both it and `visible` are checked
     * per tick rather than at setup, so a mid-session change takes effect and
     * an off-screen lens costs nothing.
     */
    const gutter = () => {
      if (visible && masks.length > 1 && !stillMotion.matches) {
        const step = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.22 ? 2 : 1)
        current = reflect(current + step, masks.length)
        root.style.setProperty('--lens-mask', masks[current])
      }
      // Uneven spacing — a fixed interval reads as a strobe, not a flame.
      timer = setTimeout(gutter, shimmerMs * (0.6 + Math.random() * 0.9))
    }

    timer = setTimeout(gutter, shimmerMs)

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      root.classList.remove('has-lens')
      root.style.removeProperty('--lens-mask')
      root.style.removeProperty('--lens-x')
      root.style.removeProperty('--lens-y')
      root.style.removeProperty('--lens-on')
    }
  }, [tileRem, sizeRem, coreRatio, frames, flareMin, flareMax, shimmerMs])
}
