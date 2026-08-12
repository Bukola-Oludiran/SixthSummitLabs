import Reveal from './Reveal'
import { principles, steps } from '../site.config'
import './Process.css'

export default function Process() {
  return (
    <section id="route" className="section section--bordered process">
      <div className="process__glow" aria-hidden="true" />

      <div className="shell process__inner">
        <Reveal className="process__head">
          <div className="eyebrow">03 — The route</div>
          <h2 className="section-title process__title">Four camps between here and live.</h2>
        </Reveal>

        <div className="process__steps">
          {steps.map((step, i) => (
            <Reveal key={step.title} index={i} className="process__step">
              <div className="process__when">
                <span className="process__dot" />
                <span className="process__when-label">{step.when}</span>
              </div>
              <h3 className="process__step-title">{step.title}</h3>
              <p className="process__step-body">{step.body}</p>
              <div className="process__out">{step.out}</div>
            </Reveal>
          ))}
        </div>

        <Reveal className="process__principles">
          {principles.map((principle) => (
            <div key={principle.title} className="process__principle">
              <div className="process__principle-title">{principle.title}</div>
              <p className="process__principle-body">{principle.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
