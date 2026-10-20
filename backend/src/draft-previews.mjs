import { randomBytes } from 'node:crypto'

// A browser frame cannot send the workspace's Authorization header. Exchange it
// for a short-lived, single-concept capability; never put the CRM token in HTML.
export function draftPreviews({ staffDetail, now = Date.now, ttlMs = 15 * 60 * 1000, limit = 128 }) {
  const sessions = new Map()
  const prune = () => {
    for (const [key, session] of sessions) if (session.expiresAt <= now()) sessions.delete(key)
  }
  const currentJob = (record, conceptId) => record.concepts.find(job =>
    job.id === conceptId && Number(job.leadId) === Number(record.lead.id) &&
    job.briefVersion === (record.lead.briefVersion || 1) && job.artifactManifest)
  return {
    async issue(token, role, leadId, conceptId) {
      const record = await staffDetail(token, role, leadId)
      const job = currentJob(record, conceptId)
      if (!job) return null
      prune()
      while (sessions.size >= limit) sessions.delete(sessions.keys().next().value)
      const key = randomBytes(32).toString('base64url')
      const expiresAt = now() + ttlMs
      sessions.set(key, { token, role, leadId, conceptId, manifest: job.artifactManifest, expiresAt })
      return { siteUrl: `/prospect-api/previews/${key}/files/index.html`, expiresAt: new Date(expiresAt).toISOString() }
    },
    async resolve(key) {
      prune()
      const session = sessions.get(key)
      if (!session) return null
      try {
        // Recheck live auth and row access for every HTML, script and asset request.
        const record = await staffDetail(session.token, session.role, session.leadId)
        const job = currentJob(record, session.conceptId)
        if (!job || job.artifactManifest !== session.manifest || session.expiresAt <= now()) {
          sessions.delete(key)
          return null
        }
        return { lead: record.lead, job }
      } catch (error) {
        if ([401, 403, 404].includes(error.status)) sessions.delete(key)
        throw error
      }
    },
  }
}
