import { useEffect, useRef, useState } from 'react'
import './WebsitePreview.css'

function PreviewFrame({ src, title, viewport, onEscape }) {
  const screen = useRef(null)
  const frame = useRef(null)
  const [size, setSize] = useState({ width: 1280, height: 600 })
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height)
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(screen.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!onEscape) return
    function message(event) {
      if (event.source === frame.current?.contentWindow && event.data?.type === 'sixsummit-preview:escape') onEscape()
    }
    window.addEventListener('message', message)
    return () => window.removeEventListener('message', message)
  }, [onEscape])
  const width = viewport === 'mobile' ? 390 : Math.max(1280, size.width)
  const scale = Math.min(1, size.width / width)
  return (
    <div className="website-preview-screen" ref={screen}>
      <iframe
        ref={frame}
        src={src}
        title={`${title} — ${viewport} live preview`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        style={{ width, height: Math.ceil(size.height / scale), left: (size.width - width * scale) / 2, transform: `scale(${scale})` }}
      />
    </div>
  )
}

export default function WebsitePreview({ src, title, onRefresh }) {
  const [viewport, setViewport] = useState('desktop')
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef(null)
  const opener = useRef(null)
  const wasFullscreen = useRef(false)

  function close() {
    if (dialog.current && document.fullscreenElement === dialog.current) document.exitFullscreen().catch(() => {})
    dialog.current?.close()
    wasFullscreen.current = false
    setExpanded(false)
    opener.current?.focus()
  }
  useEffect(() => {
    function changed() {
      if (document.fullscreenElement === dialog.current) wasFullscreen.current = true
      else if (wasFullscreen.current && dialog.current?.open) close()
    }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [expanded])
  useEffect(() => () => {
    if (dialog.current && document.fullscreenElement === dialog.current) document.exitFullscreen().catch(() => {})
  }, [])

  function open() {
    dialog.current.showModal()
    setExpanded(true)
    // The modal fills the window even if native fullscreen is unavailable.
    dialog.current.requestFullscreen?.().catch(() => {})
  }
  function controls(fullscreen) {
    return (
      <div className="website-preview-toolbar">
        <span className="website-preview-label">{fullscreen ? title : 'Live website'}</span>
        <div className="website-preview-actions">
          <div className="website-preview-sizes" aria-label="Preview size">
            {['desktop', 'mobile'].map(value => (
              <button key={value} type="button" aria-pressed={viewport === value} onClick={() => setViewport(value)}>{value === 'desktop' ? 'Desktop' : 'Mobile'}</button>
            ))}
          </div>
          {onRefresh && <button type="button" onClick={onRefresh}>Refresh</button>}
          {fullscreen
            ? <button type="button" className="website-preview-expand" onClick={close}>Exit full screen <span aria-hidden="true">↙</span></button>
            : <button type="button" className="website-preview-expand" ref={opener} onClick={open}>Full screen <span aria-hidden="true">↗</span></button>}
        </div>
      </div>
    )
  }
  return (
    <div className="website-preview">
      {controls(false)}
      {expanded ? <div className="website-preview-screen" aria-hidden="true" /> : <PreviewFrame src={src} title={title} viewport={viewport} />}
      <dialog className="website-preview-dialog" ref={dialog} aria-label={`${title} full screen preview`}
        onCancel={event => { event.preventDefault(); close() }}
        onClose={() => { setExpanded(false); wasFullscreen.current = false }}>
        {expanded && <>{controls(true)}<PreviewFrame src={src} title={title} viewport={viewport} onEscape={close} /></>}
      </dialog>
    </div>
  )
}
