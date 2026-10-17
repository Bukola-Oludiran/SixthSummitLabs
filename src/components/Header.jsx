import { Wordmark } from './icons'
import { nav, settings } from '../site.config'
import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <a href="#top" className="header__brand" aria-label="6ixSummit Labs home">
        <Wordmark />
      </a>

      <nav className="header__nav">
        {nav.map((item) => (
          <a key={item.href} href={item.href} className="header__link">
            {item.label}
          </a>
        ))}
        <a href="#contact" className="btn btn--primary btn--sm">
          {settings.ctaLabel}
        </a>
      </nav>
    </header>
  )
}
