---
description: "A dsh profile bundle that routes model requests and other outbound HTTP traffic through a configurable HTTP proxy, editable on the Plugins page."
kind: "package-bundle"
---

# dsh-http-proxy

English | [中文](README.zh.md)

A [dsh](https://github.com/deepseek-ai/deepseek-harness) profile bundle that sends
the Harness process's outbound HTTP traffic through one configurable proxy, and
lets you change — and test — that proxy from the Web UI.

## Summary

Node's built-in `fetch` ignores `HTTP_PROXY`, so without help every model request
connects directly. This bundle makes the harness send outbound HTTP through one
proxy policy: the `http-proxy` row installs it as undici's global dispatcher
through the shipped `@deepseek-ai/dsh-http-proxy` library, and the browser half
adds an **HTTP proxy** page where the addresses can be changed without editing
YAML.

## Features

- Process-wide coverage: model requests, web search / fetch, and HTTP MCP servers
  that issue a plain `fetch()` all use the proxy, with no call-site changes.
- Zero-config default: an empty configuration keeps the launch environment's
  policy (`http_proxy` / `https_proxy` / `no_proxy` / `all_proxy`, including
  `$DSH_HOME/.env`), which the `dsh` launcher already resolved before the first
  plugin mounted.
- Editable from the Web UI: the three fields save into the profile's own patch
  and reinstall the policy in place — no restart, no hand-edited YAML.
- Built-in test: one real request to `https://www.google.com/generate_204`
  through the addresses currently in the inputs, saved or not, reported beside
  the buttons.
- Safe defaults: loopback is always bypassed, and a proxy URL this process cannot
  route through is reported instead of silently connecting directly.

## Requirements

- dsh `0.2.2-rc.1` (tested) with the Web app bundle, for the browser half.
- Nothing else to install: the bundle's two dependencies,
  `@deepseek-ai/dsh-http-proxy` and `@deepseek-ai/schemastery`, are shipped by
  dsh itself and resolve from the installation or the profile.

## Installation

This package is not published to npm; install it from this Git repository.
Replace `<owner>` with the GitHub account that hosts it.

### Web UI (recommended)

1. Open the dsh Web UI and select **Plugins** in the sidebar.
2. Press **Add plugin** and enter `github:<owner>/dsh-http-proxy-plugin`
   (a full `https://github.com/<owner>/dsh-http-proxy-plugin` URL also works).
3. Press **Install**, then **Enable now** on the finished screen.
4. Refresh the page if the new card does not appear. On a profile with HMR the
   bundle is applied live, without restarting dsh.

### Agent tool

Ask the agent in that dsh instance to install the bundle:

```text
plugin_manager({ action: "install_bundle", target: "github:<owner>/dsh-http-proxy-plugin" })
```

`install_bundle` installs the package, selects its bundle layer, and applies it.
Read the returned `application`: `applied` means it is live; `restart-required`
means this profile runs without HMR and dsh has to be restarted.

### CLI

```sh
dsh plugin --profile <profile> add github:<owner>/dsh-http-proxy-plugin
```

That installs the package, records the dependency, and selects its bundle layer;
a running dsh with HMR applies it, otherwise the next start picks it up. If the
bundle was installed with activation disabled or the layer is deselected, enable
it on the Plugins page (or ask the agent for `plugin_manager` `set_bundle` with
`enabled: true`).

### From a local directory (development)

```text
plugin_manager({ action: "install_bundle", target: "/absolute/path/to/dsh-http-proxy-plugin" })
```

A local path is recorded as a `link:` dependency, so the directory is the live
source. After editing the code, restart dsh or switch the bundle off and on to
remount it.

### Confirm the installation

The Web UI's **Plugins** page shows an **HTTP proxy** card with the bundle's
rows, and `dsh --profile <profile> --dump-config` lists:

```yaml
- id: http-proxy
  name: '@local/dsh-http-proxy'
  config:
    httpProxy: http://127.0.0.1:20172
    httpsProxy: http://127.0.0.1:20172
```

## Configuration

| Field | Meaning |
| --- | --- |
| `httpProxy` | Proxy for `http:` requests, such as `http://127.0.0.1:7890`. Empty sends them directly. |
| `httpsProxy` | Proxy for `https:` requests, which carry model calls. Empty reuses `httpProxy`. |
| `noProxy` | Comma-separated hosts that skip the proxy, such as `.internal` or `git.corp.example`. Loopback always skips it. |

The defaults ship in [`cordis.patch.yml`](cordis.patch.yml) and point at
`http://127.0.0.1:20172`; change them there for a machine-wide default, or from
the Plugins page for this profile only. Both proxy fields empty means "keep the
launch environment's policy". A value that is not an `http(s)://` URL is reported
and the previous routing is kept; a SOCKS or PAC URL is refused by the shared
resolver the same way.

### From the Web UI

Select **Plugins** in the sidebar and open the **HTTP proxy** bundle: its
configuration section holds the three fields. **Save** writes the values into the
profile's own patch and reinstalls the policy in place. **Reset to default** clears
the override so the values in `cordis.patch.yml` apply again.

**Test** sends one real request to `https://www.google.com/generate_204` through
the addresses currently in the inputs — saved or not — and reports the outcome
beside the buttons, for example `✓ www.google.com · <proxy> · HTTP 204 · 412 ms`
or `✗ … · The proxy refused the connection`. The request opens its own tunnel
inside the Harness process and never touches the installed dispatcher, so testing
a value that does not work cannot disturb an in-flight model request. Typed but
unsaved addresses are labeled `unsaved addresses` under the result.

Each field is declared `.volatile()` in the Host Config, which is what lets the
page save a value without remounting the plugin: the value arrives as a
`loader/volatile-update` and `apply` reconciles the policy.

## What gets proxied

Everything in the Harness process that issues a plain `fetch()`:

| Traffic | Covered |
| --- | --- |
| Model requests from the LLM adapters (pi-ai, DeepSeek) | yes |
| Web search / fetch providers | yes |
| HTTP MCP servers | yes |
| Loopback traffic (the Web UI, the Connection transport, local test servers) | no — always direct |
| Child processes | inherit the same proxy variables; see the note below |
| OTLP telemetry | no — it posts through `node:http`, which no dispatcher reaches |

Model-authored programs (workflow workers, the PTC runtime) deliberately receive
no proxy URL, because it may carry credentials.

## How it works

- `index.js` is the Host half: `Config` with the three volatile fields, a
  serialized reconciliation loop that installs or disposes the policy, and the
  test route `POST /api/dsh-http-proxy/probe` on the Connection transport.
- `policy.js` is pure plumbing: configuration snapshot → resolver environment
  face, URL validation, log-safe addresses.
- `probe.js` is the test button's tunnel: `CONNECT`, TLS, one `GET`, timeout and
  reason mapping — Node built-ins only, no dispatcher involved.
- `client.js` is the browser half: the configuration card over the shared
  settings form, registered into the `plugins.bundle.config` and
  `plugins.row.config` slots. It imports only React primitives, so a moved
  internal client package cannot break it.
- `cordis.patch.yml` inserts the `http-proxy` row with the default addresses.

## Files

| File | Holds |
| --- | --- |
| `index.js` | The Host plugin: `Config`, the reconciliation loop, policy disposal, and the test route. |
| `policy.js` | Configuration snapshot → resolver environment face, URL validation, log-safe addresses. |
| `probe.js` | The test button's tunnel: CONNECT, TLS, one `GET`, timeout and reason mapping. |
| `client.js` | The browser half: the configuration card over the shared settings form. |
| `cordis.patch.yml` | The `http-proxy` row this bundle inserts, with the default addresses. |
| `locale/*.json` | Bundle title, description, and detail-document pointers used by the Plugins page. |
| `icon.svg` | The bundle's artwork in the Plugins lists and pages. |

## Troubleshooting

- **Model requests still go direct.** Confirm the bundle and its `http-proxy` row
  are on, then use **Test** in the HTTP proxy card. Both fields empty means "keep
  the launch environment": check `env | grep -i proxy` and `$DSH_HOME/.env`.
- **The Test button reports a timeout with both fields empty.** This machine has
  no direct egress, which is expected when a proxy is required; fill in the
  proxy and test again.
- **TLS errors with an intercepting proxy.** Set `NODE_EXTRA_CA_CERTS` to the
  proxy's CA file before launching dsh; the process reads it only at startup.
- **Installation refused.** The bundle pins the dsh version it was verified
  against through its peer dependencies. On a different dsh release, adjust the
  ranges in `package.json` or use the profile's version exemption, then reinstall.
- **Configuration is read-only.** This deployment stores profile settings
  read-only; configure the row in the profile's `cordis.patch.yml` instead.

## Limits

- One policy per process, because transport policy has one answer per process.
- No SOCKS, PAC, or operating-system proxy detection; only `http(s)://` URLs.
- A TLS-intercepting corporate proxy needs `NODE_EXTRA_CA_CERTS` before launch.
- There is no `enabled` field: switch the row off on the Plugins page instead,
  which restores the launch environment's policy.

## Requirements for the Host

`dsh` `0.2.2-rc.1` is the version this bundle was written and verified against.
The `@deepseek-ai/dsh-http-proxy` and `@deepseek-ai/schemastery` peer ranges in
[`package.json`](package.json) are what the profile's compatibility check reads,
so a different dsh release needs matching ranges.
