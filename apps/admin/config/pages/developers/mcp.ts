/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// MCP — connect an AI client to this instance, and see what it would reach.
//
// ─── WHY IT WAS A BUILDER, AND WHY IT IS NOT ANY MORE ──────────────────────
//
// 519 lines of TypeScript, and every one of the three wiring blocks was a
// function of the running instance: the mount address is the resolved origin,
// and the registration body's `application_type` is decided by whether that
// origin is an http LOOPBACK one (RFC 8252 §7.3). Config has no URL parser, so
// it could not compute the second at all.
//
// `/api/admin/instance` publishes both as FACTS — `origin` and
// `oauthApplicationType` — and the page composes the curl around them. That is
// [internal ref] exactly: the endpoint answers what config cannot compute, the console
// keeps the words. A `registerCurl` field would have frozen this file's comment
// line, its backslash continuations and its quoting into a published OpenAPI
// contract, and could never be translated.
//
// ─── TWO `$record` NAMESPACES ON ONE PAGE ──────────────────────────────────
//
// The scalars come from the PAGE record (`dataSource: { system }`); the tool
// rows come from row templates bound to `/api/admin/mcp/tools`. Those are two
// namespaces, and they only coexist because `applyPageLevelRecordBinding` walks
// with the COLLECTION-template substitution, which leaves the children of a
// `dataSource`-bearing node alone. Under the plain walk the page record would
// win — it runs first — and every `$record.name` in a tool row would resolve
// against the instance facts, which have no `name`, and render as the empty
// string. Silently: nothing throws, and the rows come out blank.
//
// ─── THE HEADINGS GATE ON COUNTS, NOT ON ROWS ──────────────────────────────
//
// "Data", "Actions" and "Automations" exist nowhere but on this page, so they
// are not published. Each group gates on the count `/api/admin/instance`
// publishes for its category (`gt: 0`), and the empty state on `mcpToolCount
// eq: 0`. That is why the counts are FLAT on that payload: `visibility.record`
// names one field and has no path syntax, so a nested `counts.table` would be
// unreachable by the gate that decides whether the heading renders at all.
//
// Publishing the count is also what makes the "no empty-state slot on a system
// row template" seam irrelevant here: the empty state is a sibling gated on a
// number, not a slot on the binding.

import { emptyState, pageHeading, tabQuery, tabbedBody, tabPanel } from '../../components/dataPage'
import { withShell } from '../../components/shell'
import { INSTANCE_ENDPOINT, MCP_TOOLS_ENDPOINT } from '../../systemSources'
import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** A plain text node. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): PageComponent =>
  text('h2', 'text-foreground-subtle text-sm font-medium tracking-wide uppercase', content)

/** A bordered card holding labelled content. */
const card = (children: readonly PageComponent[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-3 rounded-lg border p-5',
    },
    children,
  }) as PageComponent

// The visible title block is retired here for the same reason it is on `/api`:
// the chrome bar's trail already ends in this page's name, so a second copy of
// the word printed it twice. `pageHeading` is the shared `sr-only` heading.

/**
 * The two halves of this route, and the `?tab=` value that addresses each.
 *
 * `reference` is what an AI client would reach; `clients` is which ones have.
 * The second has no endpoint yet, so it says so rather than drawing a table of
 * nothing — see {@link clientsPanel}.
 */
const TABS = [
  { id: 'reference', label: 'Reference' },
  { id: 'clients', label: 'Clients' },
] as const

/**
 * The Clients panel — an honest "not available yet", and no invented table.
 *
 * ─── WHY THERE IS NOTHING TO SHOW ──────────────────────────────────────────
 *
 * `oauth_clients`, `oauth_consents` and `oauth_access_tokens` all exist — the
 * OAuth-server plugin is mounted on every auth-enabled app — but NO admin read
 * joins them, so there is no endpoint to bind. A grid over a 404 renders an
 * empty table, which tells an operator "no client has ever connected" when the
 * truth is "nobody asked". Those are different claims and only the second is
 * supportable, so the panel makes it in words.
 *
 * A disabled trigger was the alternative and is worse: a tab you cannot open
 * advertises a capability and then refuses it, with no sentence anywhere saying
 * why. Filed as a platform gap (`GET /api/admin/mcp/clients`); this panel is
 * what the console says until it ships.
 */
