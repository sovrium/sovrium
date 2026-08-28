/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dashboard "Environment" surface (`/_admin/env`) — the declared-variable
 * viewer.
 *
 * The second config-introspection surface authorised by [internal ref] amendment A1.
 * It answers the question that otherwise costs a shell session: *"my automation
 * is failing — is `STRIPE_KEY` actually set on this box, or is it silently
 * falling back to a default?"* Answering it does not require showing the value,
 * so this page does not show it.
 *
 * Each row carries the two facts the operator came for: whether a value
 * resolved, and which RUNG supplied it. `isSet` alone cannot tell a staging
 * fallback quietly running in production apart from a value deliberately
 * configured on this box, and that distinction is the whole diagnostic.
 *
 * ## Status is typography, not colour
 *
 * [internal ref]: the set/unset indicator is expressed through weight and de-emphasis,
 * never a green/amber pill. A console that paints "not set" amber implies the
 * operator did something wrong; most unset variables are optional and unset on
 * purpose. Hue here would be decoration masquerading as severity.
 *
 * ## No value, no control
 *
 * A1's bound applies unchanged — no edit affordance, no write endpoint, no
 * reveal. Values are configured in the deployment environment, and the
 * provenance line says so, so an operator who came here to fix one knows where
 * to go.
 */

import { buildEnvVarStatuses } from '@/application/use-cases/admin/config/env-status'
import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { EnvVarStatus } from '@/domain/models/api/admin/env'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** Shell-wrap concerns for the standalone Environment viewer surface. */
export interface ConfigEnvSurfaceOptions {
  /** F6 tier / F5 editing flag; threaded into the shell for signature parity. */
  readonly canEdit: boolean
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

const text = (element: string, className: string, content: string): Component =>
  ({ type: 'text', element, props: { className }, content }) as unknown as Component

/** A quiet uppercase micro-label used as a section heading. */
const sectionLabel = (content: string): Component =>
  text('h2', 'text-foreground-subtle text-xs font-medium tracking-wide uppercase', content)

/**
 * The operator-facing wording for each resolution rung that actually RESOLVED.
 *
 * The `unset` rung is deliberately absent rather than labelled: "where did this
 * value come from" is not a meaningful question when there is no value, and
 * `statusWord` already says "Not set". Labelling it too rendered "Not set ·
 * Not set" on every unset row — a word not doing work ([internal ref] D4). The
 * `Exclude` makes that structural: there is no `unset` label to render because
 * the type does not admit one.
 */
const SOURCE_LABEL: Readonly<Record<Exclude<EnvVarStatus['source'], 'unset'>, string>> = {
  environment: 'From the environment',
  default: 'From the declared default',
}

/**
 * The status word. Deliberately two states in the same neutral ink, separated by
 * WEIGHT: a set variable reads as settled, an unset one recedes.
 */
const statusWord = (status: Readonly<EnvVarStatus>): Component =>
  status.isSet
    ? text('span', 'text-foreground text-xs font-medium', 'Set')
    : text('span', 'text-foreground-subtle text-xs', 'Not set')

/** The trailing metadata line: required, and whether a fallback default exists. */
const rowMeta = (status: Readonly<EnvVarStatus>): string => {
  const required = status.required ? 'Required' : 'Optional'
  return status.hasDefault ? `${required} · has a default` : required
}

/**
 * One variable row. `data-testid="config-env-row-{KEY}"` so a spec can assert
 * about ONE variable's status rather than about the page's whole text — the
 * difference between "the page mentions default somewhere" and "this variable is
 * coasting on its default".
 */
const variableRow = (status: Readonly<EnvVarStatus>): Component =>
  ({
    type: 'container',
    element: 'li',
    props: {
      className:
        'border-border flex flex-col gap-1 border-t px-4 py-3 first:border-t-0 md:flex-row md:items-baseline md:justify-between md:gap-6',
      'data-testid': `config-env-row-${status.key}`,
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-0.5' },
        children: [
          text('span', 'text-foreground font-mono text-xs', status.key),
          ...(status.description === undefined
            ? []
            : [text('span', 'text-foreground-subtle text-xs', status.description)]),
          text('span', 'text-foreground-subtle text-xs', rowMeta(status)),
        ],
      } as unknown as Component,
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex shrink-0 items-baseline gap-3' },
        children: [
          ...(status.source === 'unset'
            ? []
            : [text('span', 'text-foreground-subtle text-xs', SOURCE_LABEL[status.source])]),
          statusWord(status),
          // The mask, never the value: "a value is configured" is itself the
          // operator's answer, and the constant is fixed-width so it cannot
          // become a length oracle.
          ...(status.masked === null
            ? []
            : [text('span', 'text-foreground-subtle font-mono text-xs', status.masked)]),
        ],
      } as unknown as Component,
    ],
  }) as unknown as Component

