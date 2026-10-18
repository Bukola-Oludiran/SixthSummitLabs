import { useEffect, useRef, useState } from 'react'
import { label } from './domain'

export function Icon({ name, size = 20 }) {
  const paths = {
    overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    leads: 'M4 5h16v15H4z M8 2v5 M16 2v5 M8 11h8 M8 15h5',
    'follow-ups': 'M12 8v5l3 2 M21 12a9 9 0 1 1-3-6.7 M21 3v6h-6',
    designs: 'M3 4h18v16H3z M3 9h18 M8 9v11 M12 13h5 M12 16h4',
    analytics: 'M4 3v17h17 M8 16v-5 M13 16V6 M18 16v-8',
    search: 'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    refresh: 'M20 7v5h-5 M4 17v-5h5 M19 12a7 7 0 0 0-12-5 M5 12a7 7 0 0 0 12 5',
    logout: 'M9 4H4v16h5 M10 12h11 M16 7l5 5-5 5',
    close: 'M6 6l12 12 M6 18 18 6',
    phone: 'M7 3H3c0 10 8 18 18 18v-4l-5-2-2 2a14 14 0 0 1-7-7l2-2z',
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  )
}
export function WorkspaceLink({ href, navigate, children, ...props }) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault()
          navigate(href)
        }
      }}
    >
      {children}
    </a>
  )
}
export function Badge({ value, children }) {
  return <span className={`crm-badge crm-badge--${value || 'neutral'}`}>{children || label(value)}</span>
}
export function Empty({ title, children, action }) {
  return (
    <div className="crm-empty">
      <span className="crm-empty-mark" aria-hidden="true">
        ◇
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
export function ErrorNotice({ error, retry }) {
  return (
    <div className="crm-error" role="alert">
      <p>{error?.message || String(error)}</p>
      {retry && (
        <button className="crm-button crm-button--small" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  )
}
export function Loading({ children = 'Loading workspace…' }) {
  return (
    <div className="crm-loading" role="status">
      <span className="crm-spinner" />
      {children}
    </div>
  )
}
export function useRemote(load, dependencies, { keepData = false } = {}) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ loading: true, data: keepData ? current.data : null, error: null }))
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ loading: false, data, error: null })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ loading: false, data: null, error })
      })
    return () => controller.abort()
  }, [...dependencies, revision, keepData])
  return { ...state, refresh: () => setRevision((value) => value + 1) }
}
export function Modal({ title, busy, close, children }) {
  const dialog = useRef(null)
  useEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => node.close()
  }, [])
  return (
    <dialog
      className="crm-modal"
      ref={dialog}
      aria-labelledby="crm-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) close()
      }}
    >
      <div className="crm-modal-heading">
        <h2 id="crm-dialog-title">{title}</h2>
        <button className="crm-icon-button" aria-label="Close dialog" disabled={busy} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Breakdown({ title, data = {}, names = {}, empty = 'No call activity in this period.' }) {
  const entries = Object.entries(data)
  const max = Math.max(1, ...entries.map(([, count]) => count))
  return (
    <section className="crm-panel crm-breakdown">
      <h2>{title}</h2>
      {!entries.length ? (
        <p className="crm-muted">{empty}</p>
      ) : (
        <ul>
          {entries.map(([key, count]) => (
            <li key={key}>
              <div>
                <span>{names[key] || label(key)}</span>
                <strong>{count}</strong>
              </div>
              <span className="crm-bar" aria-hidden="true">
                <span style={{ width: `${(count / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