const clientsPanel = (): PageComponent =>
  tabPanel([
    emptyState(
      '$t:admin.mcp.clients.pending.heading',
      '$t:admin.mcp.clients.pending.body',
      '$t:admin.mcp.clients.pending.hint'
    ),
  ])

/**
 * The mount address, at the instance's RESOLVED origin.
 *
 * A concrete address is right in nearly every deployment and correctable with
 * `BASE_URL` when it is not, whereas the `<your instance address>` placeholder
 * this replaced was unusable in 100% of them and had to be hand-substituted
 * into every block on both pages.
 */
const endpointCard = (): PageComponent =>
  card([
    sectionLabel('$t:admin.mcp.endpoint.heading'),
    text('p', 'text-foreground-subtle text-md', '$t:admin.mcp.endpoint.blurb'),
    {
      type: 'code',
      props: { language: 'http', 'data-testid': 'mcp-connect-endpoint' },
      content: '$record.origin/mcp',
    } as PageComponent,
  ])

/**
 * The RFC-7591 registration curl.
 *
 * `application_type` is printed, never omitted. RFC 7591 defaults an absent one
 * to `"web"`, and a `web` client may not use an http loopback redirect URI — so
 * on the zero-config self-hosted posture (an `http://localhost` origin, the
 * common case) a body without it is refused `400 invalid_redirect_uri` and the
 * console hands the operator a command that cannot work. The value comes from
 * the endpoint because deciding it needs a URL parser and the three loopback
 * spellings RFC 8252 §7.3 names, neither of which config has.
 *
 * `--cookie "$SOVRIUM_SESSION"` is not decoration either: since [internal ref] the
 * endpoint refuses an anonymous caller 401. It sits BEFORE `--data` and uses
 * double quotes because the docs spec lifts the printed body out by slicing
 * between `--data '` and the LAST `'`.
 */
const registerCard = (): PageComponent =>
  card([
    sectionLabel('$t:admin.mcp.credential.heading'),
    text('p', 'text-foreground-subtle text-md', '$t:admin.mcp.credential.blurb'),
    {
      type: 'code',
      props: { language: 'bash', 'data-testid': 'mcp-connect-register' },
      content:
        '# POST /api/auth/oauth2/register — issue an MCP credential (RFC 7591)\n' +
        "curl -X POST '$record.origin/api/auth/oauth2/register' \\\n" +
        "  --header 'Content-Type: application/json' \\\n" +
        '  --cookie "$SOVRIUM_SESSION" \\\n' +
        "  --data '{\n" +
        '    "client_name": "Sovrium MCP — Claude",\n' +
        '    "redirect_uris": ["$record.origin/oauth/callback"],\n' +
        '    "application_type": "$record.oauthApplicationType",\n' +
        '    "grant_types": ["authorization_code", "refresh_token"],\n' +
        '    "token_endpoint_auth_method": "client_secret_post"\n' +
        "  }'",
    } as PageComponent,
    text('p', 'text-foreground-subtle text-sm', '$t:admin.mcp.credential.anonymous'),
  ])

/** The `mcpServers` wiring shape, with the endpoint already set. */
const referenceConfigCard = (): PageComponent =>
  card([
    sectionLabel('$t:admin.mcp.config.heading'),
    text('p', 'text-foreground-subtle text-md', '$t:admin.mcp.config.blurb'),
    {
      type: 'code',
      props: { language: 'json', 'data-testid': 'mcp-reference-config' },
      content:
        '{\n' +
        '  "mcpServers": {\n' +
        '    "sovrium": {\n' +
        '      "url": "$record.origin/mcp",\n' +
        '      "transport": "http"\n' +
        '    }\n' +
        '  }\n' +
        '}',
    } as PageComponent,
  ])

/**
 * One tool row: the monospace tool name the server advertises, and the tool's
 * own description — the sentence an AI client already receives.
 *
 * The `<li>` around this is SYNTHESIZED by the row expansion, which takes no
 * props from the template, so the row's own layout lives on the outermost node
 * the template DOES own and the separator moves to the parent's border.
 */
const toolRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-0.5 px-3 py-2' },
    children: [
      text('code', 'text-foreground font-mono text-sm', '$record.name'),
      text('span', 'text-foreground-subtle text-sm', '$record.description'),
    ],
  }) as PageComponent

/**
 * One category group: the heading this page owns, plus the rows that category's
 * narrowed read returns.
 *
 * The WHOLE group is gated on the count rather than only the heading: the row
 * template renders an empty bordered box on zero rows, and a heading over an
 * empty box is exactly what the retired builder's own `length > 0` filter
 * existed to prevent.
 */
const categoryGroup = (category: string, label: string, countField: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    visibility: { record: { field: countField, gt: 0 } },
    children: [
      text('h3', 'text-foreground text-md font-medium', label),
      {
        // `list`, not a `container` with `element: 'ul'`: the container element
        // enum admits only sectioning elements, and `list` is the type whose
        // renderer already handles a data-bound set of children. It stays SSR
        // rather than becoming an island because that only happens with
        // `listDisplay.itemTemplate`.
        type: 'list',
        props: {
          className:
            'border-border divide-border bg-background-raised divide-y overflow-hidden rounded-lg border',
        },
        dataSource: {
          system: {
            endpoint: MCP_TOOLS_ENDPOINT,
            rowsKey: 'tools',
            idKey: 'name',
            query: { category },
          },
        },
        children: [toolRow()],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The honest empty state, gated on the total count being zero.
 *
 * Nothing is exposed to an AI by default, so this is the DEFAULT posture and
 * not an error — which is why the endpoint answers 200 with an empty array
 * rather than a 404, and why the closing line is reassurance rather than
 * instruction.
 */
const noToolsState = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-raised flex flex-col items-start gap-2 rounded-lg border p-5',
    },
    visibility: { record: { field: 'mcpToolCount', eq: 0 } },
    children: [
      text('p', 'text-foreground text-md font-medium', '$t:admin.mcp.tools.empty'),
      text(
        'p',
        'text-foreground-subtle max-w-xl text-md leading-relaxed',
        '$t:admin.mcp.tools.emptyHint'
      ),
      text(
        'p',
        'text-foreground-subtle max-w-xl text-md italic',
        '$t:admin.locked.audit.mcp.exposureNotice'
      ),
    ],
  }) as PageComponent

/** The available-tools section: the grouped list, or the empty-state guidance. */
const toolsSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.mcp.tools.region',
      'data-testid': 'mcp-tools-section',
      className: 'flex flex-col gap-4',
    },
    children: [
      sectionLabel('$t:admin.mcp.tools.heading'),
      // Data first, then the side-effecting entities — the order the retired
      // builder rendered and the order the catalogue itself compiles in.
      categoryGroup('table', '$t:admin.mcp.tools.data', 'mcpToolCountTable'),
      categoryGroup('action', '$t:admin.mcp.tools.actions', 'mcpToolCountAction'),
      categoryGroup('automation', '$t:admin.mcp.tools.automations', 'mcpToolCountAutomation'),
      noToolsState(),
    ],
  }) as PageComponent

export default withShell(
  {
    id: 'dashboard-mcp-docs',
    name: 'dashboard-mcp-docs',
    path: '/mcp',
    meta: { title: '$t:admin.meta.mcp', lang: 'en-US' },
    dataSource: { system: { endpoint: INSTANCE_ENDPOINT } },
    // `?tab=` is the address of each half. Without this block `$query.tab` is
    // left verbatim and the strip silently opens on Reference for every link.
    query: tabQuery(TABS),
    components: [
      pageHeading('$t:admin.mcp.heading', '$t:admin.mcp.blurb'),
      tabbedBody('$t:admin.mcp.tabs.region', TABS, [
        tabPanel([
          {
            type: 'container',
            element: 'div',
            props: { className: 'flex max-w-3xl flex-col gap-8' },
            children: [endpointCard(), registerCard(), referenceConfigCard(), toolsSection()],
          } as PageComponent,
        ]),
        clientsPanel(),
      ]),
    ],
  } as PageConfig,
  { breadcrumb: { mcp: '$t:admin.crumb.mcp' } }
) satisfies PageConfig
