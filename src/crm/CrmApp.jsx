import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wordmark } from '../components/icons'
import { CrmApi, CrmError, crmRole, readSession, storeSession } from './api'
import { routeFor } from './domain'
import { ErrorNotice, Icon, Loading, WorkspaceLink } from './ui'
import Workspace from './Workspace'
import LeadDetail from './LeadDetail'
import './crm.css'

const navigation = [
  ['overview', 'Overview', '/crm'],
  ['leads', 'Leads', '/crm/leads'],
  ['follow-ups', 'Follow-ups', '/crm/follow-ups'],
  ['designs', 'Designs', '/crm/designs'],
  ['analytics', 'Analytics', '/crm/analytics'],
]

export default function CrmApp() {
  const [session, setSession] = useState(readSession)
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(session))
  const [authError, setAuthError] = useState(null)
  const [path, setPath] = useState(window.location.pathname)
  const [notice, setNotice] = useState('')
  const expire = useCallback(() => {
    storeSession(null)
    setSession(null)
    setUser(null)
    setChecking(false)
    setAuthError('Your session has expired. Please sign in again.')
  }, [])
  const api = useMemo(() => new CrmApi({ token: session?.token, role: session?.role, expired: expire }), [
    session,
    expire,
  ])
  useEffect(() => {
    document.title = 'Staff workspace | 6ixSummit Labs'
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.append(robots)
    }
    robots.content = 'noindex, nofollow, noarchive'
    const pop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    if (!session || user) return
    const controller = new AbortController()
    api
      .request('auth', 'check', { signal: controller.signal })
      .then((account) => {
        if (controller.signal.aborted) return
        if (!account?.id) throw new CrmError(401)
        const role = crmRole(account)
        if (!role) throw new CrmError(403)
        if (session.role !== role) {
          const next = { token: session.token, role }
          storeSession(next)
          setSession(next)
        }
        setUser(account)
        setChecking(false)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          storeSession(null)
          setSession(null)
          setUser(null)
          setChecking(false)
          setAuthError(error.message)
        }
      })
    return () => controller.abort()
  }, [api, session, user])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(timer)
  }, [notice])
  const navigate = useCallback((href) => {
    window.history.pushState({}, '', href)
    setPath(window.location.pathname)
    window.scrollTo(0, 0)
  }, [])
  async function signedIn(nextSession, account) {
    storeSession(nextSession)
    setSession(nextSession)
    setUser(account)
    setAuthError(null)
  }
  async function logout() {
    try {
      await api.request('auth', 'signOut', { body: {} })
    } catch {
      /* Local sign-out always clears this workspace session. */
    } finally {
      storeSession(null)
      setSession(null)
      setUser(null)
      setAuthError(null)
    }
  }
  const route = routeFor(path)
  if (checking)
    return (
      <div className="crm-app crm-boot">
        <Loading>Checking your session…</Loading>
      </div>
    )
  if (!session || !user) return <Login onSuccess={signedIn} error={authError} />
  const isAdmin = session.role === 'root'
  return (
    <div className="crm-app">
      <a href="#crm-main" className="crm-skip">
        Skip to workspace
      </a>
      <aside className="crm-sidebar">
        <a className="crm-brand" href="/" aria-label="6ixSummit Labs home">
          <Wordmark width={178} />
        </a>
        <div className="crm-sidebar-label">Business workspace</div>
        <nav aria-label="CRM navigation">
          {navigation.map(([key, title, href]) => (
            <WorkspaceLink
              key={key}
              href={href}
              navigate={navigate}
              aria-current={
                route.view === key || (route.view === 'detail' && key === 'leads') ? 'page' : undefined
              }
              className="crm-nav-link"
            >
              <Icon name={key} />
              <span>{title}</span>
              {key === 'leads' && (
                <span className="crm-nav-arrow" aria-hidden="true">
                  ↗
                </span>
              )}
            </WorkspaceLink>
          ))}
        </nav>
        <div className="crm-sidebar-bottom">
          <p>6ixSummit Labs</p>
          <span>Conversations into projects.</span>
          {isAdmin && <a href="/crm/admin/sixsummit">NocoBase administration ↗</a>}
          <a href="/">Back to website ↗</a>
        </div>
      </aside>
      <div className="crm-main-shell">
        <header className="crm-topbar">
          <div>
            <span className="crm-connection-dot" />
            Staff workspace <span className="crm-topbar-separator">/</span>
            <span className="crm-muted">{isAdmin ? 'Administrator' : 'Caller'}</span>
          </div>
          <div className="crm-account">
            <span className="crm-avatar" aria-hidden="true">
              {(user.nickname || user.username || 'S').slice(0, 1).toUpperCase()}
            </span>
            <span>{user.nickname || user.username}</span>
            <button className="crm-icon-button" aria-label="Sign out" onClick={logout}>
              <Icon name="logout" />
            </button>
          </div>
        </header>
        {notice && (
          <div className="crm-toast" role="status">
            {notice}
          </div>
        )}
        <main id="crm-main" className="crm-main" tabIndex={-1}>
          {route.view === 'detail' ? (
            <LeadDetail
              key={route.leadId}
              leadId={route.leadId}
              api={api}
              user={user}
              isAdmin={isAdmin}
              navigate={navigate}
              notify={setNotice}
            />
          ) : route.view === 'missing' ? (
            <div className="crm-panel">
              <h1>Page not found</h1>
              <WorkspaceLink href="/crm" navigate={navigate}>
                Return to overview
              </WorkspaceLink>
            </div>
          ) : (
            <Workspace
              key={route.view}
              view={route.view}
              api={api}
              user={user}
              isAdmin={isAdmin}
              navigate={navigate}
            />
          )}
        </main>
        <footer className="crm-workspace-footer">
          <span>6ixSummit Labs · CRM</span>
          <span>Sales values in CAD. Dates shown in your local time.</span>
        </footer>
      </div>
    </div>
  )
}

