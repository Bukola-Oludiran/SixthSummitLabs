import Reveal from './Reveal'
import { audiences } from '../site.config'
import './Audiences.css'

export default function Audiences() {
  return (
    <section className="section section--bordered audiences">
      <div className="shell audiences__grid">
        <Reveal>
          <div className="eyebrow">04 — Who we climb with</div>
          <h2 className="audiences__title">Three kinds of people call us.</h2>
          <p className="audiences__lede">
            If you recognise yourself here, the first call will be a short one.
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
