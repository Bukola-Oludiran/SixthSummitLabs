import Reveal from './Reveal'
import ImageSlot from './ImageSlot'
import { images, projects } from '../site.config'
import './Work.css'

export default function Work() {
  const anySlotEmpty = projects.some((project) => !images[project.slot])

  return (
    <section id="work" className="section section--bordered">
      <div className="shell">
        <div className="section-head work__head">
          <Reveal>
            <div className="eyebrow">02 — Selected work</div>
            <h2 className="section-title work__title">Built, launched, still running.</h2>
          </Reveal>
          <a href="#contact" className="work__portfolio-link">
            Ask for the full portfolio →
          </a>
        </div>

        <div className="work__grid">
          {projects.map((project, i) => (
            <Reveal as="article" key={project.slot} index={i} className="work__card">
              <div className="work__shot">
                <ImageSlot
                  src={images[project.slot]}
                  alt={project.name}
                  hint={project.slotHint}
                />
              </div>

              <div className="work__body">
                <div className="work__tags">
                  <span className="work__kind">{project.kind}</span>
                  <span className="work__year">{project.year}</span>
                </div>
                <h3 className="work__name">{project.name}</h3>
                <p className="work__copy">{project.body}</p>
                <div className="work__footer">
                  <span className="work__result mono-label">{project.result}</span>
                  <span className="work__stack">{project.stack}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {anySlotEmpty && (
          <p className="work__note">
            Add screenshots in <code>src/site.config.js</code> to replace the placeholders.
          </p>
        )}
      </div>
    </section>
  )
}
