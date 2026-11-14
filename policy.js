/**
 * Pure configuration plumbing for the HTTP proxy bundle: no transport, no
 * packages, so it loads anywhere and can be exercised on its own.
 *
 * The resolver in `@deepseek-ai/dsh-http-proxy` reads proxy settings through an
 * environment face. This module turns the row's three configured values into
 * that face, validates the URLs the resolver would otherwise accept silently,
 * and keeps credentials out of log lines.
 * @module @local/dsh-http-proxy/policy
 */

/**
 * Configuration fields and the environment names each one supplies. The names
 * are listed lowercase first because the shared resolver reads that casing first
 * and the uppercase spelling as its fallback.
 */
const FIELDS = [
  ['httpProxy', ['http_proxy', 'HTTP_PROXY']],
  ['httpsProxy', ['https_proxy', 'HTTPS_PROXY']],
  ['noProxy', ['no_proxy', 'NO_PROXY']],
]

/**
 * Read a configuration snapshot from a volatile configuration proxy.
 * @param config - an object whose fields answer `get()`.
 * @returns the three values, trimmed, with an absent field as an empty string.
 */
export function readConfig(config) {
  const values = {}
  for (const [field] of FIELDS) {
    const value = config[field].get()
    values[field] = typeof value === 'string' ? value.trim() : ''
  }
  return values
}

/**
 * Project one configuration snapshot onto the environment face the shared proxy
 * resolver reads. Both casings of a name answer with the same value, so the
 * resolver's precedence never sees a blank lowercase name shadow a set uppercase
 * one, and an unset field answers `undefined` instead of an empty value.
 * @param values - one configuration snapshot.
 * @returns the lookup `installProxyFromEnvironment` resolves.
 */
export function policyEnvironment(values) {
  const entries = new Map()
  for (const [field, names] of FIELDS) {
    const value = values[field]
    if (value === '') continue
    for (const name of names) entries.set(name, value)
  }
  return {
    get(name) {
      const value = entries.get(name.toLowerCase())
      return value === undefined ? undefined : { value }
    },
  }
}

/**
 * Whether one configured value is a proxy this process can route through: a
 * parseable URL whose scheme is http or https.
 * @param value - the configured proxy URL.
 * @returns true when the value is routable.
 */
export function routeable(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The fields whose configured values this process cannot route through.
 * @param values - one configuration snapshot.
 * @returns the offending field names, empty when every value is routable.
 */
export function unreachable(values) {
  return ['httpProxy', 'httpsProxy'].filter(
    (field) => values[field] !== '' && !routeable(values[field]),
  )
}

/**
 * Whether a snapshot asks for a proxy at all. A snapshot with neither proxy URL
 * keeps whatever policy is already installed, which is the launch environment's.
 * @param values - one configuration snapshot.
 * @returns true when at least one proxy URL is configured.
 */
export function requestsProxy(values) {
  return values.httpProxy !== '' || values.httpsProxy !== ''
}

/**
 * A proxy URL safe to log: scheme, host, and port only, never a credential.
 * @param value - the configured proxy URL.
 * @returns the address for one log line.
 */
export function describeProxy(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  } catch {
    return 'the configured proxy'
  }
}
