/**
 * Browser half of the HTTP proxy bundle: the configuration card on the Plugins
 * page.
 *
 * The card edits this bundle's own Host row (`http-proxy`) through the shared
 * configuration mirror — `ctx.configForms.get(entryId)` — so a saved value
 * reaches the Host plugin as a volatile update and the proxy policy is
 * reinstalled without a restart. Nothing here imports another client package:
 * the card is plain React over that service and the host theme's tokens.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-http-proxy',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Profile entry id of the Host row this page configures. */
    const ENTRY_ID = 'http-proxy'
    /** Package name of the bundle whose pages carry this card. */
    const PACKAGE_NAME = '@local/dsh-http-proxy'
    /** Dictionary namespace owned by this page. */
    const NS = 'settings.httpProxy'

    /** English copy. */
    const en = {
      title: 'HTTP proxy',
      description: 'Route model requests and other outbound HTTP traffic through a proxy.',
      httpProxyLabel: 'HTTP proxy',
      httpProxyHint:
        'Proxy URL for http:// requests, such as http://127.0.0.1:7890. Leave empty to send them directly.',
      httpsProxyLabel: 'HTTPS proxy',
      httpsProxyHint:
        'Proxy URL for https:// requests, which carry model calls. Leave empty to reuse the HTTP proxy.',
      noProxyLabel: 'Bypass list',
      noProxyHint:
        'Comma-separated hosts that skip the proxy, such as .internal or git.corp.example. Loopback always skips it.',
      placeholder: 'http://127.0.0.1:7890',
      overridden: 'Overridden',
      reset: 'Reset to default',
      readOnly: 'This deployment stores settings read-only.',
      loading: 'Loading the current settings…',
      unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
      test: 'Test',
      testing: 'Testing…',
      testHint: 'Sends one real request to www.google.com through the addresses above.',
      direct: 'direct connection',
      unsavedNote: 'unsaved addresses',
      reasonTimeout: 'Timed out',
      reasonRefused: 'The proxy refused the connection',
      reasonDns: 'The proxy address could not be resolved',
      reasonReset: 'The connection was reset',
      reasonTls: 'The TLS handshake failed',
      reasonProxyRefused: 'The proxy refused the tunnel',
      reasonNoResponse: 'The proxy answered without an HTTP status',
      reasonInvalid: 'Not an http(s):// proxy address',
      reasonAborted: 'Cancelled',
      reasonUnavailable: 'The test endpoint is not loaded yet; restart dsh, then reload this page.',
      reasonError: 'The request failed',
    }

    /** Simplified Chinese copy. */
    const zh = {
      title: 'HTTP 代理',
      description: '让模型请求和其他出站 HTTP 流量通过代理发出。',
      httpProxyLabel: 'HTTP 代理',
      httpProxyHint: 'http:// 请求使用的代理地址，例如 http://127.0.0.1:7890；留空表示直连。',
      httpsProxyLabel: 'HTTPS 代理',
      httpsProxyHint: 'https:// 请求（模型调用走这里）使用的代理地址；留空则沿用 HTTP 代理。',
      noProxyLabel: '直连名单',
      noProxyHint:
        '不受代理影响的域名，用逗号分隔，例如 .internal 或 git.corp.example；本机回环地址始终直连。',
      placeholder: 'http://127.0.0.1:7890',
      overridden: '已覆盖',
      reset: '恢复默认',
      readOnly: '本部署的设置为只读。',
      loading: '正在读取当前设置…',
      unavailable: '该插件当前未加载，暂时无法配置。',
      save: '保存',
      saving: '保存中…',
      saveFailed: '本部署没有接受这些值，已保留供你修改。',
      test: '测试',
      testing: '测试中…',
      testHint: '用上面的地址向 www.google.com 发送一次真实请求。',
      direct: '直连',
      unsavedNote: '使用尚未保存的地址',
      reasonTimeout: '超时',
      reasonRefused: '代理拒绝连接',
      reasonDns: '无法解析代理地址',
      reasonReset: '连接被重置',
      reasonTls: 'TLS 握手失败',
      reasonProxyRefused: '代理拒绝建立隧道',
      reasonNoResponse: '代理返回内容不含 HTTP 状态',
      reasonInvalid: '不是 http(s):// 代理地址',
      reasonAborted: '已取消',
      reasonUnavailable: '测试接口还没加载，请重启 dsh 后刷新本页重试。',
      reasonError: '请求失败',
    }

    /** The editable text rows: configuration field, label key, hint key, DOM id. */
    const FIELDS = [
      ['httpProxy', 'httpProxyLabel', 'httpProxyHint', 'plugin-config-http-proxy-http'],
      ['httpsProxy', 'httpsProxyLabel', 'httpsProxyHint', 'plugin-config-http-proxy-https'],
      ['noProxy', 'noProxyLabel', 'noProxyHint', 'plugin-config-http-proxy-bypass'],
    ]

    /** @param {unknown} value @returns {string} one field's configured text. */
    function textOf(value) {
      return typeof value === 'string' ? value : ''
    }

    /**
     * Whether the user layer carries this field, which is what marks it overridden.
     * @param {unknown} user - the raw user layer of the settings section.
     * @param {string} field - the field name.
     * @returns {boolean} true when clearing the field restores an inherited value.
     */
    function overridden(user, field) {
      return user !== null && typeof user === 'object' && Object.hasOwn(user, field)
    }

    /**
     * Draft text for every field, from the accepted section.
     * @param {Record<string, unknown>} accepted - the schema-resolved section.
     * @returns {Record<string, string>} the editable text per field.
     */
    function draftsOf(accepted) {
      const drafts = {}
      for (const [field] of FIELDS) drafts[field] = textOf(accepted[field])
      return drafts
    }

    const labelStyle = {
      display: 'block',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '13px',
      lineHeight: '1.5',
      fontWeight: 600,
      marginBottom: '4px',
    }

    const hintStyle = {
      color: 'var(--dsw-alias-label-secondary)',
      fontSize: '12px',
      lineHeight: '1.5',
      margin: '4px 0 0',
    }

    /** @param {boolean} disabled @returns {Record<string, string>} one input's style. */
    function inputStyle(disabled) {
      return {
        boxSizing: 'border-box',
        width: '100%',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: disabled ? 'var(--dsw-alias-bg-layer-1)' : 'var(--dsw-alias-bg-layer-2)',
        color: disabled ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        lineHeight: '1.5',
        fontFamily: 'inherit',
      }
    }

    const rowStyle = { display: 'grid', gap: '0', marginBottom: '14px' }

    /** Result codes the Host probe returns and the dictionary key that explains each. */
    const REASONS = {
      timeout: 'reasonTimeout',
      refused: 'reasonRefused',
      dns: 'reasonDns',
      reset: 'reasonReset',
      tls: 'reasonTls',
      'proxy-refused': 'reasonProxyRefused',
      'no-response': 'reasonNoResponse',
      invalid: 'reasonInvalid',
      aborted: 'reasonAborted',
      unavailable: 'reasonUnavailable',
      error: 'reasonError',
    }

    /**
     * A proxy address safe to print: scheme, host, and port only.
     * @param {string} value - a configured proxy URL.
     * @returns {string} the address, or the input when it does not parse.
     */
    function describe(value) {
      try {
        const url = new URL(value)
        return `${url.protocol}//${url.host}`
      } catch {
        return value
      }
    }

    const actionsStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '4px',
    }

    /** One probe-result line: success, failure, and the neutral progress state. */
    const resultStyle = (tone) => ({
      margin: '8px 0 0',
      fontSize: '12px',
      lineHeight: '1.5',
      color:
        tone === 'ok'
          ? 'var(--dsw-alias-state-success-primary)'
          : tone === 'error'
            ? 'var(--dsw-alias-state-error-primary)'
            : 'var(--dsw-alias-label-secondary)',
    })

    const buttonStyle = (primary, disabled) => ({
      padding: '5px 12px',
      borderRadius: '6px',
      fontSize: '13px',
      lineHeight: '1.5',
      fontFamily: 'inherit',
      cursor: disabled ? 'default' : 'pointer',
      border: primary ? '1px solid var(--dsw-alias-brand-primary)' : '1px solid var(--dsw-alias-border-l2)',
      background: primary ? 'var(--dsw-alias-brand-primary)' : 'transparent',
      color: primary ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-label-primary)',
      opacity: disabled ? 0.5 : 1,
    })

    /**
     * The editable proxy form: one staged draft per field, saved through the
     * shared form so concurrent editors of this entry cannot lose a write.
     * @param {{ t: (key: string) => string, form: object }} props - locale reader and the entry's form.
     * @returns {unknown} the form.
     */
    function ProxyForm(props) {
      const { t, form } = props
      const subscribe = React.useCallback((listener) => form.subscribe(listener), [form])
      const getSnapshot = React.useCallback(() => form.getSnapshot(), [form])
      const snapshot = React.useSyncExternalStore(subscribe, getSnapshot)
      const accepted = snapshot.value ?? {}
      const acceptedText = FIELDS.map(([field]) => textOf(accepted[field])).join('\u0000')
      const [drafts, setDrafts] = React.useState(() => draftsOf(accepted))
      const [dirty, setDirty] = React.useState(false)
      const [saving, setSaving] = React.useState(false)
      const [failed, setFailed] = React.useState(false)
      const [probe, setProbe] = React.useState(undefined)

      React.useEffect(() => {
        if (dirty) return
        setDrafts(draftsOf(accepted))
        // acceptedText changes whenever the Host accepts a different section.
      }, [acceptedText, dirty])

      if (snapshot.status === 'unavailable') {
        return h('p', { style: hintStyle }, t('unavailable'))
      }
      if (snapshot.status === 'loading') {
        return h('p', { style: hintStyle }, t('loading'))
      }

      const writable = snapshot.writable === true
      const busy = !writable || saving

      /** Write every field whose draft differs from the accepted section. */
      const save = async () => {
        setSaving(true)
        setFailed(false)
        let acceptedAll = true
        try {
          for (const [field] of FIELDS) {
            const desired = drafts[field].trim()
            if (desired === textOf(accepted[field]).trim()) continue
            // An empty value is a real choice: it overrides the composition's
            // address and tells the Host row to send that scheme directly.
            if (!(await form.set(field, desired))) acceptedAll = false
          }
          setDirty(false)
          setFailed(!acceptedAll)
        } catch (error) {
          setFailed(true)
        } finally {
          setSaving(false)
        }
      }

      /** Clear every override this page writes, restoring the composition values. */
      const resetAll = async () => {
        setSaving(true)
        setFailed(false)
        let acceptedAll = true
        try {
          for (const [field] of FIELDS) {
            if (!overridden(snapshot.user, field)) continue
            if (!(await form.unset(field))) acceptedAll = false
          }
          setDirty(false)
          setFailed(!acceptedAll)
        } catch (error) {
          setFailed(true)
        } finally {
          setSaving(false)
        }
      }

      const rows = FIELDS.map(([field, label, hint, id]) =>
        h(
          'div',
          { key: field, style: rowStyle },
          h(
            'label',
            { htmlFor: id, style: labelStyle },
            t(label),
            overridden(snapshot.user, field) ? h('span', { style: { ...hintStyle, display: 'inline', marginLeft: '6px' } }, `(${t('overridden')})`) : null,
          ),
          h('input', {
            id,
            type: 'text',
            value: drafts[field],
            disabled: busy,
            spellCheck: false,
            autoComplete: 'off',
            placeholder: t('placeholder'),
            style: inputStyle(busy),
            onChange: (event) => {
              const value = event.target.value
              setDirty(true)
              setDrafts((current) => ({ ...current, [field]: value }))
            },
          }),
          h('p', { style: hintStyle }, t(hint)),
        ),
      )

      const testing = probe !== undefined && probe.status === 'running'
      const draftRoute = describe((drafts.httpsProxy || drafts.httpProxy).trim())
      const unsaved = FIELDS.some(([field]) => drafts[field].trim() !== textOf(accepted[field]).trim())

      /**
       * Ask the Host to send one real request to Google through the addresses in
       * this form, whether or not they are saved yet.
       */
      const runTest = async () => {
        const advertised = (drafts.httpsProxy || drafts.httpProxy).trim()
        setProbe({ status: 'running', proxy: describe(advertised) })
        try {
          const response = await fetch(new URL('api/dsh-http-proxy/probe', document.baseURI), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ httpProxy: drafts.httpProxy.trim(), httpsProxy: drafts.httpsProxy.trim() }),
          })
          if (!response.ok) {
            // The route belongs to the Host generation this bundle shipped with;
            // a missing route means that generation has not been loaded yet.
            setProbe({
              status: 'done',
              result: { ok: false, code: 'unavailable', proxy: describe(advertised), ms: 0, detail: `HTTP ${response.status}` },
            })
            return
          }
          setProbe({ status: 'done', result: await response.json() })
        } catch (error) {
          setProbe({
            status: 'done',
            result: {
              ok: false,
              code: 'error',
              proxy: describe(advertised),
              ms: 0,
              detail: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }

      let probeView = null
      if (probe !== undefined) {
        if (probe.status === 'running') {
          probeView = h('p', { style: resultStyle('idle') }, ['… www.google.com · ', probe.proxy === '' ? t('direct') : probe.proxy])
        } else {
          const result = probe.result ?? {}
          const route = typeof result.proxy === 'string' && result.proxy !== '' ? result.proxy : t('direct')
          const detail = typeof result.detail === 'string' ? result.detail : undefined
          probeView =
            result.ok === true
              ? h('p', { style: resultStyle('ok') }, [
                  `✓ www.google.com · ${route} · HTTP ${String(result.status)} · ${String(result.ms)} ms`,
                ])
              : h('p', { style: resultStyle('error'), title: detail }, [
                  `✗ www.google.com · ${route} · ${t(REASONS[result.code] ?? 'reasonError')} · ${String(result.ms ?? 0)} ms`,
                ])
          if (unsaved) {
            probeView = h('div', null, probeView, h('p', { style: hintStyle }, t('unsavedNote')))
          }
        }
      }

      return h(
        'div',
        null,
        rows,
        h(
          'div',
          { style: actionsStyle },
          h(
            'button',
            { type: 'button', style: buttonStyle(true, busy), disabled: busy, onClick: save },
            saving ? t('saving') : t('save'),
          ),
          h(
            'button',
            { type: 'button', style: buttonStyle(false, busy || testing), disabled: busy || testing, onClick: runTest },
            testing ? t('testing') : t('test'),
          ),
          FIELDS.some(([field]) => overridden(snapshot.user, field))
            ? h(
                'button',
                { type: 'button', style: buttonStyle(false, busy || testing), disabled: busy || testing, onClick: resetAll },
                t('reset'),
              )
            : null,
          failed ? h('span', { style: { ...hintStyle, color: 'var(--dsw-alias-state-error-primary)' } }, t('saveFailed')) : null,
          writable ? null : h('span', { style: hintStyle }, t('readOnly')),
        ),
        h('p', { style: hintStyle }, t('testHint')),
        probeView,
      )
    }

    /**
     * Render the card's one-liner or its form, as the Plugins page asks.
     * @param {{ view: 'summary' | 'page', t: (key: string) => string, form?: object }} props - the requested view and its face.
     * @returns {unknown} the one-liner, or the form.
     */
    function ProxyCard(props) {
      const { t } = props
      if (props.view === 'summary') return t('description')
      return h(ProxyForm, { t, form: props.form })
    }

    /** Required services (cordis fiber inject). */
    const inject = ['slots', 'locale', 'configForms']

    /**
     * Mount the proxy page on the bundle's own page and on the row's page. A
     * third-party bundle's configuration belongs in these two slots;
     * `plugins.item` is reserved for the official settings pages. The form is
     * read by id, so a deployment that switched the row off shows the card's own
     * unavailable status instead of a page that silently does nothing.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'http-proxy: dictionaries')
      const form = ctx.configForms.get(ENTRY_ID)
      const pages = [
        ['plugins.bundle.config', PACKAGE_NAME],
        ['plugins.row.config', `${PACKAGE_NAME}#${ENTRY_ID}`],
      ]
      ctx.effect(() => {
        const disposers = pages.map(([name, key]) =>
          ctx.slots.inject(name, () =>
            ctx.slots.register(
              {
                name,
                key,
                locale: NS,
                inject: () => ({ form }),
              },
              ProxyCard,
            ),
          ),
        )
        return () => {
          for (const dispose of disposers) dispose()
        }
      }, 'http-proxy: page')
    }

    return { NS, apply, inject }
  },
})
