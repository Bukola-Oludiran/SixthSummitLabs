import Reveal from './Reveal'
import ImageSlot from './ImageSlot'
import { ArrowRight } from './icons'
import { contact, images, settings } from '../site.config'
import './Contact.css'

export default function Contact() {
  const plateFilled = Boolean(images.ctaMountain)
  const mailto = `mailto:${settings.email}`

  return (
    <section
      id="contact"
      className={`contact${plateFilled ? ' contact--plate-filled' : ''}`}
    >
      <div className="contact__backdrop" aria-hidden="true">
        <div
          className={`contact__plate${plateFilled ? ' is-filled' : ''}`}
          data-depth="0.10"
        >
          <ImageSlot src={images.ctaMountain} alt="" hint="Drop a second engraving — optional" />
        </div>
        <div className="contact__scrim" />
      </div>

      <div className="contact__glow" aria-hidden="true" />

      <Reveal className="contact__inner">
        <div className="contact__badge">
          <span className="contact__badge-dot" />
          <span className="contact__badge-text">{contact.badge}</span>
        </div>

        <h2 className="contact__title">{contact.title}</h2>
        <p className="contact__body">{contact.body}</p>

        <div className="contact__actions">
          <a href={mailto} className="btn btn--primary btn--lg">
            {settings.ctaLabel}
            <ArrowRight size={16} />
          </a>
          <a href={mailto} className="btn btn--ghost btn--lg">
            {settings.email}
          </a>
        </div>
      </Reveal>
    </section>
  )
}
