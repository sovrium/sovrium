/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "MCP" docs surface.
 *
 * The operator-facing reference for connecting an external AI (Claude, Cursor…)
 * to THIS instance over MCP. Fully static, server-rendered config — the live
 * `admin-mcp-connect` credential-issuance island was RETIRED in the [internal ref]
 * dogfood pass (accepted loss: the live-origin fill-in, one-click credential
 * copy, and live status pill). Four parts:
 *
 *  1. A static MCP endpoint reference — a first-class `content/code` block naming
 *     the config-derived `/mcp` mount path at the instance's resolved origin
 *     (`BASE_URL` → proxy/`Host` headers → the request URL).
 *  2. An "Issue a credential" card — a `content/code` curl documenting the
 *     RFC-7591 dynamic client-registration endpoint (`POST /api/auth/oauth2/register`),
 *     run signed in: anonymous registration is refused `401` by default since
 * [internal ref]. The response returns the operator's `client_id` / `client_secret`
 *     to paste into the AI client.
 *  3. A static "reference configuration" card — the MCP client config SHAPE
 *     rendered as a first-class `content/code` (JSON) block, so the operator
 *     understands the structure they paste into Claude / Cursor.
 *  4. The available-tools list — server-rendered from the live operator config
 *     ({@link listMcpTools}): one row per table/operation, action template, and
 *     manual automation that opts into `aiAccess`. The tool names mirror exactly
 *     what the server advertises over `tools/list`. When the app exposes no
 *     tools, an honest guidance state explains how to expose one.
 *
 * Reachable at `/_admin/mcp` (a Developers nav entry).
 *
 * Wrapped in the persistent 3-zone shell so the sidebar + breadcrumb persist.
 */

import {
  listMcpTools,
  type McpToolCategory,
  type McpToolListing,
} from '@/domain/utils/admin-mcp-tool-listing'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Shell-wrap concerns for the standalone MCP docs surface. */
export interface McpDocsOptions {
  /** F6 tier / F5 editing flag; threaded into the shell for signature parity. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
  /**
   * The instance's resolved public origin (no trailing slash), prefixing the MCP
   * mount, the RFC-7591 register curl, and the `mcpServers` reference JSON — the
   * three blocks an AI client needs to actually connect. Resolved by the route
   * handler from `BASE_URL` → proxy/`Host` headers → the request URL
   * (`resolveRequestBaseUrl`), and already defaulted by the surface builder to a
   * placeholder label for the non-HTTP caller that has no request to resolve
   * from — so this is always safe to interpolate.
   */
  readonly origin: string
}

/** The page header: title + a one-line plain-spoken intro. */
function header(): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h1',
        props: { className: 'text-2xl font-semibold tracking-tight' },
        content: 'MCP',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-2xl text-sm' },
        content:
          'Connect your AI (Claude, Cursor…) to this instance over MCP. Issue a ' +
          'credential, paste the config into your client, and your AI reaches the ' +
          'tools below — reading and writing data, actions, and automations.',
      },
    ],
  } as unknown as Component
}

/**
 * The config-derived `/mcp` mount URL at the instance's resolved origin. Reused
 * by both the endpoint reference block and {@link referenceWiring} so the two
 * static blocks agree on the mount literal an operator copies out.
 */
const mcpEndpoint = (origin: string): string => `${origin}/mcp`

/** A quiet uppercase micro-label used as a section heading. */
function sectionLabel(content: string): Component {
  return {
    type: 'text',
    element: 'h2',
    props: { className: 'text-foreground-subtle text-xs font-medium tracking-wide uppercase' },
    content,
  } as unknown as Component
}

/** A bordered card holding labelled content (separation by border, not depth). */
function card(children: ReadonlyArray<Component>): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-3 rounded-lg border p-5',
    },
    children,
  } as unknown as Component
}

