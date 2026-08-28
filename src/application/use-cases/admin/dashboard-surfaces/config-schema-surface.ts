/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "Schema" surface (`/_admin/schema`) — the App-configuration
 * explorer.
 *
 * The first of the two config-introspection surfaces authorised by [internal ref]
 * amendment A1, under the invariant *reading the running configuration is
 * observability; mutating it is authoring*. It answers "what is this instance
 * actually running?" without a shell session on the host.
 *
 * A1 bounds the surface exhaustively — **no edit affordance, no write endpoint,
 * no draft, no version ledger, no history, no diff, no preview.** So this page
 * has no form, no input, and no mutating control of any kind. What it has:
 *
 *  1. A provenance line stating where configuration is authored, so the
 *     read-only posture is EXPLAINED rather than merely enforced (matching the
 *     console's own login copy: "Configuration lives in code").
 *  2. A navigable tree of the operator's OWN declarations — table names and
 *     their fields, page paths, automations, forms, agents, buckets. Naming the
 *     declarations rather than the families is what makes it a reflection
 *     instead of a static heading list.
 *  3. The raw configuration as a first-class `content/code` block, readable and
 *     copyable — what an operator actually does with it is paste it into a bug
 *     report or diff it against git by hand.
 *
 * Every value on this page has been through {@link redactAppConfigPaths}: the
 * payload is the boundary an operator's browser, any intermediary proxy, and the
 * error tracker all see, so masking in the UI would not be redaction.
 */

import { redactAppConfigPaths } from '@/application/use-cases/admin/config/redact-app-config'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Shell-wrap concerns for the standalone Schema explorer surface. */
export interface ConfigSchemaSurfaceOptions {
  /** F6 tier / F5 editing flag; threaded into the shell for signature parity. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

type ConfigNode = Readonly<Record<string, unknown>>

const text = (element: string, className: string, content: string): Component =>
  ({ type: 'text', element, props: { className }, content }) as unknown as Component

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): Component =>
  text('h2', 'text-foreground-subtle text-xs font-medium tracking-wide uppercase', content)

/** A bordered card holding labelled content (separation by border, not depth). */
const card = (children: ReadonlyArray<Component>): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-3 rounded-lg border p-5',
    },
    children,
  }) as unknown as Component

const isRecord = (value: unknown): value is ConfigNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Read an array-valued top-level family, tolerating an absent or malformed one. */
const familyItems = (app: ConfigNode, key: string): ReadonlyArray<ConfigNode> => {
  const value = app[key]
  return Array.isArray(value) ? value.filter((item): item is ConfigNode => isRecord(item)) : []
}

/**
 * The label one declaration answers to in the tree. `path` before `name`
 * because a page is identified by the route an operator types, not by its slug.
 */
const declarationLabel = (item: ConfigNode): string => {
  const { path } = item
  if (typeof path === 'string' && path.length > 0) return path
  const { name } = item
  return typeof name === 'string' && name.length > 0 ? name : '(unnamed)'
}

/**
 * The second-level detail line: what a declaration is made OF. Going one level
 * deeper than the family is what makes the tree navigable rather than a summary
 * — an operator asking "does this instance have the `company` column yet?" is
 * asking a field-level question.
 */
const declarationDetail = (item: ConfigNode): string | undefined => {
  const fields = familyItems(item, 'fields')
  if (fields.length > 0) return fields.map((field) => declarationLabel(field)).join(' · ')
  const { trigger } = item
  if (isRecord(trigger) && typeof trigger['type'] === 'string') return `trigger: ${trigger['type']}`
  const { type } = item
  return typeof type === 'string' ? type : undefined
}

/** One declaration row: its identifier, and the parts it is composed of. */
const declarationRow = (item: ConfigNode): Component => {
  const detail = declarationDetail(item)
  return {
    type: 'container',
    element: 'li',
    props: { className: 'border-border flex flex-col gap-0.5 border-t px-3 py-2 first:border-t-0' },
    children: [
      text('span', 'text-foreground font-mono text-xs', declarationLabel(item)),
      ...(detail === undefined
        ? []
        : [text('span', 'text-foreground-subtle font-mono text-xs', detail)]),
    ],
  } as unknown as Component
}

