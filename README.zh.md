---
description: "dsh 的 HTTP 代理 profile bundle：让模型请求和其他出站 HTTP 流量通过一份可配置的代理发出，并可在插件页面直接修改与测试。"
kind: "package-bundle"
---

# dsh-http-proxy

[English](README.md) | 中文

一个 [dsh](https://github.com/deepseek-ai/deepseek-harness) 的 profile bundle：
让 Harness 进程的所有出站 HTTP 流量走同一份可配置的代理，并允许你在 Web UI 里
修改和测试这份代理配置。

## 概述

Node 内置的 `fetch` 不读取 `HTTP_PROXY`，因此没有额外支持时，每个模型请求都会直连。
本 bundle 让 harness 统一走一份代理策略：`http-proxy` 这一行通过 dsh 自带的
`@deepseek-ai/dsh-http-proxy` 库把策略安装为 undici 的全局 dispatcher；浏览器端则在
**插件**页面提供 **HTTP 代理** 卡片，不必手改 YAML 就能修改地址。

## 特性

- **进程级覆盖**：模型请求、web 搜索 / 抓取、HTTP MCP 等所有走普通 `fetch()` 的调用
  都会经过代理，调用方无需改动。
- **零配置默认**：配置留空时沿用启动环境的策略（`http_proxy` / `https_proxy` /
  `no_proxy` / `all_proxy`，包括 `$DSH_HOME/.env`）。`dsh` 启动器在第一个插件挂载前
  就已经解析好了这份策略。
- **Web UI 可编辑**：三个字段保存进 profile 自己的 patch，并在原地重装策略 —— 无需重启，
  也无需手写 YAML。
- **内置测试**：用输入框里当前（无论是否已保存）的地址，向
  `https://www.google.com/generate_204` 发一次真实请求，结果直接显示在按钮旁。
- **安全默认值**：本机回环地址始终直连；无法路由的代理 URL 会被明确报告，而不是悄悄
  改成直连。

## 环境要求

- dsh `0.2.2-rc.1`（已验证版本），并启用 Web app bundle（浏览器端需要）。
- 无需额外安装依赖：本 bundle 依赖的 `@deepseek-ai/dsh-http-proxy` 与
  `@deepseek-ai/schemastery` 由 dsh 自带，可从 dsh 安装目录或 profile 解析。

## 安装

本包未发布到 npm，请从本 Git 仓库安装。下面的 `<owner>` 请替换为托管本仓库的 GitHub
账号。

### Web UI（推荐）

1. 打开 dsh Web UI，点击侧边栏的 **插件（Plugins）**。
2. 点击 **添加插件（Add plugin）**，填入 `github:<owner>/dsh-http-proxy-plugin`
   （完整的 `https://github.com/<owner>/dsh-http-proxy-plugin` 地址也可以）。
3. 点击 **安装（Install）**，完成后再点 **立即启用（Enable now）**。
4. 如果新卡片没有立刻出现，刷新页面即可。带 HMR 的 profile 会在线应用，无需重启 dsh。

### 让 agent 安装

在该 dsh 实例里让 agent 执行：

```text
plugin_manager({ action: "install_bundle", target: "github:<owner>/dsh-http-proxy-plugin" })
```

`install_bundle` 会安装包、选中它的 bundle 层并应用。注意返回的 `application`：
`applied` 表示已在线生效；`restart-required` 表示该 profile 没有 HMR，需要重启 dsh。

### 命令行

```sh
dsh plugin --profile <profile> add github:<owner>/dsh-http-proxy-plugin
```

这条命令会安装包、记录依赖并选中它的 bundle 层；带 HMR 的运行中 dsh 会直接应用，
否则下次启动生效。如果安装时关闭了激活、或之后手动取消了该层，请在插件页面重新启用
（或让 agent 执行 `plugin_manager` 的 `set_bundle`，`enabled: true`）。

### 从本地目录安装（开发用）

```text
plugin_manager({ action: "install_bundle", target: "/绝对路径/dsh-http-proxy-plugin" })
```

本地路径会记录为 `link:` 依赖，该目录就是实时源码。改完代码后重启 dsh，或把 bundle
关掉再打开即可重新挂载。

### 确认安装成功

Web UI 的 **插件** 页面会出现 **HTTP 代理** 卡片及其插件行；
`dsh --profile <profile> --dump-config` 也能看到：

```yaml
- id: http-proxy
  name: '@local/dsh-http-proxy'
  config:
    httpProxy: http://127.0.0.1:20172
    httpsProxy: http://127.0.0.1:20172
```

## 配置

| 字段 | 含义 |
| --- | --- |
| `httpProxy` | `http:` 请求使用的代理，例如 `http://127.0.0.1:7890`；留空表示直连。 |
| `httpsProxy` | `https:` 请求（模型调用走这里）使用的代理；留空则沿用 `httpProxy`。 |
| `noProxy` | 不走代理的域名，用逗号分隔，例如 `.internal` 或 `git.corp.example`；本机回环始终直连。 |

默认值写在 [`cordis.patch.yml`](cordis.patch.yml) 中（`http://127.0.0.1:20172`）：
改该文件可作为整机默认值，改插件页面则只影响当前 profile。两个代理字段都留空表示
“沿用启动环境策略”。不是 `http(s)://` 的值会被报告并保持原有路由；SOCKS 或 PAC URL
会被共享解析器以同样方式拒绝。

### 在 Web UI 中操作

在侧边栏选择 **插件**，打开 **HTTP 代理** bundle：配置区就是这三个字段。**保存** 会把值
写进 profile 自己的 patch，并原地重装策略；**恢复默认** 会清除覆盖值，让
`cordis.patch.yml` 中的值重新生效。

**测试** 会用输入框里当前的地址（无论是否保存）向
`https://www.google.com/generate_204` 发一次真实请求，并在按钮旁显示结果，例如
`✓ www.google.com · <代理> · HTTP 204 · 412 ms`，或
`✗ … · 代理拒绝连接`。这次请求在 Harness 进程内自建隧道，不经过已安装的 dispatcher，
因此测试一个不可用的值不会影响正在进行的模型请求。输入了但未保存的地址会在结果下方
标注 `使用尚未保存的地址`。

每个字段在 Host Config 中声明为 `.volatile()`，这正是页面保存后无需重新挂载插件的
原因：新值以 `loader/volatile-update` 送达，`apply` 随即重新协调代理策略。

## 会被代理的流量

Harness 进程中所有走普通 `fetch()` 的流量：

| 流量 | 是否走代理 |
| --- | --- |
| LLM 适配器（pi-ai、DeepSeek）发出的模型请求 | 是 |
| web 搜索 / 抓取 provider | 是 |
| HTTP MCP server | 是 |
| 本机回环（Web UI、Connection 传输、本地测试服务） | 否 —— 始终直连 |
| 子进程 | 继承同样的代理环境变量（见下文说明） |
| OTLP telemetry | 否 —— 它走 `node:http`，dispatcher 覆盖不到 |

模型编写的程序（workflow worker、PTC runtime）有意不接收代理 URL，因为其中可能带有
凭据。

## 工作原理

- `index.js` 是 Host 半：包含三个 volatile 字段的 `Config`、串行化的协调循环（安装或
  释放策略）、以及 Connection 传输上的测试路由 `POST /api/dsh-http-proxy/probe`。
- `policy.js` 是纯逻辑：配置快照 → 解析器环境接口、URL 校验、日志安全的地址描述。
- `probe.js` 是测试按钮的隧道：`CONNECT`、TLS、一次 `GET`、超时与原因映射 —— 只用
  Node 内置模块，不经过 dispatcher。
- `client.js` 是浏览器半：基于共享设置表单的配置卡片，注册进
  `plugins.bundle.config` 与 `plugins.row.config` 两个 slot。它只依赖 React 原语，
  因此 dsh 内部客户端包调整位置不会破坏它。
- `cordis.patch.yml` 插入 `http-proxy` 行，并给出默认地址。

## 文件

| 文件 | 内容 |
| --- | --- |
| `index.js` | Host 插件：`Config`、协调循环、策略释放、测试路由。 |
| `policy.js` | 配置快照 → 解析器环境接口、URL 校验、日志安全的地址描述。 |
| `probe.js` | 测试按钮的隧道：CONNECT、TLS、一次 `GET`、超时与原因映射。 |
| `client.js` | 浏览器半：基于共享设置表单的配置卡片。 |
| `cordis.patch.yml` | 本 bundle 插入的 `http-proxy` 行及其默认地址。 |
| `locale/*.json` | 插件页面使用的标题、描述和详情文档指针。 |
| `icon.svg` | 插件列表与详情页中的图标。 |

## 常见问题

- **模型请求仍然直连。** 确认 bundle 和 `http-proxy` 行都已启用，然后在 HTTP 代理卡片里
  点 **测试**。两个字段都为空时表示“沿用启动环境”：检查 `env | grep -i proxy` 和
  `$DSH_HOME/.env`。
- **两个字段为空时测试超时。** 说明本机没有直连出口，需要在必须走代理的环境里属正常
  现象；填入代理地址后重新测试。
- **使用 TLS 拦截代理时报错。** 在启动 dsh 前把 `NODE_EXTRA_CA_CERTS` 指向代理的 CA
  文件；进程只在启动时读取它。
- **安装被拒绝。** bundle 通过 peer dependencies 锁定了验证过的 dsh 版本。换用其他 dsh
  版本时，请调整 `package.json` 中的版本范围，或使用 profile 的版本豁免，然后重新安装。
- **配置为只读。** 该部署的 profile 设置是只读的；请改为在 profile 的
  `cordis.patch.yml` 中配置该行。

## 限制

- 每个进程只有一份策略，因为传输策略在每个进程中只有一个答案。
- 不支持 SOCKS、PAC，也不做操作系统代理探测；只接受 `http(s)://` URL。
- 使用 TLS 拦截代理时，需要在启动前设置 `NODE_EXTRA_CA_CERTS`。
- 没有 `enabled` 字段：请改为在插件页面关掉该行，这会恢复启动环境的策略。

## Host 版本要求

`dsh` `0.2.2-rc.1` 是本 bundle 编写和验证所用的版本。[`package.json`](package.json)
中 `@deepseek-ai/dsh-http-proxy` 与 `@deepseek-ai/schemastery` 的 peer 范围就是 profile
兼容性检查读取的内容，因此换用其他 dsh 版本时需要匹配的范围。
