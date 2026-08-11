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
 *     the config-derived `/mcp` mount path with a placeholder origin (SSR cannot
 *     resolve `window.location`).
 *  2. An "Issue a credential" card — a `content/code` curl documenting the
 *     RFC-7591 dynamic client-registration endpoint (`POST /api/auth/oauth2/register`,
 *     open registration — no session cookie). The response returns the operator's
 *     `client_id` / `client_secret` to paste into the AI client.
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
  /** Operator published config; seeds the read-through count badges. */
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
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
 * The config-derived `/mcp` mount URL, shown with a placeholder origin because
 * this page server-renders and cannot resolve `window.location`. Reused by both
 * the endpoint reference block and {@link REFERENCE_WIRING} so the static docs
 * agree on the mount literal.
 */
const MCP_ENDPOINT_PLACEHOLDER = '<your instance address>/mcp'

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
 * rendered as a first-class `content/code` block with a placeholder origin. The
 * durable, always-correct part is the path; the operator substitutes their own
 * instance address (SSR cannot resolve `window.location`, and a placeholder stays
 * correct behind any reverse proxy / custom domain).
 */
function endpointCard(): Component {
  return card([
    sectionLabel('MCP endpoint'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Your MCP server is mounted at this path. Replace the label with your instance’s ' +
        'real address in your AI client’s config.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'http', 'data-testid': 'mcp-connect-endpoint' },
      content: MCP_ENDPOINT_PLACEHOLDER,
    } as unknown as Component,
  ])
}

/**
 * The RFC-7591 dynamic client-registration curl. The request body mirrors the
 * retired island's `issueMcpCredential` (`client_name` / `redirect_uris` /
 * `grant_types` / `token_endpoint_auth_method`). No `--cookie` — RFC 7591 dynamic
 * client registration is open. The response returns the operator's `client_id` /
 * `client_secret` to paste into the AI client.
 */
function registerExample(): string {
  return (
    '# POST /api/auth/oauth2/register — issue an MCP credential (RFC 7591, open registration)\n' +
    "curl -X POST '<your instance address>/api/auth/oauth2/register' \\\n" +
    "  --header 'Content-Type: application/json' \\\n" +
    "  --data '{\n" +
    '    "client_name": "Sovrium MCP — Claude",\n' +
    '    "redirect_uris": ["<your instance address>/oauth/callback"],\n' +
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
 * reveal); the endpoint is open per RFC 7591, so no session cookie is sent.
 */
function registerCard(): Component {
  return card([
    sectionLabel('Issue a credential'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Register an MCP client to obtain a credential. The response returns a ' +
        '“client_id” and a “client_secret” to paste into your AI client.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'bash', 'data-testid': 'mcp-connect-register' },
      content: registerExample(),
    } as unknown as Component,
  ])
}

/**
 * The MCP client config SHAPE the operator pastes into Claude / Cursor. Shown
 * with a placeholder endpoint ({@link MCP_ENDPOINT_PLACEHOLDER}) because this page
 * server-renders and cannot resolve `window.location`. Mirrors the `mcpServers`
 * shape an MCP client expects, so the reference and the endpoint block agree on
 * the mount literal.
 */
const REFERENCE_WIRING = JSON.stringify(
  {
    mcpServers: {
      sovrium: {
        url: MCP_ENDPOINT_PLACEHOLDER,
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
function referenceConfigCard(): Component {
  return card([
    sectionLabel('Reference configuration'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'The shape of the MCP config to paste into your client, with the ' +
        'endpoint set to your instance address.',
    } as unknown as Component,
    {
      type: 'code',
      props: { language: 'json', 'data-testid': 'mcp-reference-config' },
      content: REFERENCE_WIRING,
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
function mcpDocsBody(app: App): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex max-w-3xl flex-col gap-8' },
      children: [
        header(),
        endpointCard(),
        registerCard(),
        referenceConfigCard(),
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
  const { canEdit, appName, appVersion, publishedSnapshot } = options
  return {
    id: 'dashboard-mcp-docs',
    name: 'dashboard-mcp-docs',
    path: '/mcp',
    meta: { title },
    components: wrapInShell(mcpDocsBody(operatorApp), {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'MCP' }],
      publishedSnapshot,
    }),
  } as Page
}
