import { useState } from 'react'
import { cities, dateTime, galleryPath, label, money, overdue, percent, stages } from './domain'
import { Badge, Breakdown, Empty, ErrorNotice, Icon, Loading, useRemote, WorkspaceLink } from './ui'

const headings = {
  overview: ['Your business, at a glance.', 'See where conversations stand and what needs your attention.'],
  leads: [
    'Every conversation starts here.',
    'Research businesses, prepare your next call and keep the details together.',
  ],
  'follow-ups': ['Pick up the conversation.', 'Scheduled next actions across your open opportunities.'],
  designs: [
    'Ideas ready for a conversation.',
    'Track the three homepage directions and each business’s prospect link.',
  ],
  analytics: [
    'Know what’s moving forward.',
    'Calls, booked meetings and won projects from recorded sales activity.',
  ],
}
export default function Workspace({ view, api, user, isAdmin, navigate }) {
  const [filters, setFilters] = useState({
    city: '',
    owner: '',
    stage: '',
    search: '',
    page: 1,
    queue:
      view === 'overview'
        ? 'callable'
        : view === 'follow-ups'
        ? 'follow_up'
        : view === 'designs'
        ? 'designs'
        : '',
    showDemo: '',
  })
  const [search, setSearch] = useState('')
  const [days, setDays] = useState(30)
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  const remote = useRemote(
    async (signal) => {
      const now = Date.now()
      const query = {
        city: filters.city,
        callerId: /^\d+$/.test(filters.owner) ? filters.owner : filters.owner === 'me' ? user.id : undefined,
        from: new Date(now - days * 86400000).toISOString(),
        to: new Date(now).toISOString(),
      }
      const [leads, summary, callers, due] = await Promise.all([
        api.get('leads', filters, signal),
        api.get('summary', query, signal),
        api.get('callers', {}, signal),
        view === 'overview'
          ? api.get('leads', { city: filters.city, owner: filters.owner, queue: 'follow_up' }, signal)
          : Promise.resolve(null),
      ])
      return { leads, summary, callers, due }
    },
    [api, view, JSON.stringify(filters), days, user.id]
  )
  const { data, loading, error } = remote
  const [title, description] = headings[view]
  return (
    <>
      <div className="crm-page-heading">
        <div>
          <span className="crm-kicker">
            {view === 'overview' ? 'Your workspace' : label(view.replace('-', '_'))}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button className="crm-button" disabled={loading} onClick={remote.refresh}>
          <Icon name="refresh" size={16} />
          Refresh
        </button>
      </div>
      <div className="crm-filterbar">
        <label>
          City
          <select value={filters.city} onChange={(event) => update('city', event.target.value)}>
            <option value="">All cities</option>
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </label>
        <label>
          Caller
          <select value={filters.owner} onChange={(event) => update('owner', event.target.value)}>
            <option value="">
              {isAdmin || view === 'overview' || view === 'analytics' ? 'All callers' : 'Mine and unassigned'}
            </option>
            <option value="me">Assigned to me</option>
            {!['overview', 'analytics'].includes(view) && <option value="unassigned">Unassigned</option>}
            {isAdmin &&
              data?.callers
                .filter((person) => person.id !== user.id)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
          </select>
        </label>
        {view === 'overview' || view === 'analytics' ? (
          <label>
            Reporting period
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {[7, 30, 90].map((day) => (
                <option value={day} key={day}>
                  Last {day} days
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              Stage
              <select value={filters.stage} onChange={(event) => update('stage', event.target.value)}>
                <option value="">All stages</option>
                {stages.map((stage) => (
                  <option value={stage} key={stage}>
                    {label(stage)}
                  </option>
                ))}
              </select>
            </label>
            <form
              className="crm-search"
              onSubmit={(event) => {
                event.preventDefault()
                update('search', search)
              }}
            >
              <label htmlFor="crm-search">Find a business</label>
              <div>
                <input
                  id="crm-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Business name or phone"
                />
                <button className="crm-icon-button" aria-label="Search leads">
                  <Icon name="search" size={18} />
                </button>
              </div>
            </form>
            {isAdmin && (
              <label className="crm-check">
                <input
                  type="checkbox"
                  checked={filters.showDemo === 'true'}
                  onChange={(event) => update('showDemo', event.target.checked ? 'true' : '')}
                />
                Demo records only
              </label>
            )}
          </>
        )}
      </div>
      {error ? (
        <ErrorNotice error={error} retry={remote.refresh} />
      ) : loading ? (
        <Loading />
      ) : (
        <>
          {(view === 'overview' || view === 'analytics') && <MetricCards summary={data.summary} />}
          {view === 'analytics' ? (
            <Analytics summary={data.summary} callers={data.callers} />
          ) : view === 'overview' ? (
            <div className="crm-overview-grid">
              <LeadList
                title="Next conversations"
                leads={data.leads}
                navigate={navigate}
                emptyTitle="Your call list is clear."
                emptyDescription="Unverified discoveries stay in Leads until research is complete. Qualified open businesses will appear here."
                action={
                  <WorkspaceLink className="crm-text-link" navigate={navigate} href="/crm/leads">
                    Open all leads <Icon name="arrow" size={16} />
                  </WorkspaceLink>
                }
              />
              <section className="crm-panel crm-next">
                <div className="crm-panel-heading">
                  <h2>Follow-ups</h2>
                  <WorkspaceLink navigate={navigate} href="/crm/follow-ups">
                    View all ↗
                  </WorkspaceLink>
                </div>
                {data.due.items.length ? (
                  <ul>
                    {data.due.items.slice(0, 5).map((lead) => (
                      <li key={lead.id}>
                        <WorkspaceLink navigate={navigate} href={`/crm/leads/${lead.id}`}>
                          {lead.businessName}
                        </WorkspaceLink>
                        <span className={overdue(lead.nextFollowUpAt) ? 'crm-overdue' : 'crm-muted'}>
                          {dateTime(lead.nextFollowUpAt)}
                        </span>
                        <span className="crm-muted">{lead.assignedTo || 'Unassigned'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="Nothing scheduled yet.">
                    Record a callback or meeting time after your next conversation.
                  </Empty>
                )}
                <div className="crm-next-note">
                  <span className="crm-kicker">Keep the full picture</span>
                  <p>
                    Meetings and won projects are tracked separately. Record an outcome after each call to
                    keep your next action up to date.
                  </p>
                </div>
              </section>
            </div>
          ) : (
            <>
              {filters.showDemo && (
                <div className="crm-info" role="status">
                  Demonstration records are shown. They are excluded from calling lists, lead targets and
                  sales analytics.
                </div>
              )}
              {view === 'designs' ? (
                <DesignList leads={data.leads} navigate={navigate} />
              ) : (
                <LeadList
                  title={view === 'follow-ups' ? 'Scheduled conversations' : 'Business directory'}
                  leads={data.leads}
                  navigate={navigate}
                  showDue={view === 'follow-ups'}
                  emptyTitle="No businesses match this view."
                  emptyDescription="Try another filter, or check back after the next research run."
                />
              )}
              <div className="crm-pagination">
                <span>
                  {data.leads.total} {data.leads.total === 1 ? 'business' : 'businesses'}
                  {data.leads.total > 0
                    ? ` · Page ${data.leads.page} of ${Math.ceil(data.leads.total / data.leads.pageSize)}`
                    : ''}
                </span>
                <div>
                  <button
                    className="crm-button crm-button--small"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                  >
                    Previous
                  </button>
                  <button
                    className="crm-button crm-button--small"
                    disabled={filters.page * data.leads.pageSize >= data.leads.total}
                    onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
function MetricCards({ summary }) {
  const metrics = summary.metrics
  return (
    <div className="crm-metrics">
      {[
        ['Call attempts', metrics.callAttempts, `${metrics.uniqueBusinessesCalled} businesses called`],
        ['Meetings booked', metrics.meetingsBooked, 'Distinct businesses this period'],
        ['Projects won', metrics.projectsWon, 'Distinct businesses this period'],
        ['Won project value', money(metrics.wonValueCents), 'Booked value in CAD · not cash collected'],
      ].map(([title, value, note]) => (
        <section className="crm-metric" key={title}>
          <h2>{title}</h2>
          <strong>{value}</strong>
          <span>{note}</span>
        </section>
      ))}
    </div>
  )
}
function LeadList({ title, leads, navigate, showDue, emptyTitle, emptyDescription, action }) {
  return (
    <section className="crm-panel crm-lead-list">
      <div className="crm-panel-heading">
        <h2>{title}</h2>
        <span className="crm-count">{leads.total}</span>
      </div>
      {leads.items.length ? (
        <div className="crm-table-wrap" role="region" aria-label="Business directory table" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>City</th>
                <th>Stage</th>
                <th>{showDue ? 'Next action' : 'Research'}</th>
                <th>Caller</th>
                <th>
                  <span className="visually-hidden">Open lead</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.items.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <WorkspaceLink
                      className="crm-business-link"
                      href={`/crm/leads/${lead.id}`}
                      navigate={navigate}
                    >
                      {lead.businessName}
                    </WorkspaceLink>
                    <span className="crm-table-sub">
                      {lead.category ? label(lead.category) : 'Category not recorded'}
                      {lead.isDemo ? ' · Demo' : ''}
                    </span>
                  </td>
                  <td>{lead.city || '—'}</td>
                  <td>
                    <Badge value={lead.contactStatus} />
                  </td>
                  <td>
                    {showDue ? (
                      <span className={overdue(lead.nextFollowUpAt) ? 'crm-overdue' : ''}>
                        {dateTime(lead.nextFollowUpAt)}
                      </span>
                    ) : (
                      <span className={lead.qualifiedAt ? 'crm-positive' : 'crm-muted'}>
                        {lead.qualifiedAt ? 'Qualified' : 'Needs research'}
                      </span>
                    )}
                  </td>
                  <td>{lead.assignedTo || <span className="crm-muted">Unassigned</span>}</td>
                  <td>
                    <WorkspaceLink
                      href={`/crm/leads/${lead.id}`}
                      navigate={navigate}
                      className="crm-row-open"
                      aria-label={`Open ${lead.businessName}`}
                    >
                      <Icon name="arrow" size={16} />
                    </WorkspaceLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={emptyTitle} action={action}>
          {emptyDescription}
        </Empty>
      )}
    </section>
  )
}
function DesignList({ leads, navigate }) {
  return (
    <section className="crm-panel">
      <div className="crm-panel-heading">
        <h2>Business design collections</h2>
        <span className="crm-count">{leads.total}</span>
      </div>
      {!leads.items.length ? (
        <Empty title="Design work will appear here.">
          Research and qualification queue three homepage directions for each business. You can review them
          from the business record.
        </Empty>
      ) : (
        <div className="crm-design-businesses">
          {leads.items.map((lead) => (
            <article key={lead.id}>
              <div className="crm-design-business-icon" aria-hidden="true">
                <Icon name="designs" size={26} />
              </div>
              <div>
                <Badge value={lead.designStatus} />
                <h3>
                  <WorkspaceLink navigate={navigate} href={`/crm/leads/${lead.id}`}>
                    {lead.businessName}
                  </WorkspaceLink>
                </h3>
                <p>
                  {lead.city} ·{' '}
                  {lead.designSharingEnabled ? 'Prospect link enabled' : 'Prospect link disabled'}
                </p>
              </div>
              <WorkspaceLink navigate={navigate} href={`/crm/leads/${lead.id}`} className="crm-button">
                Review designs <Icon name="arrow" size={15} />
              </WorkspaceLink>
              {galleryPath(lead) && lead.designSharingEnabled && (
                <a
                  href={galleryPath(lead)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="crm-text-link"
                >
                  Prospect view ↗
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
function Analytics({ summary, callers }) {
  const metrics = summary.metrics
  const names = Object.fromEntries(callers.map((person) => [person.id, person.name]))
  return (
    <>
      <div className="crm-analytics-rates">
        {[
          [
            'Connection rate',
            percent(metrics.connectionRate),
            `${metrics.connectedCalls} connected of ${metrics.callAttempts} call attempts`,
          ],
          [
            'Meeting cohort to won',
            percent(metrics.meetingToWinConversion),
            `${metrics.meetingCohortWins} wins from ${metrics.meetingCohort} businesses first booked in this period`,
          ],
          ['Qualified in period', metrics.qualifiedLeads, 'Based on qualification date and current owner'],
          ['Overdue follow-ups', metrics.overdueFollowUps, 'Current open follow-ups, across all dates'],
        ].map(([name, value, note]) => (
          <div className="crm-panel" key={name}>
            <h2>{name}</h2>
            <strong>{value}</strong>
            <p>{note}</p>
          </div>
        ))}
      </div>
      <div className="crm-info">
        <strong>How these numbers work</strong>
        <p>
          Meetings and wins count distinct businesses with events in this period. They are separate
          milestones, rather than a same-period conversion funnel. Cohort conversion follows businesses first
          booked in the period through to a win. Demo records are excluded.
        </p>
      </div>
      <div className="crm-analytics-grid">
        <Breakdown title="Call outcomes" data={summary.outcomes} />
        <Breakdown title="Calls by city" data={summary.byCity} />
        <Breakdown
          title="Calls by caller"
          data={summary.byCaller}
          names={{ ...names, ...summary.callerNames }}
        />
        <Breakdown title="Calls by day · Edmonton time" data={summary.byDay} />
      </div>
      <p className="crm-fine-print">
        Reporting range: {dateTime(summary.range.from)} to {dateTime(summary.range.to)}. The end of the range
        is excluded. Call activity retains its original caller and city; follow-ups and meeting cohorts use
        current ownership. Invoice and payment data are not connected.
      </p>
    </>
  )
}
