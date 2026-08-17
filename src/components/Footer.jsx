import { Logo } from './icons'
import { footer } from '../site.config'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer__inner">
        <div className="footer__brand">
          <Logo size={20} withRidge={false} />
          <span className="footer__wordmark">6ixSummit Labs</span>
        </div>

        <nav className="footer__links">
          {footer.links.map((link) => (
            <a key={link.href} href={link.href} className="footer__link">
              {link.label}
            </a>
          ))}
        </nav>

        <span className="footer__note">{footer.note}</span>
      </div>

      <p className="shell footer__credit">
        {footer.credit.text}{' '}
        <a href={footer.credit.href} target="_blank" rel="noreferrer noopener">
          {footer.credit.linkLabel}
        </a>
      </p>
    </footer>
  )
}