/**
 * The static MCP endpoint reference card: the config-derived `/mcp` mount path
 * rendered as a first-class `content/code` block at the instance's RESOLVED
 * origin.
 *
 * SSR still cannot read `window.location` — but it does not need to. The origin
 * is resolved server-side from the operator's declared `BASE_URL`, else the
 * proxy-set `X-Forwarded-Host` / `Host` headers, so the reverse-proxy and
 * custom-domain cases the old placeholder existed to survive are now handled.
 * The tradeoff that remains: a concrete address is right in nearly every
 * deployment and correctable via `BASE_URL` when it is not, whereas a
 * placeholder is unusable in 100% of them and must be hand-substituted into
 * every block on every read.
 */
function endpointCard(origin: string): Component {
  return card([
    sectionLabel('MCP endpoint'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Your MCP server is mounted at this address. Paste it into your AI client’s ' +
        'config as-is.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'http', 'data-testid': 'mcp-connect-endpoint' },
      content: mcpEndpoint(origin),
    } as unknown as Component,
  ])
}

/**
 * The three hosts on which a cleartext `http` redirect URI is legal — and only
 * for an `application_type: "native"` client. Exactly `localhost`, `127.0.0.1`
 * or `[::1]`, on any port; a host merely *inside* 127.0.0.0/8 such as
 * `127.0.0.2` does not qualify. RFC 8252 §7.3, and the rule the authorization
 * server itself enforces at registration.
 */
const NATIVE_HTTP_LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Whether the printed `redirect_uris` entry is an `http` loopback URI — the one
 * shape that REQUIRES `application_type: "native"` and is refused as `"web"`.
 *
 * Both halves of the test are load-bearing, mirroring the authorization server's
 * own validation: a `web` client is refused a loopback host on ANY scheme, and a
 * `native` client is refused `https` on a loopback host. The answer therefore
 * turns on scheme AND host together — a host-only test would mislabel an
 * `https://localhost` deployment as native.
 */
function isNativeHttpLoopbackRedirect(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri)
    if (url.protocol !== 'http:') return false
    // `hostname` yields `::1` unbracketed for an IPv6 literal; re-bracket so the
    // comparison is against the exact spelling RFC 8252 §7.3 names.
    const host = url.hostname.includes(':') ? `[${url.hostname}]` : url.hostname
    return NATIVE_HTTP_LOOPBACK_HOSTS.has(host)
  } catch {
    return false
  }
}

/**
 * The RFC-7591 dynamic client-registration curl. The request body mirrors the
 * retired island's `issueMcpCredential` (`client_name` / `redirect_uris` /
 * `grant_types` / `token_endpoint_auth_method`), plus the `application_type`
 * without which the command the operator is told to run cannot succeed. The
 * response returns the operator's `client_id` / `client_secret` to paste into the
 * AI client.
 *
 * `--cookie "$SOVRIUM_SESSION"` is NOT decoration. Since [internal ref] the endpoint
 * refuses an anonymous caller `401` + `WWW-Authenticate: Bearer`
 * (`allowUnauthenticatedClientRegistration` defaults to `false`), while
 * `allowDynamicClientRegistration` stays `true` so a signed-in operator can still
 * mint a client. Printing the command without a credential handed every default
 * instance a `401` and copy claiming it should have worked. The spelling matches
 * the sibling API docs surface (`api-docs-surface.ts`), which already teaches
 * `--cookie "$SOVRIUM_SESSION"` for its admin curls — one idiom per concept.
 *
 * It sits BEFORE `--data` and uses double quotes deliberately: the docs spec lifts
 * the printed body out of the rendered block by slicing between `--data '` and the
 * LAST `'`, so a single-quoted flag after the body would truncate it.
 *
 * `application_type` is printed, never omitted. Omitting it defaults the client
 * to `"web"`, and a `web` client may not use an `http` loopback redirect URI —
 * so on the zero-config self-hosted posture (an `http://localhost` origin, i.e.
 * the common case) the body rendered here was refused `400 invalid_redirect_uri`
 * and the console handed the operator a command that could not work.
 *
 * The value is conditional rather than pinned: an `http` loopback redirect URI
 * is `"native"`, and every other origin — notably a deployed `https` one — stays
 * `"web"`, which is what it genuinely is. Declaring `"native"` on a routable
 * host would be wrong in the other direction, forfeiting the `web` default's
 * purpose of catching a routable-host client that mistakenly registered a
 * loopback URI.
 *
 * Printing the field in BOTH branches is deliberate: an MCP client "MUST specify
 * an appropriate `application_type` during Dynamic Client Registration", so a
 * generated registration that leaves it implicit teaches the operator a shape
 * that breaks the moment they point a desktop client at it.
 */