/** One family group: the family heading, its count, and its declaration rows. */
const familyGroup = (label: string, items: ReadonlyArray<ConfigNode>): Component =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      text('h3', 'text-foreground text-sm font-medium', `${label} (${items.length})`),
      {
        type: 'container',
        element: 'ul',
        props: {
          className: 'border-border bg-background-raised overflow-hidden rounded-lg border',
        },
        children: items.map((item) => declarationRow(item)),
      } as unknown as Component,
    ],
  }) as unknown as Component

/** The config families the tree walks, in the order `AppSchema` declares them. */
const TREE_FAMILIES: ReadonlyArray<readonly [string, string]> = [
  ['tables', 'Tables'],
  ['pages', 'Pages'],
  ['forms', 'Forms'],
  ['automations', 'Automations'],
  ['agents', 'Agents'],
  ['buckets', 'Buckets'],
  ['connections', 'Connections'],
]

/**
 * The declaration tree. Families the config does not declare are omitted rather
 * than rendered empty — an operator reading this page wants their instance, not
 * a catalogue of everything Sovrium could have been configured to do.
 */
const treeSection = (app: ConfigNode): Component => {
  const groups = TREE_FAMILIES.flatMap(([key, label]) => {
    const items = familyItems(app, key)
    return items.length > 0 ? [familyGroup(label, items)] : []
  })
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Declared configuration',
      'data-testid': 'config-schema-tree',
      className: 'flex flex-col gap-4',
    },
    children: [
      sectionLabel('Declared configuration'),
      ...(groups.length > 0
        ? groups
        : [text('p', 'text-foreground-subtle text-sm', 'This config declares nothing yet.')]),
    ],
  } as unknown as Component
}

/** The page header: title + a one-line plain-spoken intro. */
const header = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      text('h1', 'text-2xl font-semibold tracking-tight', 'Schema'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm',
        'The configuration this instance booted from, exactly as it is running. ' +
          'Credentials are redacted before the page is built.'
      ),
    ],
  }) as unknown as Component

/**
 * The provenance card. It names where configuration is AUTHORED, so an operator
 * who came here to change something leaves knowing where to go — the read-only
 * posture is explained rather than merely enforced.
 */
const provenanceCard = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
      'data-testid': 'config-schema-provenance',
    },
    children: [
      text('p', 'text-foreground text-sm font-medium', 'Configuration lives in code'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
        'Edit your app config file and restart to change any of this. ' +
          'The console reads the running configuration; it never writes it.'
      ),
    ],
  }) as unknown as Component

/**
 * The raw configuration, as a first-class `content/code` block — monospace, JSON
 * attribution, and the shared copy affordance.
 */
const rawConfigCard = (app: ConfigNode): Component =>
  card([
    sectionLabel('Raw configuration'),
    {
      type: 'code',
      props: { language: 'json', 'data-testid': 'config-schema-raw' },
      // eslint-disable-next-line unicorn/no-null -- JSON.stringify's replacer arg requires `null` (not `undefined`) to take the indent
      content: JSON.stringify(app, null, 2),
    } as unknown as Component,
  ])

/**
 * Build the Schema explorer page (`/_admin/schema`), wrapped in the persistent
 * 3-zone sidebar shell.
 *
 * @param title - the page meta title
 * @param operatorApp - the live operator app (the configuration being reflected)
 * @param options - tier + shell concerns
 */
export function buildConfigSchemaPage(
  title: string,
  operatorApp: App,
  options: ConfigSchemaSurfaceOptions
): Page {
  const { canEdit, appName, appVersion } = options
  const redacted = redactAppConfigPaths(operatorApp as unknown as ConfigNode)
  const body = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-3xl flex-col gap-8' },
    children: [header(), provenanceCard(), treeSection(redacted), rawConfigCard(redacted)],
  } as unknown as Component
  return {
    id: 'dashboard-config-schema',
    name: 'dashboard-config-schema',
    path: '/schema',
    meta: { title },
    components: wrapInShell([body], {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'Schema' }],
    }),
  } as Page
}
