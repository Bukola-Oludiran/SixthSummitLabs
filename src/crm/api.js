const sessionKey = 'sixsummit.crm.session'
export class CrmError extends Error {
  constructor(status = 0) {
    super(
      status === 401
        ? 'Your session has expired. Please sign in again.'
        : status === 403
        ? 'Your account does not have permission for this action.'
        : status === 409
        ? 'This record changed or the action is not allowed. Refresh the record and check its status.'
        : status === 422
        ? 'Check the required fields, dates and assignment, then try again.'
        : 'The CRM could not complete this request. Please try again.'
    )
    this.status = status
  }
}
export function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey))
    return typeof value?.token === 'string' ? value : null
  } catch {
    return null
  }
}
export function storeSession(session) {
  if (session)
    sessionStorage.setItem(sessionKey, JSON.stringify({ token: session.token, role: session.role }))
  else sessionStorage.removeItem(sessionKey)
}
export function crmRole(user) {
  const roles = user?.roles?.map((role) => role.name) || []
  return roles.includes('root') ? 'root' : roles.includes('sixsummit_caller') ? 'sixsummit_caller' : null
}
export class CrmApi {
  constructor({ token, role, expired, fetch: request = globalThis.fetch } = {}) {
    Object.assign(this, { token, role, expired, fetch: request.bind(globalThis) })
  }
  headers() {
    return {
      'Content-Type': 'application/json',
      'X-Authenticator': 'basic',
      'X-Locale': 'en-US',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(this.role ? { 'X-Role': this.role } : {}),
    }
  }
  async request(resource, action, { query = {}, body, signal } = {}) {
    if (!/^[a-z_]+$/.test(resource) || !/^[a-zA-Z]+$/.test(action)) throw new Error('Invalid CRM resource')
    const params = new URLSearchParams(
      Object.entries(query)
        .filter(([, value]) => value !== '' && value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)])
    )
    const response = await this.fetch(`/crm/api/${resource}:${action}${params.size ? `?${params}` : ''}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: this.headers(),
      credentials: 'omit',
      cache: 'no-store',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      if (response.status === 401 && this.token) this.expired?.()
      throw new CrmError(response.status)
    }
    return (await response.json()).data
  }
  get(action, query, signal) {
    return this.request('six_crm', action, { query, signal })
  }
  post(action, body) {
    return this.request('six_crm', action, { body })
  }
}
