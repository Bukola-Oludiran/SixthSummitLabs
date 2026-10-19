import Reveal from './Reveal'
import { audiences, sectionCopy } from '../site.config'
import './Audiences.css'

export default function Audiences() {
  return (
    <section className="section section--bordered audiences">
      <div className="shell audiences__grid">
        <Reveal>
          <div className="eyebrow">{sectionCopy.audiences.eyebrow}</div>
          <h2 className="audiences__title">{sectionCopy.audiences.title}</h2>
          <p className="audiences__lede">
            {sectionCopy.audiences.body}
          </p>
        </Reveal>

        <div className="audiences__list">
          {audiences.map((audience, i) => (
            <Reveal key={audience.num} index={i} className="audiences__row">
              <span className="audiences__num">{audience.num}</span>
              <div>
                <div className="audiences__row-title">{audience.title}</div>
                <p className="audiences__row-body">{audience.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
