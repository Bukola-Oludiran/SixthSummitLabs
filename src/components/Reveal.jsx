import { useLayoutEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Fades and lifts its children into view once they cross the viewport.
 *
 * Anything already on screen at mount is shown immediately — only content the
 * visitor scrolls to gets animated. `index` staggers siblings by 70ms each,
 * capped at 5 so long lists don't develop a visible lag at the tail.
 */
export default function Reveal({
  as: Tag = 'div',
  index = 0,
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const alreadyInView = el.getBoundingClientRect().top < window.innerHeight - 60
    if (alreadyInView || prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: `${Math.min(index, 5) * 70}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