function registerExample(origin: string): string {
  const redirectUri = `${origin}/oauth/callback`
  const applicationType = isNativeHttpLoopbackRedirect(redirectUri) ? 'native' : 'web'
  return (
    '# POST /api/auth/oauth2/register — issue an MCP credential (RFC 7591)\n' +
    `curl -X POST '${origin}/api/auth/oauth2/register' \\\n` +
    "  --header 'Content-Type: application/json' \\\n" +
    '  --cookie "$SOVRIUM_SESSION" \\\n' +
    "  --data '{\n" +
    '    "client_name": "Sovrium MCP — Claude",\n' +
    `    "redirect_uris": ["${redirectUri}"],\n` +
    `    "application_type": "${applicationType}",\n` +
    '    "grant_types": ["authorization_code", "refresh_token"],\n' +
    '    "token_endpoint_auth_method": "client_secret_post"\n' +
    "  }'"
  )
}

/**
 * The "Issue a credential" card — a first-class `content/code` curl block
 * (copy affordance, `data-testid="mcp-connect-register"`) documenting the RFC-7591
 * dynamic client-registration endpoint the removed island used to POST to. The
 * operator now runs it as a curl (accepted loss: no in-panel button, no one-click
 * reveal), signed in — see {@link registerExample} for why the credential is
 * mandatory since [internal ref].
 *
 * The card carries BOTH postures because the page has two audiences. An operator
 * minting one credential by hand has a session and runs the command above. An
 * operator wiring Claude Desktop / Cursor / ChatGPT Dev Mode has neither — those
 * clients self-register before any browser session exists — and needs
 * `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true`. Naming the env var here is
 * the whole point of the page: without it the headless case silently 401s and the
 * operator has nothing to search for. It is an env var and not an
 * `app.auth.oauthServer.*` field per the [internal ref] operator-posture-vs-schema split,
 * so it is stated as an env var and not as config the app author edits.
 */
function registerCard(origin: string): Component {
  return card([
    sectionLabel('Issue a credential'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Register an MCP client to obtain a credential. The response returns a ' +
        '“client_id” and a “client_secret” to paste into your AI client. Run it ' +
        'signed in as an admin — without a session the endpoint answers 401, and ' +
        '“$SOVRIUM_SESSION” carries your login cookie.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'bash', 'data-testid': 'mcp-connect-register' },
      content: registerExample(origin),
    } as unknown as Component,
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-xs' },
      content:
        'Claude Desktop, Cursor and ChatGPT Dev Mode register themselves before any ' +
        'browser session exists. To let them, set ' +
        '“SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true” — registration then ' +
        'accepts any caller, capped at 20 per minute per IP.',
    } as unknown as Component,
  ])
}

/**
 * The MCP client config the operator pastes into Claude / Cursor, wired to the
 * instance's RESOLVED endpoint ({@link mcpEndpoint}) so it is usable as-is.
 * Mirrors the `mcpServers` shape an MCP client expects, so the reference and the
 * endpoint block agree on the mount literal.
 */
const referenceWiring = (origin: string): string =>
  JSON.stringify(
    {
      mcpServers: {
        sovrium: {
          url: mcpEndpoint(origin),
          transport: 'http',
        },
      },
    },
    // eslint-disable-next-line unicorn/no-null -- JSON.stringify's replacer arg requires `null` (not `undefined`) to take the indent
    null,
    2
  )

/**
 * The static reference-configuration card: the MCP client config shape rendered
 * as a first-class `content/code` (JSON) block (monospace + JSON attribution +
 * copy affordance), framed as the structure to paste into the AI client.
 */
function referenceConfigCard(origin: string): Component {
  return card([
    sectionLabel('Reference configuration'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'The MCP config to paste into your client, with the endpoint already set ' +
        'to this instance’s address.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'json', 'data-testid': 'mcp-reference-config' },
      content: referenceWiring(origin),
    } as unknown as Component,
  ])
}

