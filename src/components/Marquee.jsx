import { marqueeItems } from '../site.config'
import './Marquee.css'

function Track({ ariaHidden }) {
  return (
    <div className="marquee__track" aria-hidden={ariaHidden || undefined}>
      {marqueeItems.map((item) => (
        <span key={item} className="marquee__item">
          <span>{item}</span>
          <span className="marquee__sep">◆</span>
        </span>
      ))}
    </div>
  )
}

/**
 * Scrolling capability strip.
 *
 * The track is rendered twice inside a 200%-wide row and shifted by exactly
 * -50%, so the second copy lands where the first began and the loop is seamless.
 * The duplicate is hidden from screen readers to avoid announcing it twice.
 */
export default function Marquee() {
  return (
    <div className="marquee">
      <div className="marquee__rail">
        <Track />
        <Track ariaHidden />
      </div>
    </div>
  )
}
