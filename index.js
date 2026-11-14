/**
 * Host half of the HTTP proxy bundle.
 *
 * Node's built-in `fetch` ignores `HTTP_PROXY`, so a model request connects
 * directly no matter what a user exported. This plugin resolves one policy from
 * its own volatile configuration and installs it as undici's global dispatcher
 * through `@deepseek-ai/dsh-http-proxy`, so every caller that issues a plain
 * `fetch()` — the LLM adapters, web search, HTTP MCP servers — uses the proxy
 * without knowing it exists.
 *
 * An empty configuration keeps the launch environment's policy, which the `dsh`
 * launcher installs before the first plugin mounts. A value this process cannot
 * route through keeps the previous routing and is reported instead of silently
 * connecting directly.
 */
import z from '@deepseek-ai/schemastery'
import { installProxyFromEnvironment } from '@deepseek-ai/dsh-http-proxy'
import {
  describeProxy,
  policyEnvironment,
  readConfig,
  requestsProxy,
  routeable,
  unreachable,
} from './policy.js'
import { probeRequest } from './probe.js'

/** Route the Plugins page's test button posts to. */
const PROBE_ROUTE = '/api/dsh-http-proxy/probe'

/**
 * The row's configuration. Every field is volatile so the Plugins page's form
 * can save it in place: the value reaches this plugin through
 * `loader/volatile-update` instead of remounting the plugin.
 */
export const Config = z.object({
  httpProxy: z
    .string()
    .description('Proxy for http: requests, such as http://127.0.0.1:7890. Empty sends them directly.')
    .volatile(),
  httpsProxy: z
    .string()
    .description('Proxy for https: requests, which carry model calls. Empty reuses the http proxy.')
    .volatile(),
  noProxy: z
    .string()
    .description('Comma-separated hosts that bypass the proxy. Loopback always bypasses it.')
    .volatile(),
})

/**
 * Install the configured policy, and reinstall it whenever the form saves.
 * @param ctx - the plugin's Host context.
 * @param config - the row's volatile configuration proxy.
 */
export function apply(ctx, config) {
  /** Disposer of the policy this plugin installed, when one is installed. */
  let installed
  /** Serializes reconciliation so overlapping saves cannot interleave installs. */
  let tail = Promise.resolve()
  /** Set once the plugin is disposed, so a late install closes itself. */
  let stopped = false

  /**
   * Dispose the installed policy, restoring the dispatcher and the environment
   * beneath it. A policy that was never installed leaves the process untouched.
   */
  const release = async () => {
    const dispose = installed
    installed = undefined
    if (dispose !== undefined) await dispose()
  }

  /** Bring the process in line with the current configuration. */
  const reconcile = async () => {
    const values = readConfig(config)
    const invalid = unreachable(values)
    if (invalid.length > 0) {
      ctx.logger.warn(
        `http-proxy: ${invalid.join(', ')} is not an http(s):// proxy URL; keeping the current routing`,
      )
      return
    }
    if (!requestsProxy(values)) {
      if (installed === undefined) return
      await release()
      ctx.logger.info('http-proxy: no proxy configured; the launch environment policy applies again')
      return
    }
    await release()
    const dispose = await installProxyFromEnvironment(policyEnvironment(values), (message) => {
      ctx.logger.warn(`http-proxy: ${message}`)
    })
    if (stopped) {
      await dispose()
      return
    }
    installed = dispose
    ctx.logger.info(
      `http-proxy: outbound HTTP requests route through ${describeProxy(values.httpsProxy || values.httpProxy)}`,
    )
  }

  /** Queue one reconciliation behind every earlier one. */
  const schedule = () => {
    tail = tail.then(reconcile, reconcile).catch((error) => {
      ctx.logger.warn(error)
    })
    return tail
  }

  ctx.on('loader/volatile-update', () => {
    schedule()
  })
  ctx.effect(
    () => () => {
      stopped = true
      return tail.then(release)
    },
    'http-proxy: policy',
  )

  /**
   * The Plugins page's test button: one real request to Google through the
   * addresses the page holds, on its own tunnel, so trying a value never
   * disturbs the installed policy.
   */
  ctx.inject(['connection'], (scope) => {
    scope.effect(
      () =>
        scope.connection.fetch.register({
          path: PROBE_ROUTE,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => undefined)
            return Response.json(await probeRequest(body, readConfig(config), { signal: request.signal }))
          },
        }),
      'http-proxy: test route',
    )
  })

  schedule()
}