/** The French heading per tool category, grouping the tools list. */
const CATEGORY_LABELS: Readonly<Record<McpToolCategory, string>> = {
  table: 'Data',
  action: 'Actions',
  automation: 'Automations',
}

/** The category render order (data first, then side-effecting entities). */
const CATEGORY_ORDER: ReadonlyArray<McpToolCategory> = ['table', 'action', 'automation']

/** One tool row: the monospace tool name + its French description. */
function toolRow(tool: McpToolListing): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border flex flex-col gap-0.5 border-t px-3 py-2 first:border-t-0',
    },
    children: [
      {
        type: 'text',
        element: 'code',
        props: { className: 'text-foreground font-mono text-xs' },
        content: tool.name,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-xs' },
        content: tool.description,
      },
    ],
  } as unknown as Component
}

/** One category group: a sub-heading + the tools in that category. */
function categoryGroup(category: McpToolCategory, tools: ReadonlyArray<McpToolListing>): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: CATEGORY_LABELS[category],
      },
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border bg-background-raised overflow-hidden rounded-lg border',
        },
        children: tools.map((tool) => toolRow(tool)),
      },
    ],
  } as unknown as Component
}

/**
 * The honest empty state when the config exposes no MCP tools yet. Per the brand
 * voice, the chrome line states what is true + the next action; a Source Serif 4
 * italic grace note (once per surface) softens it.
 */
function noToolsState(): Component {
  return {
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-raised flex flex-col items-start gap-2 rounded-lg border p-5',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm font-medium' },
        content: 'No tools exposed yet',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-xl text-sm leading-relaxed' },
        content:
          'Add “aiAccess” to a table, an action, or a manual automation in ' +
          'your app config to expose it here as an MCP tool.',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-xl text-sm italic' },
        content: 'You decide what your AI can do — nothing is exposed by default.',
      },
    ],
  } as unknown as Component
}

/** The available-tools section: the grouped tool list, or the empty-state guidance. */
function toolsSection(app: App): Component {
  const tools = listMcpTools(app)
  if (tools.length === 0) {
    return {
      type: 'container',
      element: 'section',
      props: {
        'aria-label': 'Available MCP tools',
        'data-testid': 'mcp-tools-section',
        className: 'flex flex-col gap-3',
      },
      children: [sectionLabel('Available tools'), noToolsState()],
    } as unknown as Component
  }
  const groups = CATEGORY_ORDER.flatMap((category) => {
    const inCategory = tools.filter((tool) => tool.category === category)
    return inCategory.length > 0 ? [categoryGroup(category, inCategory)] : []
  })
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Available MCP tools',
      'data-testid': 'mcp-tools-section',
      className: 'flex flex-col gap-4',
    },
    children: [sectionLabel('Available tools'), ...groups],
  } as unknown as Component
}

/**
 * The full MCP docs body: header + static endpoint reference + RFC-7591 register
 * curl + reference config + tools list.
 */
function mcpDocsBody(app: App, origin: string): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex max-w-3xl flex-col gap-8' },
      children: [
        header(),
        endpointCard(origin),
        registerCard(origin),
        referenceConfigCard(origin),
        toolsSection(app),
      ],
    } as unknown as Component,
  ]
}

/**
 * Build the MCP docs page (`/_admin/mcp`), wrapped in the persistent 3-zone
 * sidebar shell. The available-tools list is derived from `operatorApp` so it
 * always reflects the administered app's exposed `aiAccess` surface.
 *
 * @param title - the page meta title
 * @param operatorApp - the live operator app (source of the exposed tool catalog)
 * @param options - tier + shell concerns
 */
export function buildMcpDocsPage(title: string, operatorApp: App, options: McpDocsOptions): Page {
  const { canEdit, appName, appVersion, origin } = options
  return {
    id: 'dashboard-mcp-docs',
    name: 'dashboard-mcp-docs',
    path: '/mcp',
    meta: { title },
    components: wrapInShell(mcpDocsBody(operatorApp, origin), {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'MCP' }],
    }),
  } as Page
}
