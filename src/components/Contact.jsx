import Reveal from './Reveal'
import { ArrowRight } from './icons'
import { contact, settings } from '../site.config'
import './Contact.css'

export default function Contact() {
  const mailto = `mailto:${settings.email}`

  return (
    <section id="contact" className="contact">
      <div className="contact__scrim" aria-hidden="true" />
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
