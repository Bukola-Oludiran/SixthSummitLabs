import { useLayoutEffect } from 'react'

/**
 * Cut visible text lines out of the colour reveal. Only the reveal is masked:
 * the original blue artwork beneath it keeps painting normally, with no added
 * surface or shadow. Geometry changes refresh the mask; pointer moves do not.
 */
export default function useLensTextMask() {
  useLayoutEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const root = document.documentElement
    const containers = [...document.querySelectorAll('.header, .page')]
    const moving = new Map()
    let nodes = []
    let frame = null
    let disposed = false
    let lastMask = ''

    const collect = () => {
      nodes = []
      for (const container of containers) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          if (node.textContent.trim() && !node.parentElement.closest(
            '[aria-hidden="true"], [inert], .visually-hidden, script, style, svg',
          )) nodes.push(node)
        }
      }
    }

    const update = () => {
      frame = null
      if (disposed) return
      const width = window.innerWidth
      const height = window.innerHeight
      const holes = []
      const range = document.createRange()
      const visibility = new Map()
      for (const node of nodes) {
        if (!node.isConnected) continue
        const parent = node.parentElement
        if (!visibility.has(parent)) visibility.set(parent, getComputedStyle(parent).visibility === 'visible')
        if (!visibility.get(parent)) continue
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue
          // Tight line protection, including descenders and a little breathing
          // room. Adjacent lines can overlap naturally without darkening them.
          const x = Math.max(0, Math.floor(rect.left - 5))
          const y = Math.max(0, Math.floor(rect.top - 3))
          const right = Math.min(width, Math.ceil(rect.right + 5))
          const bottom = Math.min(height, Math.ceil(rect.bottom + 3))
          holes.push(`<rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" rx="3"/>`)
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<defs><mask id="copy" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">` +
        `<rect width="100%" height="100%" fill="white"/><g fill="black">${holes.join('')}</g></mask></defs>` +
        '<rect width="100%" height="100%" fill="white" mask="url(#copy)"/></svg>'
      const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
      if (mask !== lastMask) {
        root.style.setProperty('--lens-text-mask', mask)
        lastMask = mask
      }
      if (moving.size) schedule()
    }
    const schedule = () => {
      if (!disposed && frame === null) frame = requestAnimationFrame(update)
    }
    const refresh = () => { collect(); schedule() }

    // Follow transformed text during entrance and card-hover transitions, then
    // stop measuring when they settle. Backdrop animation never enters here.
    const motion = (event) => {
      if (!event.target.closest?.('.header, .page')) return
      const animation = event.type.startsWith('animation')
      if (animation ? event.animationName !== 'ssRise' : event.propertyName !== 'transform') return
      const key = animation ? `animation:${event.animationName}` : 'transform'
      const started = ['animationstart', 'transitionrun'].includes(event.type)
      if (started) {
        if (!moving.has(event.target)) moving.set(event.target, new Set())
        moving.get(event.target).add(key)
      } else {
        moving.get(event.target)?.delete(key)
        if (!moving.get(event.target)?.size) moving.delete(event.target)
      }
      schedule()
    }
    const events = ['animationstart', 'animationend', 'animationcancel', 'transitionrun', 'transitionend', 'transitioncancel']
    for (const event of events) document.addEventListener(event, motion, true)
    const observer = new MutationObserver(refresh)
    for (const container of containers) observer.observe(container, { childList: true, characterData: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    for (const container of containers) resize.observe(container)
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('load', schedule, true)
    document.fonts.addEventListener('loadingdone', schedule)
    document.fonts.ready.then(schedule)
    collect()
    update()

    return () => {
      disposed = true
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      for (const event of events) document.removeEventListener(event, motion, true)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('load', schedule, true)
      document.fonts.removeEventListener('loadingdone', schedule)
      root.style.removeProperty('--lens-text-mask')
    }
  }, [])
}