function Login({ onSuccess, error }) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  async function login(event) {
    event.preventDefault()
    setBusy(true)
    setFailure(null)
    const data = new FormData(event.currentTarget)
    try {
      const api = new CrmApi()
      const result = await api.request('auth', 'signIn', {
        body: { account: data.get('account'), password: data.get('password') },
      })
      if (!result?.token) throw new CrmError(401)
      api.token = result.token
      const account = await api.request('auth', 'check')
      const role = crmRole(account)
      if (!role) {
        try {
          await api.request('auth', 'signOut', { body: {} })
        } catch {
          /* No authorized workspace session is retained. */
        }
        throw new CrmError(403)
      }
      onSuccess({ token: result.token, role }, account)
    } catch (error) {
      setFailure(
        error.status === 401
          ? 'The email or username and password did not match. Please try again.'
          : error.status === 403
          ? 'Ask an administrator to give your account the 6ixSummit Caller role.'
          : 'We couldn’t reach the CRM. Check that the backend is running and try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="crm-app crm-login">
      <div className="crm-login-art">
        <a href="/" aria-label="6ixSummit Labs home">
          <Wordmark width={205} />
        </a>
        <div>
          <span className="crm-kicker">The next conversation starts here.</span>
          <h1>
            Know the business.
            <br />
            Make the connection.
          </h1>
          <p>Your leads, follow-ups and design work, in one place.</p>
          <svg viewBox="0 0 600 220" aria-hidden="true">
            <path d="M0 220 185 36 302 142 392 65 600 220 M64 220 190 96 303 185 392 115 525 220" />
          </svg>
        </div>
        <span className="crm-login-caption">6ixSummit Labs · Staff workspace</span>
      </div>
      <main className="crm-login-main">
        <form onSubmit={login} className="crm-login-form">
          <span className="crm-kicker">Welcome back</span>
          <h2>Sign in to your workspace</h2>
          <p className="crm-muted">Use your existing NocoBase staff account.</p>
          {(failure || error) && <ErrorNotice error={failure || error} />}
          <label>
            Email or username
            <input name="account" autoComplete="username" required autoFocus disabled={busy} />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required disabled={busy} />
          </label>
          <button className="crm-button crm-button--primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            <Icon name="arrow" size={18} />
          </button>
          <p className="crm-login-help">
            Need access or a password reset? Contact your workspace administrator.
          </p>
          <a href="/">← Back to 6ixSummit Labs</a>
        </form>
      </main>
    </div>
  )
}
