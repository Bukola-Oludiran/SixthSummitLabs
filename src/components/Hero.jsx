import ImageSlot from './ImageSlot'
import { ArrowRight } from './icons'
import { hero, images, settings } from '../site.config'
import './Hero.css'

export default function Hero() {
  const plateFilled = Boolean(images.heroMountain)

  return (
    <section id="top" className="hero">
      <div className="hero__glow" aria-hidden="true" />

      <div id="ss-ridge" className="hero__ridge" aria-hidden="true">
        {/* Drifts slowly and grows a touch as the page scrolls — see useParallax. */}
        <div
          className={`hero__plate${plateFilled ? ' is-filled' : ''}`}
          data-depth="0.22"
          data-scale=""
        >
          <ImageSlot
            src={images.heroMountain}
            alt=""
            hint="Drop a Renaissance mountain engraving — grayscale is applied automatically"
          />
        </div>

        <div className="hero__scrim" />
        <div className="hero__bloom" />

        <div className="hero__lines" data-depth="0.42">
          <svg viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" stroke="var(--ridge-line)" strokeWidth="1">
              <path d="M-40 420 Q300 300 720 336 T1480 300" pathLength="1" strokeDasharray="1" />
              <path d="M-40 420 Q320 336 740 366 T1480 340" pathLength="1" strokeDasharray="1" />
              <path d="M-40 420 Q340 372 760 396 T1480 380" pathLength="1" strokeDasharray="1" />
            </g>
          </svg>
        </div>
      </div>

      <div className="hero__content">
        <h1 className="hero__headline">
          {hero.headline.map((line) => (
            <span key={line} className="hero__headline-line">
              {line}
            </span>
          ))}
          <span className="hero__headline-accent">{hero.headlineAccent}</span>
        </h1>

        <div className="hero__intro">
          <p className="hero__lede">{hero.lede}</p>

          <div className="hero__actions">
            <a href="#contact" className="btn btn--primary">
              {settings.ctaLabel}
              <ArrowRight />
            </a>
            <a href="#route" className="btn btn--ghost">
              See the route
            </a>
          </div>
        </div>
      </div>

      <div className="hero__stats">
        <div className="shell hero__stats-grid">
          {hero.stats.map((stat) => (
            <div key={stat.label} className="hero__stat">
              <div className="hero__stat-value">{stat.value}</div>
              <div className="hero__stat-label mono-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
