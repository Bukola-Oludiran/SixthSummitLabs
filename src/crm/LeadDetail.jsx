import { useEffect, useRef, useState } from 'react'
import {
  callOnly,
  closedStages,
  dateTime,
  galleryPath,
  label,
  money,
  outcomePayload,
  overdue,
  qualifiedForCall,
  safeLink,
} from './domain'
import { Badge, Empty, ErrorNotice, Icon, Loading, Modal, useRemote, WorkspaceLink } from './ui'
import WebsitePreview from '../components/WebsitePreview'

export default function LeadDetail({ leadId, api, user, isAdmin, navigate, notify }) {
  const [tab, setTab] = useState('activity')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sharingEnabled, setSharingEnabled] = useState(null)
  const remote = useRemote(
    async (signal) => {
      const [record, callers, dispositions] = await Promise.all([
        api.get('detail', { leadId }, signal),
        api.get('callers', {}, signal),
        api.get('dispositions', {}, signal),
      ])
      return { ...record, callers, dispositions }
    },
    [api, leadId],
    { keepData: true }
  )
  const { data } = remote
  useEffect(() => {
    if (data && sharingEnabled !== null && Boolean(data.lead.designSharingEnabled) === sharingEnabled)
      setSharingEnabled(null)
  }, [data, sharingEnabled])
  async function mutate(action, payload, message) {
    setBusy(true)
    setError(null)
    try {
      await api.post(action, payload)
      notify(message)
      remote.refresh()
      return true
    } catch (error) {
      setError(error)
      return false
    } finally {
      setBusy(false)
    }
  }
  if (remote.error)
    return (
      <>
        <WorkspaceLink href="/crm/leads" navigate={navigate}>
          ← Back to leads
        </WorkspaceLink>
        <ErrorNotice error={remote.error} retry={remote.refresh} />
      </>
    )
  if (remote.loading && !data) return <Loading>Loading business record…</Loading>
  const { lead, activities, concepts, sources, callers, dispositions } = data
  const mine = lead.assignedToUserId === user.id
  const canWrite = isAdmin || mine
  const closed = closedStages.has(lead.contactStatus)
  const canCall = canWrite && qualifiedForCall(lead)
  return (
    <>
      <WorkspaceLink className="crm-breadcrumb" href="/crm/leads" navigate={navigate}>
        ← All leads
      </WorkspaceLink>
      <div className="crm-page-heading crm-lead-heading">
        <div>
          <div className="crm-heading-badges">
            <Badge value={lead.contactStatus} />
            {lead.isDemo && <Badge value="demo">Demonstration</Badge>}
            <span>Business #{lead.id}</span>
          </div>
          <h1>{lead.businessName}</h1>
          <p>
            {[lead.city, lead.province, lead.category && label(lead.category)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="crm-heading-actions">
          {!closed && (!mine || isAdmin) && (
            <AssignForm
              lead={lead}
              callers={callers}
              isAdmin={isAdmin}
              user={user}
              busy={busy}
              assign={(userId) =>
                mutate('assign', { leadId, ...(userId ? { userId } : {}) }, 'Caller assignment updated.')
              }
            />
          )}
          <button
            className="crm-button crm-button--primary"
            disabled={!canCall || busy}
            onClick={() => setModal('outcome')}
          >
            <Icon name="phone" size={16} />
            Record outcome
          </button>
        </div>
      </div>
      {lead.isDemo && (
        <div className="crm-info">
          This is a demonstration business. Its activity never contributes to lead targets or sales analytics.
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      {!closed && !qualifiedForCall(lead) && (
        <div className="crm-info">
          <strong>Research needed before calling.</strong> Confirm the business, phone number and current
          website evidence. The call action becomes available after qualification and fresh website checks.
        </div>
      )}
      {!canWrite && !closed && (
        <div className="crm-info">Assign this business to yourself to add notes or record an outcome.</div>
      )}
      <div className="crm-lead-layout">
        <aside className="crm-business-sidebar">
          <section className="crm-panel">
            <h2>Contact details</h2>
            <dl className="crm-details">
              <dt>Phone</dt>
              <dd>
                {lead.phone ? (
                  canCall && !lead.isDemo ? (
                    <a href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}>{lead.phone}</a>
                  ) : (
                    lead.phone
                  )
                ) : (
                  'Not recorded'
                )}
              </dd>
              <dt>Email</dt>
              <dd>
                {lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ? (
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                ) : (
                  'Not recorded'
                )}
              </dd>
              <dt>Address</dt>
              <dd>{lead.address || 'Not recorded'}</dd>
              <dt>Assigned caller</dt>
              <dd>{lead.assignedTo || 'Unassigned'}</dd>
              <dt>Next action</dt>
              <dd className={overdue(lead.nextFollowUpAt) && !closed ? 'crm-overdue' : ''}>
                {dateTime(lead.nextFollowUpAt)}
              </dd>
              {lead.meetingAt && (
                <>
                  <dt>Meeting</dt>
                  <dd>{dateTime(lead.meetingAt)}</dd>
                </>
              )}
              {lead.wonAt && (
                <>
                  <dt>Won project value</dt>
                  <dd>{money(lead.wonValueCents)} CAD</dd>
                </>
              )}
            </dl>
          </section>
          <section className="crm-panel">
            <h2>Prospect design link</h2>
            <Badge value={lead.designStatus} />
            <p className="crm-muted crm-spaced">
              {lead.designSharingEnabled
                ? 'Sharing is enabled. Only approved, published directions are visible.'
                : 'Sharing is disabled. The prospect cannot open the gallery or its files.'}
            </p>
            {galleryPath(lead) ? (
              <div className="crm-gallery-actions">
                <a
                  className="crm-button"
                  href={galleryPath(lead)}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-disabled={!lead.designSharingEnabled}
                  onClick={(event) => {
                    if (!lead.designSharingEnabled) event.preventDefault()
                  }}
                >
                  Open prospect view ↗
                </a>
                <button
                  className="crm-text-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        new URL(galleryPath(lead), window.location.origin).href
                      )
                      notify('Prospect link copied.')
                    } catch {
                      setError(
                        new Error('Could not copy the link. Open the prospect view and copy its address.')
                      )
                    }
                  }}
                >
                  Copy link
                </button>
              </div>
            ) : (
              <p className="crm-muted">A gallery link has not been created yet.</p>
            )}
            {canWrite && (
              <label className="crm-check crm-spaced">
                <input
                  type="checkbox"
                  checked={sharingEnabled ?? Boolean(lead.designSharingEnabled)}
                  disabled={busy}
                  onChange={async (event) => {
                    const enabled = event.target.checked
                    setSharingEnabled(enabled)
                    const saved = await mutate(
                      'sharing',
                      { leadId, enabled },
                      enabled ? 'Prospect link enabled.' : 'Prospect link disabled.'
                    )
                    if (!saved) setSharingEnabled(null)
                  }}
                />
                Enable prospect link
              </label>
            )}
          </section>
          {closed && (
            <section className="crm-panel">
              <h2>{lead.contactStatus === 'do_not_call' ? 'Contact stopped' : 'Closed opportunity'}</h2>
              <p className="crm-muted">
                {lead.contactStatus === 'do_not_call'
                  ? 'This business has opted out. It cannot be reopened through the CRM.'
                  : 'This lead is closed. An administrator can reopen it with an audit reason.'}
              </p>
              {isAdmin && lead.contactStatus !== 'do_not_call' && (
                <button className="crm-button crm-spaced" onClick={() => setModal('reopen')}>
                  Reopen opportunity
                </button>
              )}
            </section>
          )}
        </aside>
        <div className="crm-record-content">
          <nav className="crm-record-tabs" aria-label="Business record sections">
            {[
              ['activity', 'Activity'],
              ['designs', 'Designs', concepts.length],
              ['research', 'Research', sources.length],
            ].map(([key, title, count]) => (
              <button
                key={key}
                className={tab === key ? 'is-active' : ''}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {title}
                {count !== undefined && <span>{count}</span>}
              </button>
            ))}
          </nav>
          {tab === 'activity' && (
            <>
              {canWrite && (
                <NoteForm
                  api={api}
                  leadId={leadId}
                  saved={() => {
                    notify('Note saved.')
                    remote.refresh()
                  }}
                />
              )}
              <section className="crm-panel">
                <div className="crm-panel-heading">
                  <h2>Activity history</h2>
                  <span className="crm-muted">
                    Latest {activities.length}
                    {activities.length === 100 ? '+' : ''}
                  </span>
                </div>
                {activities.length ? (
                  <ol className="crm-timeline">
                    {activities.map((activity) => (
                      <li key={activity.id}>
                        <span
                          className={`crm-timeline-dot ${activity.disposition === 'won' ? 'is-won' : ''}`}
                        />
                        <div>
                          <div className="crm-timeline-heading">
                            <strong>
                              {activity.disposition ? label(activity.disposition) : label(activity.kind)}
                            </strong>
                            <time dateTime={activity.occurredAt}>{dateTime(activity.occurredAt)}</time>
                          </div>
                          <span className="crm-muted">
                            {activity.caller || 'Caller not recorded'} ·{' '}
                            {activity.kind === 'stage_update'
                              ? 'Sales update · no call counted'
                              : activity.kind === 'call'
                              ? 'Call attempt'
                              : label(activity.kind)}
                          </span>
                          {activity.notes && <p className="crm-activity-notes">{activity.notes}</p>}
                          {activity.followUpAt && (
                            <p className="crm-muted">Follow-up: {dateTime(activity.followUpAt)}</p>
                          )}
                          {activity.meetingAt && (
                            <p className="crm-muted">Meeting: {dateTime(activity.meetingAt)}</p>
                          )}
                          {activity.lossReason && <p>Loss reason: {activity.lossReason}</p>}
                          {activity.valueCents !== null && activity.valueCents !== undefined && (
                            <p>{money(activity.valueCents)} CAD project value</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty title="The conversation hasn’t started yet.">
                    Call outcomes, notes and assignments will appear here.
                  </Empty>
                )}
              </section>
            </>
          )}
          {tab === 'designs' && (
            <Designs
              concepts={concepts}
              lead={lead}
              api={api}
              isAdmin={isAdmin}
              busy={busy}
              review={(job) => setModal({ review: job })}
            />
          )}
          {tab === 'research' && <Research lead={lead} sources={sources} />}
        </div>
      </div>
      {modal === 'outcome' && (
        <OutcomeForm
          api={api}
          lead={lead}
          dispositions={dispositions}
          close={() => setModal(null)}
          saved={() => {
            setModal(null)
            notify('Outcome recorded. Activity and next action updated.')
            remote.refresh()
          }}
        />
      )}
      {modal === 'reopen' && (
        <ActionDialog
          title="Reopen opportunity"
          label="Reason for reopening"
          submitLabel="Reopen opportunity"
          close={() => setModal(null)}
          submit={async (reason) => {
            await api.post('reopen', { leadId, reason })
            setModal(null)
            notify('Opportunity reopened with an audit entry.')
            remote.refresh()
          }}
        />
      )}
      {modal?.review && (
        <ReviewDialog
          job={modal.review}
          close={() => setModal(null)}
          submit={async (status) => {
            await api.post('reviewDesign', { leadId, conceptId: modal.review.id, status, reviewed: true })
            setModal(null)
            notify(
              status === 'ready'
                ? 'Design approved. Publication will run after storage verification.'
                : 'Design returned to review.'
            )
            remote.refresh()
          }}
        />
      )}
    </>
  )
}
function AssignForm({ lead, callers, isAdmin, user, busy, assign }) {
  const [owner, setOwner] = useState(lead.assignedToUserId || user.id)
  return isAdmin ? (
    <form
      className="crm-assign"
      onSubmit={(event) => {
        event.preventDefault()
        assign(Number(owner))
      }}
    >
      <label className="visually-hidden" htmlFor="crm-assignee">
        Assign caller
      </label>
      <select
        id="crm-assignee"
        value={owner}
        onChange={(event) => setOwner(event.target.value)}
        disabled={busy}
      >
        {callers.map((person) => (
          <option value={person.id} key={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <button className="crm-button" disabled={busy}>
        Assign
      </button>
    </form>
  ) : (
    <button className="crm-button" disabled={busy} onClick={() => assign()}>
      Assign to me
    </button>
  )
}
function NoteForm({ api, leadId, saved }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const request = useRef(null)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    if (!request.current || request.current.notes !== text.trim())
      request.current = { leadId, notes: text.trim(), requestId: crypto.randomUUID() }
    try {
      await api.post('note', request.current)
      setText('')
      request.current = null
      saved()
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="crm-panel crm-note-form" onSubmit={submit}>
      <label htmlFor="crm-note">Add a note</label>
      <textarea
        id="crm-note"
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
        maxLength={10000}
        rows={3}
        disabled={busy}
        placeholder="Keep useful details for your next conversation."
      />
      {error && <ErrorNotice error={error} />}
      <button className="crm-button crm-button--primary crm-button--small" disabled={busy || !text.trim()}>
        {busy ? 'Saving…' : 'Save note'}
      </button>
    </form>
  )
}
function OutcomeForm({ api, lead, dispositions, close, saved }) {
  const [kind, setKind] = useState('call')
  const [disposition, setDisposition] = useState('no_answer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [locked, setLocked] = useState(false)
  const request = useRef(null)
  const formRef = useRef(null)
  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      if (!locked) {
        const payload = outcomePayload(new FormData(formRef.current), lead.id)
        const serialized = JSON.stringify(payload)
        if (request.current?.serialized !== serialized)
          request.current = { serialized, payload: { ...payload, requestId: crypto.randomUUID() } }
      }
      setBusy(true)
      await api.post('recordOutcome', request.current.payload)
      saved()
    } catch (error) {
      setError(error)
      if (!error.status || error.status >= 500) setLocked(Boolean(request.current))
    } finally {
      setBusy(false)
    }
  }
  const terminal = ['won', 'lost', 'wrong_number', 'do_not_call'].includes(disposition)
  return (
    <Modal title={`Record outcome · ${lead.businessName}`} busy={busy} close={close}>
      <form ref={formRef} onSubmit={submit}>
        <fieldset disabled={busy || locked} className="crm-form-fields">
          <label>
            Activity type
            <select
              name="kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value)
                if (event.target.value === 'stage_update' && callOnly.has(disposition))
                  setDisposition('interested')
              }}
            >
              <option value="call">Call attempt</option>
              <option value="stage_update">Sales update without a call</option>
            </select>
          </label>
          <label>
            Outcome
            <select
              name="disposition"
              value={disposition}
              onChange={(event) => setDisposition(event.target.value)}
            >
              {dispositions
                .filter((item) => kind === 'call' || !callOnly.has(item.value))
                .map((item) => (
                  <option value={item.value} key={item.value}>
                    {label(item.value)}
                  </option>
                ))}
            </select>
          </label>
          {!terminal && disposition !== 'meeting_booked' && (
            <label>
              Next follow-up{' '}
              {disposition !== 'callback_requested' && <span className="crm-muted">(optional)</span>}
              <input
                name="followUpAt"
                type="datetime-local"
                required={disposition === 'callback_requested'}
              />
            </label>
          )}
          {disposition === 'meeting_booked' && (
            <label>
              Meeting time
              <input name="meetingAt" type="datetime-local" required />
            </label>
          )}
          {disposition === 'won' && (
            <label>
              Project value in CAD
              <input
                name="valueDollars"
                inputMode="decimal"
                placeholder="2500.00"
                pattern="[0-9]+([.][0-9]{1,2})?"
                required
              />
              <span className="crm-field-hint">Booked project value, rather than money collected.</span>
            </label>
          )}
          {disposition === 'lost' && (
            <label>
              Loss reason
              <input name="lossReason" required maxLength={500} />
            </label>
          )}
          <label>
            Conversation notes
            <textarea name="notes" rows={4} maxLength={10000} />
          </label>
        </fieldset>
        <p className="crm-field-hint">
          Dates use your local time ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
        </p>
        {disposition === 'do_not_call' && (
          <div className="crm-warning">
            This opts the business out, cancels its next action and prevents further contact through the CRM.
          </div>
        )}
        {error && <ErrorNotice error={error} />}
        {locked && (
          <p className="crm-warning">
            We couldn’t confirm the save. Retry the same outcome to check it safely without creating a
            duplicate.
          </p>
        )}
        <div className="crm-modal-actions">
          <button type="button" className="crm-button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="crm-button crm-button--primary" disabled={busy}>
            {busy ? 'Saving…' : locked ? 'Retry same outcome' : 'Save outcome'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
function ActionDialog({ title, label: fieldLabel, submitLabel, submit, close }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal title={title} busy={busy} close={close}>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const value = new FormData(event.currentTarget).get('reason')
          setBusy(true)
          try {
            await submit(value)
          } catch (error) {
            setError(error)
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          {fieldLabel}
          <textarea name="reason" minLength={3} maxLength={1000} required rows={4} disabled={busy} />
        </label>
        {error && <ErrorNotice error={error} />}
        <div className="crm-modal-actions">
          <button type="button" className="crm-button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="crm-button crm-button--primary" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
function ReviewDialog({ job, close, submit }) {
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal
      title={`${job.status === 'ready' ? 'Pause' : 'Review'} direction ${job.conceptNumber}`}
      busy={busy}
      close={close}
    >
      <p className="crm-muted">
        {job.status === 'ready'
          ? 'Returning this concept to review hides it from the prospect until it is approved again.'
          : 'Approval makes this version eligible for publication. The prospect service verifies storage before showing it.'}
      </p>
      <label className="crm-check crm-spaced">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(event) => setReviewed(event.target.checked)}
          disabled={busy}
        />
        {job.status === 'ready'
          ? 'Return this concept to private review.'
          : 'I have inspected this concept and approve it for the prospect.'}
      </label>
      {error && <ErrorNotice error={error} />}
      <div className="crm-modal-actions">
        <button className="crm-button" disabled={busy} onClick={close}>
          Cancel
        </button>
        <button
          className="crm-button crm-button--primary"
          disabled={!reviewed || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await submit(job.status === 'ready' ? 'needs_review' : 'ready')
            } catch (error) {
              setError(error)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : job.status === 'ready' ? 'Return to review' : 'Approve concept'}
        </button>
      </div>
    </Modal>
  )
}
function Designs({ concepts, lead, api, isAdmin, busy, review }) {
  return (
    <div className="crm-concept-grid">
      {[1, 2, 3].map((number) => {
        const job = concepts.find((item) => item.conceptNumber === number)
        const uploaded = Boolean(job?.artifactManifest)
        const reviewable =
          uploaded &&
          job?.findings?.ok &&
          job.findings.findingCount === 0 &&
          ['needs_review', 'ready'].includes(job.status)
        return (
          <article className="crm-panel crm-concept" key={number}>
            <div className="crm-panel-heading">
              <span className="crm-kicker">Direction 0{number}</span>
              <Badge value={job?.status || 'not_queued'} />
            </div>
            <h2>{job?.direction || 'A direction for this business'}</h2>
            {uploaded ? (
              <PrivateDesignPreview api={api} leadId={lead.id} conceptId={job.id} title={`${lead.businessName} — direction ${number}`} />
            ) : (
              <div className="crm-concept-pending">
                <Icon name="designs" size={32} />
                <p>
                  {job?.status === 'awaiting_author'
                    ? 'Waiting for the homepage to be authored.'
                    : job?.status === 'needs_review' || job?.status === 'ready'
                    ? 'The design files need to be uploaded before they can be reviewed here.'
                    : 'The homepage and review previews will appear after generation and upload.'}
                </p>
              </div>
            )}
            {job?.palette?.length > 0 && (
              <div className="crm-palette" aria-label="Concept colours">
                {job.palette
                  .filter((colour) => /^#[\da-f]{6}$/i.test(colour))
                  .map((colour) => (
                    <span
                      key={colour}
                      style={{ backgroundColor: colour }}
                      title={colour}
                      aria-label={colour}
                    />
                  ))}
              </div>
            )}
            <p className="crm-muted">
              {job?.publicationManifest && job.status === 'ready'
                ? `Published ${dateTime(job.publishedAt)}`
                : job?.status === 'ready'
                ? 'Approved · publication pending'
                : 'Private until reviewed and published'}
            </p>
            {job?.error && (
              <p className="crm-warning">Generation needs attention. Review the job before retrying.</p>
            )}
            <div className="crm-concept-actions">
              {isAdmin && (
                <button
                  className="crm-button crm-button--small"
                  disabled={!reviewable || busy}
                  onClick={() => review(job)}
                >
                  {job?.status === 'ready' ? 'Return to review' : 'Review and approve'}
                </button>
              )}
              {job?.publicationManifest &&
                job.status === 'ready' &&
                lead.designSharingEnabled &&
                galleryPath(lead) && (
                  <a
                    className="crm-text-link"
                    href={`${galleryPath(lead)}?concept=${number}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open published direction ↗
                  </a>
                )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
function PrivateDesignPreview({ api, leadId, conceptId, title }) {
  const [mode, setMode] = useState('live')
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState({ loading: true })
  useEffect(() => {
    if (mode !== 'live') return
    const controller = new AbortController()
    let timer
    setPreview({ loading: true })
    fetch(`/prospect-api/staff/leads/${leadId}/concepts/${conceptId}/preview`, {
      method: 'POST', headers: api.headers(), credentials: 'omit', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) {
        if (response.status === 401) api.expired?.()
        throw new Error('The live preview is unavailable. Try refreshing it, or view the captured design.')
      }
      const data = await response.json()
      if (!/^\/prospect-api\/previews\/[A-Za-z0-9_-]{43}\/files\/index\.html$/.test(data.siteUrl) || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error('The live preview is unavailable. Try again.')
      if (controller.signal.aborted) return
      setPreview({ loading: false, url: data.siteUrl })
      timer = setTimeout(() => setAttempt(value => value + 1), Math.max(1000, Date.parse(data.expiresAt) - Date.now() - 60000))
    }).catch(error => { if (!controller.signal.aborted) setPreview({ loading: false, error: error.message }) })
    return () => { controller.abort(); clearTimeout(timer) }
  }, [api, leadId, conceptId, mode, attempt])
  return <>
    <div className="crm-capture-controls" aria-label="Design preview type">
      <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Live website</button>
      <button type="button" aria-pressed={mode === 'captures'} onClick={() => setMode('captures')}>Screenshots</button>
    </div>
    {mode === 'captures' ? <PrivateCaptures api={api} leadId={leadId} conceptId={conceptId} />
      : preview.loading ? <Loading>Opening live preview…</Loading>
      : preview.error ? <div><p className="crm-warning">{preview.error}</p><button className="crm-button crm-button--small" onClick={() => setAttempt(value => value + 1)}>Retry live preview</button></div>
      : <WebsitePreview src={preview.url} title={title} onRefresh={() => setAttempt(value => value + 1)} />}
  </>
}
function PrivateCaptures({ api, leadId, conceptId }) {
  const [viewport, setViewport] = useState('desktop')
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl
    setState({ loading: true })
    fetch(`/prospect-api/staff/leads/${leadId}/concepts/${conceptId}/${viewport}.png`, {
      headers: api.headers(),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'The private preview is unavailable. Check that design storage and the prospect service are configured.'
          )
        const blob = await response.blob()
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setState({ loading: false, url: objectUrl })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ loading: false, error: error.message })
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [api, leadId, conceptId, viewport])
  return (
    <>
      <div className="crm-capture-controls">
        {['desktop', 'mobile'].map((value) => (
          <button key={value} aria-pressed={value === viewport} onClick={() => setViewport(value)}>
            {label(value)}
          </button>
        ))}
      </div>
      {state.loading ? (
        <Loading>Loading private preview…</Loading>
      ) : state.error ? (
        <p className="crm-warning">{state.error}</p>
      ) : (
        <a
          href={state.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Open full ${viewport} review capture`}
        >
          <img
            className={`crm-private-capture is-${viewport}`}
            src={state.url}
            alt={`${viewport} homepage review capture`}
          />
        </a>
      )}
    </>
  )
}
function Research({ lead, sources }) {
  const facts = [
    ['Website check', label(lead.websiteStatus)],
    ['Website checked', lead.websiteCheckedAt ? dateTime(lead.websiteCheckedAt) : 'Not checked'],
    ['Original logo', label(lead.logoStatus)],
    ['Qualified', lead.qualifiedAt ? dateTime(lead.qualifiedAt) : 'Research incomplete'],
  ]
  return (
    <>
      <section className="crm-panel">
        <h2>Qualification and brand research</h2>
        <dl className="crm-details crm-research-facts">
          {facts.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {lead.businessNotes && <p className="crm-activity-notes">{lead.businessNotes}</p>}
        {[
          ['Observed colours', lead.brandPalette],
          ['Motifs and inspiration', lead.motifs],
          ['Observed services', lead.services],
          ['Website evidence', lead.websiteEvidence],
          ['Social profiles', lead.socialLinks],
        ]
          .filter(([, value]) => value && (!Array.isArray(value) || value.length))
          .map(([name, value]) => (
            <div className="crm-research-data" key={name}>
              <h3>{name}</h3>
              <pre>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
            </div>
          ))}
      </section>
      <section className="crm-panel">
        <h2>Source evidence</h2>
        {sources.length ? (
          <ul className="crm-source-list">
            {sources.map((source) => (
              <li key={source.id}>
                <strong>{source.sourceName || 'Research source'}</strong>
                <span>
                  {source.observedAt ? dateTime(source.observedAt) : 'Observation time not recorded'}
                </span>
                {safeLink(source.sourceUrl) && (
                  <a href={safeLink(source.sourceUrl)} target="_blank" rel="noreferrer noopener">
                    View original source ↗
                  </a>
                )}
                {source.attribution && <p>{source.attribution}</p>}
                {source.facts && (
                  <details>
                    <summary>Observed facts</summary>
                    <pre>{JSON.stringify(source.facts, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No source records yet.">
            Evidence added by the research workflow will appear here.
          </Empty>
        )}
      </section>
    </>
  )
}