/**
 * The honest empty state when the config declares no variables. "This app
 * declares none" is an answer, and a different one from "the page failed".
 */
const noVariablesState = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col items-start gap-2 px-4 py-5' },
    children: [
      text('p', 'text-foreground text-sm font-medium', 'No variables declared'),
      text(
        'p',
        'text-foreground-subtle max-w-xl text-sm leading-relaxed',
        'Add an “env” block to your app config to declare the variables this app expects.'
      ),
    ],
  }) as unknown as Component

/** The variable list, in DECLARATION order — the operator's grouping is information. */
const listSection = (statuses: ReadonlyArray<Readonly<EnvVarStatus>>): Component =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Declared environment variables',
      'data-testid': 'config-env-list',
      className: 'flex flex-col gap-3',
    },
    children: [
      sectionLabel('Declared variables'),
      {
        type: 'container',
        element: 'ul',
        props: {
          className: 'border-border bg-background-raised overflow-hidden rounded-lg border',
        },
        children:
          statuses.length > 0
            ? statuses.map((status) => variableRow(status))
            : [noVariablesState()],
      } as unknown as Component,
    ],
  }) as unknown as Component

/** The page header: title + a one-line plain-spoken intro. */
const header = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-2' },
    children: [
      text('h1', 'text-2xl font-semibold tracking-tight', 'Environment'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm',
        'The variables this app declares, and whether this instance resolved each one. ' +
          'Values are never shown.'
      ),
    ],
  }) as unknown as Component

/**
 * The provenance card — where variables are actually configured, which is NOT
 * this console.
 */
const provenanceCard = (): Component =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
      'data-testid': 'config-env-provenance',
    },
    children: [
      text('p', 'text-foreground text-sm font-medium', 'Values live in the deployment environment'),
      text(
        'p',
        'text-foreground-subtle max-w-2xl text-sm leading-relaxed',
        'Set a variable where you run this instance, then restart. ' +
          'The console reports what resolved; it never stores or reveals a value.'
      ),
    ],
  }) as unknown as Component

/**
 * Build the Environment viewer page (`/_admin/env`), wrapped in the persistent
 * 3-zone sidebar shell.
 *
 * Resolution status is read from `process.env` at RENDER time (not at boot):
 * unlike the config surface, is-set status can change between reads without a
 * restart, so a snapshot taken once would go quietly stale.
 *
 * @param title - the page meta title
 * @param operatorApp - the live operator app (source of the declared variables)
 * @param options - tier + shell concerns
 */
export function buildConfigEnvPage(
  title: string,
  operatorApp: App,
  options: ConfigEnvSurfaceOptions
): Page {
  const { canEdit, appName, appVersion } = options
  const statuses = buildEnvVarStatuses(operatorApp, process.env)
  const body = {
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-3xl flex-col gap-8' },
    children: [header(), provenanceCard(), listSection(statuses)],
  } as unknown as Component
  return {
    id: 'dashboard-config-env',
    name: 'dashboard-config-env',
    path: '/env',
    meta: { title },
    components: wrapInShell([body], {
      canEdit,
      appName,
      appVersion,
      breadcrumb: [homeCrumb(appName), { label: 'Environment' }],
    }),
  } as Page
}
