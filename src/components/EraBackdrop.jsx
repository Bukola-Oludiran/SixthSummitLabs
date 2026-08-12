import { useEffect, useState } from 'react'
import { eras } from '../site.config'
import './EraBackdrop.css'

/**
 * Columns of the era sequence, each starting at a different point in history
 * and travelling at its own pace, so the three never line up into a visible
 * grid. Speeds are deliberately close — the drift between them is what stops
 * the motion reading as a single sliding sheet.
 */
const COLUMNS = [
  { offset: 0, speed: 128 },
  { offset: 3, speed: 164 },
  { offset: 5, speed: 146 },
]

const rotate = (list, n) => [...list.slice(n), ...list.slice(0, n)]

/**
 * Ambient page backdrop: city views from 1572 to 2012 rising continuously
 * behind every section.
 *
 * Fixed to the viewport rather than placed in the document, so it sits under
 * all content and keeps moving regardless of where the visitor has scrolled.
 * It is decorative and inert — `aria-hidden` and `pointer-events: none` keep it
 * out of both the accessibility tree and the hit-testing path.
 *
 * Sources attach on the first effect rather than during render, which lets the
 * hero paint before ~600KB of imagery starts downloading. `fetchpriority="low"`
 * keeps it from competing with fonts and the initial bundle.
 */
export default function EraBackdrop() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__cols">
        {COLUMNS.map((column) => {
          const sequence = rotate(eras, column.offset)

          return (
            <div
              key={column.offset}
              className="backdrop__col"
              style={{ '--speed': `${column.speed}s` }}
            >
              {/* Rendered twice: the track travels -50%, landing the second run
                  exactly where the first began. */}
              <div className="backdrop__track">
                {[...sequence, ...sequence].map((era, i) => (
                  <div className="backdrop__slide" key={`${era.id}-${i}`}>
                    <img
                      className="backdrop__img"
                      src={ready ? era.image : undefined}
                      alt=""
                      width="900"
                      height="600"
                      fetchPriority="low"
                      draggable="false"
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* One tint and one scrim for the whole layer — cheaper than compositing
          a blend element per slide. */}
      <div className="backdrop__tint" />
      <div className="backdrop__scrim" />
    </div>
  )
}
