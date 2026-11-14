/**
 * One real request through a proxy, with no dispatcher involved.
 *
 * The Plugins page's test button has to answer "would a model request get out
 * through these addresses?" without changing what the process already uses. It
 * therefore opens its own tunnel: a CONNECT to the proxy, TLS to the target,
 * and one `GET` — the same path undici's `ProxyAgent` takes, but scoped to this
 * call, so a mistyped address cannot disturb an installed policy or an
 * in-flight model request.
 *
 * Only Node built-ins are used, so the probe needs no package the deployment
 * might not ship.
 * @module @local/dsh-http-proxy/probe
 */
import net from 'node:net'
import tls from 'node:tls'
import { describeProxy, unreachable } from './policy.js'

/** The target the test button asks for: one tiny, cacheable Google response. */
export const PROBE_TARGET = 'https://www.google.com/generate_204'

/** Default ceiling for the whole exchange, including the tunnel. */
const PROBE_TIMEOUT_MS = 12000

/** Largest header block the probe reads before giving up on a peer. */
const MAX_HEAD_BYTES = 16 * 1024

/** A connection that ended before it was usable; the deadline maps this to a timeout. */
const CLOSED_EARLY = 'ECLOSED'

/**
 * Read one HTTP header block, up to the blank line. A peer that closes first is
 * a failure, not an empty answer, so a deadline that destroys the socket always
 * settles this promise.
 * @param {import('node:net').Socket} socket - an open connection or tunnel.
 * @returns {Promise<string>} the status line and headers.
 */
function readHead(socket) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const onData = (chunk) => {
      buffer += chunk.toString('latin1')
      const end = buffer.indexOf('\r\n\r\n')
      if (end === -1) {
        if (buffer.length > MAX_HEAD_BYTES) {
          cleanup()
          reject(new Error('response headers too large'))
        }
        return
      }
      cleanup()
      resolve(buffer.slice(0, end))
    }
    const onError = (error) => {
      cleanup()
      reject(error)
    }
    const onClose = () => {
      cleanup()
      reject(Object.assign(new Error('connection closed before a response head arrived'), { code: CLOSED_EARLY }))
    }
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('close', onClose)
    }
    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
  })
}

/**
 * Wait for a socket to be usable: a TCP connect, or a completed TLS handshake.
 * @param {import('node:net').Socket} socket - the socket to await.
 * @param {boolean} secure - whether the socket is a TLS socket.
 * @returns {Promise<import('node:net').Socket>} the same socket.
 */
function opened(socket, secure) {
  return new Promise((resolve, reject) => {
    const ready = secure ? 'secureConnect' : 'connect'
    const done = () => {
      cleanup()
      resolve(socket)
    }
    const fail = (error) => {
      cleanup()
      reject(error)
    }
    const closed = () => fail(Object.assign(new Error('connection closed before it was ready'), { code: CLOSED_EARLY }))
    const cleanup = () => {
      socket.off(ready, done)
      socket.off('error', fail)
      socket.off('close', closed)
    }
    socket.once(ready, done)
    socket.once('error', fail)
    socket.once('close', closed)
  })
}

/**
 * One `Proxy-Authorization` header when the URL carries a credential.
 * @param {URL} proxy - the configured proxy URL.
 * @returns {string} the header line, or an empty string.
 */
function proxyAuthorization(proxy) {
  if (proxy.username === '' && proxy.password === '') return ''
  const pair = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
  return `Proxy-Authorization: Basic ${Buffer.from(pair).toString('base64')}\r\n`
}

/**
 * Turn a socket error into a short code the page can localize.
 * @param {unknown} error - a socket, TLS, or HTTP failure.
 * @returns {{ code: string, detail: string }} the reason.
 */
function reasonOf(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const detail = error instanceof Error ? error.message : String(error)
  if (code === 'ECONNREFUSED') return { code: 'refused', detail }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENODATA') return { code: 'dns', detail }
  if (code === 'ECONNRESET' || code === 'EPIPE') return { code: 'reset', detail }
  if (code.startsWith('ERR_TLS') || code === 'EPROTO' || code === 'CERT_HAS_EXPIRED') return { code: 'tls', detail }
  if (code === 'ETIMEDOUT' || code === CLOSED_EARLY) return { code: 'timeout', detail }
  return { code: 'error', detail }
}

/**
 * Open the tunnel the probe talks through.
 * @param {(socket: import('node:net').Socket) => import('node:net').Socket} track - registers a socket for teardown.
 * @param {string} proxy - the configured proxy URL, or an empty string for a direct connection.
 * @param {URL} target - the request target.
 * @returns {Promise<import('node:net').Socket>} a socket carrying (or being) the target connection.
 */
