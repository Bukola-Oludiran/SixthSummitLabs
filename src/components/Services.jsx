import Reveal from './Reveal'
import { ArrowRight } from './icons'
import { services } from '../site.config'
import './Services.css'

export default function Services() {
  return (
    <section id="services" className="section section--bordered">
      <div className="shell">
        <div className="section-head">
          <Reveal>
            <div className="eyebrow">01 — What we build</div>
            <h2 className="section-title">Five things. All of them shipped.</h2>
          </Reveal>
          <Reveal as="p" index={1} className="section-lede">
            No discovery theatre, no 90-page decks. Every engagement ends with software in
            production.
          </Reveal>
        </div>

        <div className="services__grid">
          {services.map((service, i) => (
            <Reveal key={service.num} index={i} className="services__card">
              <div className="services__card-top">
                <span className="services__num">{service.num}</span>
                <span className="services__tag">{service.tag}</span>
              </div>
              <h3 className="services__title">{service.title}</h3>
              <p className="services__body">{service.body}</p>
              <div className="services__meta mono-label">{service.meta}</div>
            </Reveal>
          ))}

          <div className="services__card services__card--cta">
            <svg
              className="services__card-ridge"
              viewBox="0 0 320 200"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <g fill="none" stroke="var(--ridge-line)" strokeWidth="1">
                <path d="M-10 200 L70 96 L120 140 L180 70 L250 138 L330 200" />
                <path
                  d="M-10 200 L84 130 L140 168 L210 112 L270 160 L330 200"
                  stroke="rgba(127, 176, 255, 0.14)"
                />
              </g>
            </svg>
            <div className="services__card-cta-body">
              <h3 className="services__title">Not sure which one?</h3>
              <p className="services__body">
                Bring the idea. We&rsquo;ll tell you the smallest thing worth building.
              </p>
              <a href="#contact" className="link-arrow">
                Book an intro call
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
