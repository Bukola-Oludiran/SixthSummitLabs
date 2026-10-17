import { useEffect, useState } from 'react'
import { Wordmark } from './icons'
import { settings } from '../site.config'
import './DesignGallery.css'

const tokenPattern = /^[A-Za-z0-9_-]{43}$/

export default function DesignGallery() {
  const token = window.location.pathname.split('/')[2] || ''
  const [gallery, setGallery] = useState(null)
  const [state, setState] = useState(token ? 'loading' : 'entry')
  const [selected, setSelected] = useState(Number(new URLSearchParams(window.location.search).get('concept')) || 1)
  const [viewport, setViewport] = useState('desktop')
  const [link, setLink] = useState('')
  const [entryError, setEntryError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    document.title = gallery ? `${gallery.businessName} · Your design directions · 6ixSummit Labs` : 'Your designs · 6ixSummit Labs'
    const robots = document.createElement('meta')
    robots.name = 'robots'; robots.content = 'noindex, nofollow, noarchive'
    document.head.appendChild(robots)
    return () => robots.remove()
  }, [gallery])

  useEffect(() => {
    if (!token) return
    if (!tokenPattern.test(token)) { setState('missing'); return }
    let active = true
    setState('loading')
    async function load() {
      try {
        const response = await fetch(`/prospect-api/designs/${token}`, { credentials: 'omit' })
        if (!active) return
        if (!response.ok) { setState(response.status === 404 ? 'missing' : 'error'); return }
        const data = await response.json()
        if (!active) return
        setGallery(data)
        setSelected((number) => {
          const requested = data.concepts.find((concept) => concept.number === number && concept.ready)
          return requested?.number || data.concepts.find((concept) => concept.ready)?.number || 1
        })
        setState('loaded')
      } catch { if (active) setState('error') }
    }
    load()
    return () => { active = false }
  }, [token, retry])

  function openLink(event) {
    event.preventDefault()
    try {
      const url = new URL(link.trim(), window.location.origin)
      const supplied = /^\/designs\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname)?.[1] || (tokenPattern.test(link.trim()) ? link.trim() : null)
      if (!supplied) throw new Error('Invalid design link')
      window.location.assign(`/designs/${supplied}`)
    } catch { setEntryError('Paste the design link from your 6ixSummit Labs contact.') }
  }

  function choose(number) {
    setSelected(number)
    const url = new URL(window.location.href)
    url.searchParams.set('concept', number)
    window.history.replaceState(null, '', url)
  }
  const concept = gallery?.concepts.find((item) => item.number === selected)
  const ready = gallery?.concepts.filter((item) => item.ready).length || 0
  const mail = `mailto:${settings.email}?subject=${encodeURIComponent(`${gallery?.businessName || 'My business'} — design ${selected}`)}`

  return (
    <div className="design-gallery">
      <a href="#design-main" className="design-skip">Skip to designs</a>
      <header className="design-header">
        <a href="/" aria-label="6ixSummit Labs home"><Wordmark width={205} /></a>
        <a href={`mailto:${settings.email}`} className="design-contact">Talk to our team <span aria-hidden="true">↗</span></a>
      </header>
      <main id="design-main" tabIndex={-1}>
        {state === 'entry' ? (
          <section className="design-entry">
            <p className="design-kicker">A look at what’s possible</p>
            <h1>Your next chapter.<br /><span>Designed for you.</span></h1>
            <p>We’ve prepared a place to explore your website ideas. Open the personal link shared by your 6ixSummit Labs contact.</p>
            <form onSubmit={openLink}>
              <label htmlFor="design-link">Your design link</label>
              <div className="design-link-row"><input id="design-link" value={link} onChange={(event) => { setLink(event.target.value); setEntryError('') }} placeholder="Paste your personal design link" required aria-describedby={entryError ? 'design-link-error' : undefined} /><button className="design-primary" type="submit">View my designs <span aria-hidden="true">↗</span></button></div>
              {entryError && <p id="design-link-error" role="alert">{entryError}</p>}
            </form>
          </section>
        ) : state === 'loading' ? (
          <section className="design-entry" role="status"><p className="design-kicker">Your design collection</p><h1>Opening your designs…</h1></section>
        ) : ['missing', 'error'].includes(state) ? (
          <section className="design-entry">
            <p className="design-kicker">Let’s get you to the right place</p>
            <h1>{state === 'missing' ? 'This link is unavailable.' : 'A brief pause.'}</h1>
            <p>{state === 'missing' ? 'Check the link you received, or ask your 6ixSummit Labs contact for a current one.' : 'We couldn’t load your designs just now. Try again in a moment.'}</p>
            <div className="design-entry-actions">{state === 'error' && <button className="design-primary" onClick={() => setRetry((value) => value + 1)}>Try again</button>}<a href={`mailto:${settings.email}`}>Contact our team ↗</a><a href="/designs">Enter another link</a></div>
          </section>
        ) : (
          <>
            <section className="design-intro">
              <div><p className="design-kicker">A website shaped around your business{gallery.city ? ` / ${gallery.city}` : ''}</p><h1>{gallery.businessName}<span>Explore your next chapter.</span></h1></div>
              <p>Three directions. One business: yours. Take a look, imagine your customers here, and tell us what feels right.</p>
            </section>
            <section className="design-collection" aria-label="Your website designs">
              <div className="design-collection-heading"><span className="design-kicker">Your design collection</span><span>{ready} of 3 ready to explore</span></div>
              <div className="design-options" aria-label="Choose a design">
                {gallery.concepts.map((item) => (
                  <button key={item.number} className={`design-option ${item.number === selected ? 'is-selected' : ''}`} aria-pressed={item.number === selected} onClick={() => choose(item.number)}>
                    <span className="design-option-number">0{item.number}</span><span><strong>Direction {item.number}</strong><small>{item.ready ? item.title : 'Being prepared for you'}</small></span><span aria-hidden="true">{item.ready ? '↗' : '·'}</span>
                  </button>
                ))}
              </div>
              {concept?.ready ? (
                <div className="design-viewer">
                  <div className="design-viewer-bar"><div><span className="design-status-dot" />Direction {concept.number}<span className="design-preview-label">Website concept</span></div><div className="design-size" aria-label="Preview size"><button aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>Desktop</button><button aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>Mobile</button></div></div>
                  <div className={`design-canvas is-${viewport}`}><iframe key={`${concept.number}-${viewport}`} src={concept.siteUrl} title={`${gallery.businessName} — direction ${concept.number} ${viewport} preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" /></div>
                  <div className="design-viewer-note"><span>This is a design concept. Some features are for demonstration.</span><a href={viewport === 'desktop' ? concept.desktopUrl : concept.mobileUrl} target="_blank" rel="noreferrer">View captured design ↗</a></div>
                </div>
              ) : (
                <div className="design-pending"><span aria-hidden="true">△</span><h2>A little care goes into every direction.</h2><p>This design is being prepared. Your contact will let you know when it’s ready.</p><button onClick={() => setRetry((value) => value + 1)}>Check for updates ↻</button></div>
              )}
            </section>
            <section className="design-next"><div><p className="design-kicker">Make it yours</p><h2>Found a direction you like?</h2><p>Tell us what stands out, what you’d change, and what your customers need. We’ll take it from there.</p></div><a className="design-primary" href={mail}>Let’s talk about direction {selected} <span aria-hidden="true">↗</span></a></section>
          </>
        )}
      </main>
      <footer className="design-footer"><a href="/">6ixSummit Labs</a><span>Thoughtful ideas. Built around your business.</span></footer>
    </div>
  )
}
