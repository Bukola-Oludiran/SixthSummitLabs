import Reveal from './Reveal'
import useNearViewport from '../hooks/useNearViewport'
import { eraCarousel, eras } from '../site.config'
import './EraCarousel.css'

function Slide({ era, duplicate, loaded }) {
  return (
    <figure className="era__slide" aria-hidden={duplicate || undefined}>
      <div className="era__frame">
        <img
          className="era__img"
          src={loaded ? era.image : undefined}
          alt={duplicate ? '' : `${era.place}, ${era.year} — ${era.age}`}
          width="900"
          height="600"
          draggable="false"
        />
        <span className="era__tint" />
      </div>

      <figcaption className="era__caption">
        <span className="era__year">{era.year}</span>
        <span className="era__age">{era.age}</span>
        <span className="era__place">{era.place}</span>
      </figcaption>
    </figure>
  )
}

/**
 * Vertical carousel of city views, one per technological age, 1572 to 2012.
 *
 * The track holds the sequence twice and slides up by exactly half its height,
 * so the second copy lands where the first began and the loop never seams. That
 * makes the motion pure CSS — no scroll listener, no timer, no JS at all.
 *
 * The duplicate run is hidden from assistive tech so the timeline is announced
 * once rather than twice.
 *
 * Sources are attached when the section approaches rather than via
 * `loading="lazy"`. Native lazy loading judges an image by its position in the
 * document, but these slides sit thousands of pixels down inside a clipped,
 * animated track — the browser reads them as far off-screen and leaves them
 * unloaded while they are visibly cycling past. Watching the section instead
 * keeps the images off the initial page load without ever showing a blank.
 */
export default function EraCarousel() {
  const [sectionRef, loaded] = useNearViewport('700px')

  return (
    <section
      ref={sectionRef}
      className="era section--bordered"
      aria-labelledby="era-title"
    >
      <div className="era__glow" aria-hidden="true" />

      <div className="shell era__inner">
        <Reveal className="era__head">
          <div className="eyebrow">{eraCarousel.eyebrow}</div>
          <h2 id="era-title" className="era__title">
            {eraCarousel.title}
          </h2>
          <p className="era__body">{eraCarousel.body}</p>
        </Reveal>

        <div className="era__viewport">
          <div className="era__track">
            {eras.map((era) => (
              <Slide key={era.id} era={era} loaded={loaded} />
            ))}
            {eras.map((era) => (
              <Slide key={`${era.id}-dup`} era={era} loaded={loaded} duplicate />
            ))}
          </div>
        </div>
      </div>

      <p className="era__credit">
        {eraCarousel.creditPrefix}{' '}
        <a href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer noopener">
          Wikimedia Commons
        </a>
      </p>
    </section>
  )
}
