/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "API" docs surface ([internal ref], Pass 2a item 2.3).
 *
 * An auto-generated, read-only reference for THIS app's REST API. The app's
 * OpenAPI document lives at `/api/openapi.json` and a full interactive reference
 * (Scalar) at `/api/scalar` — both admin-guarded. This page is the operator's
 * entry point to them: the base URL, the auth scheme, a handful of example
 * requests derived from the app's own tables, and a prominent button into the
 * interactive Scalar reference.
 *
 * Composed from first-class native content component-types (Pass 3): the example
 * requests render through `content/code` (monospace + copy affordance + language
 * attribution) inside a `display/tabs` strip that offers the same call as HTTP,
 * cURL, and JavaScript. The content is config-derived but static per render, so
 * it server-renders inside the persistent dashboard shell. The example requests
 * are derived from the live operator `App.tables`, so they always reflect the app
 * the operator administers.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Shell-wrap concerns for the standalone API docs surface. */
export interface ApiDocsOptions {
  /** F6 tier / F5 editing flag; threaded into the shell for signature parity. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
  /**
   * The instance's resolved public origin (no trailing slash), prefixing every
   * address this page prints so each block is runnable as written. Resolved by
   * the route handler from `BASE_URL` → proxy/`Host` headers → the request URL
   * (`resolveRequestBaseUrl`), and already defaulted by the surface builder to a
   * placeholder label for the non-HTTP caller that has no request to resolve
   * from — so this is always safe to interpolate.
   */
  readonly origin: string
}

/** A quiet section heading (the recurring "micro-label over a card" pattern). */
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
 * A first-class `content/code` block. Renders a syntax-attributed `<pre><code>`
 * with a copy-to-clipboard affordance — the native component-type, not a bespoke
 * raw `text` element=`pre`. `language` drives the `language-X` / `data-language`
 * attribution; `data-testid` is threaded through for the example-request assertion.
 */
function codeBlock(content: string, language: string, testid?: string): Component {
  return {
    type: 'code',
    props: {
      language,
      ...(testid !== undefined && { 'data-testid': testid }),
    },
    content,
  } as unknown as Component
}

/** A labelled key→value row (e.g. "Base URL" → the base URL note). */
function keyValueRow(label: string, value: string): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-xs uppercase' },
        content: label,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: value,
      },
    ],
  } as unknown as Component
}

/** The page intro: a one-line plain-spoken description of what this page is. */
function intro(): Component {
  return {
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle max-w-2xl text-sm' },
    content:
      'Your app exposes a REST API generated from its config. ' +
      'Each table becomes a set of CRUD endpoints. Here are the essentials to ' +
      'get started, plus the full interactive reference.',
  } as unknown as Component
}

/**
 * The base-URL + auth-scheme card, stating the API root at the instance's
 * RESOLVED origin so an operator can read it off and hand it to a developer.
 */
function endpointCard(origin: string, app: App): Component {
  return card([
    sectionLabel('Access'),
    keyValueRow('Base URL', `${origin}/api`),
    keyValueRow(
      'Authentication',
      'Better Auth session (login cookie). A request sent from this browser, ' +
        'signed in as an administrator, is authenticated automatically.'
    ),
    ...apiKeysPointer(app),
  ])
}

/**
 * The one-line pointer to `/_admin/api-keys` (D6).
 *
 * A script has no browser and therefore no login cookie, so the sentence above
 * is only half the story for the readers this page is written for. The other
 * half is a long-lived key — but MINTING one is a write, and this page is a
 * config-REFLECTION surface with no writes anywhere in it. Pointing at the
 * surface that owns the write keeps that shape intact; putting a create form
 * here would need an [internal ref] amendment.
 *
 * Rendered only when the app opted in (`auth.apiKeys`). Without the opt-in the
 * endpoints and the page both answer 404, and a link to a 404 is worse than no
 * link at all.
 */
function apiKeysPointer(app: App): ReadonlyArray<Component> {
  if (app.auth?.apiKeys !== true) return []
  return [
    keyValueRow(
      'API keys',
      'A script has no browser session. Give it a long-lived key instead and ' +
        'send it in the x-api-key header.'
    ),
    {
      type: 'link',
      content: 'Manage my API keys',
      props: {
        href: '/_admin/api-keys',
        className: 'w-fit text-sm underline-offset-4 hover:underline',
      },
    } as unknown as Component,
  ]
}

/** The app's first few tables; the source of every config-derived example. */
function exampleTables(app: App): ReadonlyArray<{ readonly name: string }> {
  return (app.tables ?? []).slice(0, 4)
}

/** The first table's name (drives the create/cURL/JS examples), or a placeholder. */
function firstTableName(app: App): string {
  return exampleTables(app)[0]?.name ?? '{table}'
}

/**
 * The canonical HTTP example: one `GET .../records` line per the app's first
 * tables PLUS a `POST .../records` create line, derived from the operator's OWN
 * tables. Falls back to a generic example when the app declares no tables. This
 * is the default-visible tab and carries the `api-docs-examples` testid.
 */
function httpExample(app: App): string {
  const tables = exampleTables(app)
  const lines =
    tables.length > 0
      ? tables
          .map((table) => `GET  /api/tables/${table.name}/records      # List “${table.name}”`)
          .join('\n')
      : 'GET  /api/tables/{table}/records      # List a table’s records'
  const createExample = `POST /api/tables/${firstTableName(app)}/records      # Create a record`
  return `${lines}\n${createExample}`
}

/**
 * The same list call rendered as a copy-pasteable cURL command against the
 * operator's first table — the shell most operators reach for first.
 */
