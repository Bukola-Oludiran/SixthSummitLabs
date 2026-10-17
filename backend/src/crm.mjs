export class NocoBaseClient {
  constructor({ url, token, role, fetch: request = globalThis.fetch }) {
    this.url = new URL('/api/', url)
    this.token = token
    this.role = role
    this.fetch = request
  }

  async request(resource, action, { query = {}, body } = {}) {
    if (!/^[a-zA-Z0-9_/.]+$/.test(resource) || !/^[a-zA-Z]+$/.test(action)) {
      throw new Error('Invalid NocoBase resource or action.')
    }
    const url = new URL(`./${resource}:${action}`, this.url)
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) for (const entry of value) url.searchParams.append(`${key}[]`, String(entry))
      else url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
    const response = await this.fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authenticator': 'basic',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(this.role ? { 'X-Role': this.role } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      // Do not log request bodies, authentication headers or remote response bodies.
      throw new Error(`NocoBase ${resource}:${action} failed (${response.status}).`)
    }
    return response.json()
  }

  async signIn(account, password) {
    const result = await this.request('auth', 'signIn', { body: { account, password } })
    if (!result.data?.token) throw new Error('NocoBase did not return a session token.')
    this.token = result.data.token
    return this
  }

  async list(resource, filter = {}, query = {}) {
    const result = await this.request(resource, 'list', { query: { filter, pageSize: 100, ...query } })
    return result.data
  }

  async create(resource, values) {
    return (await this.request(resource, 'create', { body: values })).data
  }

  async update(resource, id, values) {
    return (await this.request(resource, 'update', { query: { filterByTk: id }, body: values })).data
  }
}