async function openTunnel(track, proxy, target) {
  const host = target.hostname
  const port = Number(target.port === '' ? (target.protocol === 'https:' ? 443 : 80) : target.port)
  const secure = target.protocol === 'https:'
  if (proxy === '') {
    const direct = track(secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port }))
    return await opened(direct, secure)
  }
  const proxyUrl = new URL(proxy)
  const proxySecure = proxyUrl.protocol === 'https:'
  const proxyPort = Number(proxyUrl.port === '' ? (proxySecure ? 443 : 80) : proxyUrl.port)
  const toProxy = track(
    proxySecure
      ? tls.connect({ host: proxyUrl.hostname, port: proxyPort, servername: proxyUrl.hostname })
      : net.connect({ host: proxyUrl.hostname, port: proxyPort }),
  )
  await opened(toProxy, proxySecure)
  toProxy.write(
    `CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${proxyAuthorization(proxyUrl)}User-Agent: dsh-http-proxy-probe\r\n\r\n`,
  )
  const proxyAnswer = await readHead(toProxy)
  const proxyStatus = Number(/^HTTP\/1\.[01] (\d{3})/.exec(proxyAnswer)?.[1] ?? 0)
  if (proxyStatus < 200 || proxyStatus >= 300) {
    throw Object.assign(new Error(`the proxy answered HTTP ${proxyStatus === 0 ? 'unknown' : String(proxyStatus)} to CONNECT`), {
      code: 'EPROXYREFUSED',
      proxyStatus,
    })
  }
  if (!secure) return toProxy
  const tunnel = track(tls.connect({ socket: toProxy, servername: host }))
  return await opened(tunnel, true)
}

/**
 * Answer one test-button request: the addresses the page holds when it sent any,
 * the row's active configuration otherwise.
 * @param {unknown} body - the decoded JSON body of the request.
 * @param {{ httpProxy: string, httpsProxy: string }} active - the row's current configuration.
 * @param {{ target?: string, timeoutMs?: number, signal?: AbortSignal }} [options] - target and limits.
 * @returns {Promise<object>} the JSON result the page renders.
 */
export async function probeRequest(body, active, options = {}) {
  const typed = (field) => (typeof body?.[field] === 'string' ? body[field].trim() : undefined)
  const values = {
    httpProxy: typed('httpProxy') ?? active.httpProxy,
    httpsProxy: typed('httpsProxy') ?? active.httpsProxy,
  }
  const target = options.target ?? PROBE_TARGET
  const invalid = unreachable(values)
  if (invalid.length > 0) {
    const advertised = values.httpsProxy || values.httpProxy
    return {
      ok: false,
      target,
      proxy: advertised === '' ? '' : describeProxy(advertised),
      ms: 0,
      code: 'invalid',
      field: invalid[0],
      detail: `${invalid[0]} is not an http(s):// proxy URL`,
    }
  }
  return await probeProxy(values, { ...options, target })
}

/**
 * Probe one proxy configuration with a real request to the target.
 *
 * A configuration with neither address probes a direct connection, which is what
 * the harness would otherwise do; the answer then says whether that works.
 * @param {{ httpProxy: string, httpsProxy: string }} values - the addresses to try.
 * @param {{ target?: string, timeoutMs?: number, signal?: AbortSignal }} [options] - target and limits.
 * @returns {Promise<{ ok: boolean, target: string, proxy: string, status?: number, ms: number, code?: string, detail?: string }>}
 *   the outcome; `proxy` is log-safe and never carries a credential.
 */
export async function probeProxy(values, options = {}) {
  const target = new URL(options.target ?? PROBE_TARGET)
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS
  const configured = target.protocol === 'https:' ? values.httpsProxy || values.httpProxy : values.httpProxy || values.httpsProxy
  const proxy = typeof configured === 'string' ? configured.trim() : ''
  const started = Date.now()
  const sockets = new Set()
  const track = (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    return socket
  }
  const closeAll = () => {
    for (const socket of sockets) socket.destroy()
  }
  let timedOut = false
  let aborted = options.signal?.aborted === true
  const timer = setTimeout(() => {
    timedOut = true
    closeAll()
  }, timeoutMs)
  const onAbort = () => {
    aborted = true
    closeAll()
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const tunnel = await openTunnel(track, proxy, target)
    tunnel.write(
      `GET ${target.pathname}${target.search} HTTP/1.1\r\nHost: ${target.hostname}\r\nAccept: */*\r\nConnection: close\r\nUser-Agent: dsh-http-proxy-probe\r\n\r\n`,
    )
    const head = await readHead(tunnel)
    const status = Number(/^HTTP\/1\.[01] (\d{3})/.exec(head)?.[1] ?? 0)
    if (status === 0) throw Object.assign(new Error('no HTTP status line in the answer'), { code: 'ENOSTATUS' })
    return { ok: status >= 200 && status < 400, target: target.href, proxy: proxy === '' ? '' : describeProxy(proxy), status, ms: Date.now() - started }
  } catch (error) {
    const reason = aborted
      ? { code: 'aborted', detail: 'cancelled' }
      : timedOut
        ? { code: 'timeout', detail: `no answer within ${timeoutMs} ms` }
        : error?.code === 'EPROXYREFUSED'
          ? { code: 'proxy-refused', detail: error.message, status: error.proxyStatus }
          : error?.code === 'ENOSTATUS'
            ? { code: 'no-response', detail: error.message }
            : reasonOf(error)
    return { ok: false, target: target.href, proxy: proxy === '' ? '' : describeProxy(proxy), ms: Date.now() - started, ...reason }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
    closeAll()
  }
}