function curlExample(app: App, origin: string): string {
  const table = firstTableName(app)
  return (
    `# List “${table}” (this browser’s admin session authenticates the call)\n` +
    `curl '${origin}/api/tables/${table}/records' \\\n` +
    `  --header 'Accept: application/json' \\\n` +
    `  --cookie "$SOVRIUM_SESSION"`
  )
}

/**
 * The same list call as a browser-native `fetch` — runnable straight from the
 * admin console (the session cookie rides along with `credentials: 'include'`).
 */
function jsExample(app: App): string {
  const table = firstTableName(app)
  return (
    `// List “${table}” from this browser (the session cookie is included)\n` +
    `const res = await fetch('/api/tables/${table}/records', {\n` +
    `  headers: { Accept: 'application/json' },\n` +
    `  credentials: 'include',\n` +
    `})\n` +
    `const { records } = await res.json()`
  )
}

/** One tab in the examples strip: a labelled `tab-panel` hosting a `code` block. */
function exampleTab(label: string, body: Component): Component {
  return {
    type: 'tab-panel',
    content: { label },
    children: [body],
  } as unknown as Component
}

/**
 * The example-requests card. The same call is offered as HTTP / cURL / JavaScript
 * through a `display/tabs` strip, each panel a first-class `content/code` block.
 * The default (HTTP) tab carries the `api-docs-examples` testid and the
 * config-derived GET/POST lines.
 */
function examplesCard(app: App, origin: string): Component {
  return card([
    sectionLabel('Request examples'),
    {
      type: 'tabs',
      defaultTab: 'http',
      props: { 'aria-label': 'Request examples', className: 'flex flex-col gap-3' },
      children: [
        {
          type: 'tab-panel',
          props: { id: 'http' },
          content: { label: 'HTTP' },
          children: [codeBlock(httpExample(app), 'http', 'api-docs-examples')],
        } as unknown as Component,
        exampleTab('cURL', codeBlock(curlExample(app, origin), 'bash')),
        exampleTab('JavaScript', codeBlock(jsExample(app), 'javascript')),
      ],
    } as unknown as Component,
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-xs' },
      content:
        'The verb and path are enough; the interactive reference details the parameters, ' +
        'request bodies, and responses for each endpoint.',
    } as unknown as Component,
  ])
}

/**
 * The admin create-user cURL reference — the create-via-API path that replaces
 * the in-dashboard create form dropped when the Users directory converted
 * to a system-source data-table (see auth-endusers.md / data-users.spec.ts). A
 * runnable `POST /api/auth/admin/create-user` carrying the email / password /
 * role body an operator (or an MCP client) supplies to provision an account.
 */
function createUserExample(origin: string): string {
  return (
    '# POST /api/auth/admin/create-user — create an account (replaces the removed form)\n' +
    `curl -X POST '${origin}/api/auth/admin/create-user' \\\n` +
    "  --header 'Content-Type: application/json' \\\n" +
    '  --cookie "$SOVRIUM_SESSION" \\\n' +
    "  --data '{\n" +
    '    "email": "personne@exemple.com",\n' +
    '    "password": "MotDePasseFort123!",\n' +
    '    "role": "member"\n' +
    "  }'"
  )
}

/**
 * The "Create user" card — a first-class `content/code` block (copy
 * affordance, `data-testid="api-docs-create-user"`) documenting the admin
 * create-user endpoint that superseded the dropped in-dashboard create form.
 */
function createUserCard(origin: string): Component {
  return card([
    sectionLabel('Create user'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Account creation no longer has a dashboard form: ' +
        'it goes through Better Auth’s admin API (or the MCP server). A strong ' +
        'password is required; the person resets it afterwards.',
    } as unknown as Component,
    codeBlock(createUserExample(origin), 'bash', 'api-docs-create-user'),
  ])
}

/** The prominent call-to-action: open the interactive Scalar reference. */
function scalarCard(): Component {
  return card([
    sectionLabel('Interactive reference'),
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-foreground-subtle text-sm' },
      content:
        'Browse every endpoint, try requests, and read the schemas in ' +
        'the interactive reference (Scalar).',
    } as unknown as Component,
    {
      type: 'link',
      props: {
        href: '/api/scalar',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-testid': 'api-docs-scalar-link',
        className:
          'bg-primary text-primary-fg inline-flex w-fit items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90',
      },
      content: 'Open the interactive reference',
    } as unknown as Component,
  ])
}

/** The page header: title + one-line intro. */
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
        content: 'API',
      },
      intro(),
    ],
  } as unknown as Component
}

/** The full API docs body: header + the four cards. */
function apiDocsBody(app: App, origin: string): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex max-w-3xl flex-col gap-6' },
      children: [
        header(),
        endpointCard(origin, app),
        examplesCard(app, origin),
        createUserCard(origin),
        scalarCard(),
      ],
    } as unknown as Component,
  ]
}

/**
 * Build the API docs page (`/_admin/api`), wrapped in the persistent 3-zone
 * sidebar shell. The example requests are derived from `operatorApp.tables`, so
 * the page always reflects the administered app.
 *
 * @param title - the page meta title
 * @param operatorApp - the live operator app (source of the example tables)
 * @param options - tier + shell concerns
 */
export function buildApiDocsPage(title: string, operatorApp: App, options: ApiDocsOptions): Page {
  const { canEdit, appName, appVersion, origin } = options
  return {
    id: 'dashboard-api-docs',
    name: 'dashboard-api-docs',
    path: '/api',
    meta: { title },
    components: wrapInShell(apiDocsBody(operatorApp, origin), {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'API' }],
    }),
  } as Page
}
