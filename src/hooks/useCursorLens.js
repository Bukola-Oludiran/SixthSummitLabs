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
 * Drives the cursor reveal over the era backdrop — a pixelated torch.
 *
 * Publishes three custom properties on the root element — the mask, its
 * position, and an on/off flag — which `.backdrop__reveal` consumes. Only the
 * two position values change as the pointer moves, so a move costs one style
 * write per frame and no React work at all.
 *
 * The guttering comes from two independent axes. `flare` is how far the light
 * reaches: it walks with momentum, sweeping out and back so the pool breathes.
 * The fringe is a separate set of variants at each flare level, and a different
 * one is chosen every tick.
 *
 * Keeping those axes separate is what stops the flame stalling. When flare and
 * fringe were the same axis, the walk could land back on the frame it just
 * left — freezing the edge for a tick — and revisiting any earlier frame
 * reproduced its fringe exactly, so the edge appeared to flick between two
 * fixed poses. Now the fringe never repeats within three ticks regardless of
 * what flare does, so the mask changes on every single tick.
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
  variants = 4,
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
    const spread = Math.max(1, variants)

    // masks[flare][fringe] — one row per reach, several fringe cuts per row.
    const masks = Array.from({ length: count }, (_, i) => {
      const flare = count < 2 ? flareMax : flareMin + (i / (count - 1)) * (flareMax - flareMin)
      return Array.from({ length: spread }, () => buildLensMask({ size, tile, coreRatio, flare }))
    })

    root.style.setProperty('--lens-mask', masks[count - 1][0])
    root.classList.add('has-lens')

    const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let frame = null
    let timer = null
    let flareIndex = count - 1
    let direction = -1
    let recentFringe = [0]
    let visible = false
    let x = 0
    let y = 0

    /** Any fringe cut except the last couple used, so no pose repeats quickly. */
    const nextFringe = () => {
      const avoid = recentFringe.slice(-Math.min(2, spread - 1))
      const pool = []
      for (let i = 0; i < spread; i += 1) if (!avoid.includes(i)) pool.push(i)
      const pick = pool[Math.floor(Math.random() * pool.length)]
      recentFringe = [...recentFringe, pick].slice(-2)
      return pick
    }

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
      if (visible && !stillMotion.matches) {
        // Momentum: mostly carry on in the same direction, occasionally turn.
        // A flame sweeps out and back; re-rolling the direction every tick just
        // jitters in place.
        if (Math.random() < 0.28) direction *= -1
        flareIndex += direction * (Math.random() < 0.22 ? 2 : 1)

        // Bounce off each end, turning the walk around with it. Wrapping would
        // snap straight from the widest reach to the narrowest.
        const last = count - 1
        if (flareIndex < 0) {
          flareIndex = Math.min(last, -flareIndex)
          direction = 1
        } else if (flareIndex > last) {
          flareIndex = Math.max(0, 2 * last - flareIndex)
          direction = -1
        }

        root.style.setProperty('--lens-mask', masks[flareIndex][nextFringe()])
      }
      // Uneven spacing — a fixed interval reads as a strobe, not a flame.
      timer = setTimeout(gutter, shimmerMs * (0.6 + Math.random() * 0.9))
    }

    if (count > 1 || spread > 1) timer = setTimeout(gutter, shimmerMs)

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
  }, [tileRem, sizeRem, coreRatio, frames, variants, flareMin, flareMax, shimmerMs])
}
