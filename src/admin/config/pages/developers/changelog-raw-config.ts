/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The changelog's raw-configuration card: what the configuration declares, one
// figure per family, and the button that saves the whole of it as a file.

import { factsCard } from '../../components/card-blocks'
import { CONFIG_SCHEMA_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * Save the decoded, redacted configuration as a file.
 *
 * `mode: 'download'` issues a CREDENTIALED fetch and saves the blob, which is
 * what an `/api/admin/*` path needs — a bare `<a download>` routes through the
 * browser's download manager, sends no session cookie, and would save a 404 body
 * under a confident filename.
 *
 * The url is `/api/…`, which the mount walk SKIPS by design, so it is absolute
 * and correct under any base the console is mounted at.
 *
 * It downloads `config/schema` rather than `config/reflection`: the first IS the
 * configuration, the second wraps it in an envelope of counts that belong to this
 * page rather than to the file an operator pastes into a bug report.
 */
const exportConfigButton = (): PageComponent =>
  ({
    type: 'button',
    // A LITERAL. `button.label` is read out of the component by the renderer
    // rather than resolved on the translation path, so a `$t:` token here
    // reaches the DOM as its own text — measured at 375, the control printed
    // `$t:admin.schema.raw.export`. Same trap as `kpi.label` and a tab caption.
    label: '$t:admin.common.exportJson',
    variant: 'secondary',
    props: { type: 'button', 'data-testid': 'config-schema-export' },
    action: {
      type: 'fetch',
      mode: 'download',
      url: CONFIG_SCHEMA_ENDPOINT,
      filename: 'app-config.json',
    },
  }) as PageComponent

/** One declaration family the summary counts: its id, its label and its flat count. */
export interface SummaryFamily {
  readonly id: string
  readonly label: string
  readonly countField: string
}

/** One family's figure, shown only when the configuration declares some. */
const familyRow = (family: SummaryFamily): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: family.countField, gt: 0 } },
    props: {
      'data-testid': `config-schema-summary-${family.id}`,
      className: 'flex items-baseline justify-between gap-4 py-2 text-sm',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground' },
        content: family.label,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'font-mono text-muted-foreground' },
        content: `$record.${family.countField}`,
      },
    ],
  }) as PageComponent

/**
 * The raw configuration, SUMMARISED: one figure per declared family, and the
 * whole document as a JSON download.
 *
 * ─── WHY THE DOCUMENT IS NOT PRINTED ──────────────────────────────────────
 *
 * A configuration grows without bound — this console's own runs to several
 * megabytes — and printed as a highlighted code block it makes one page of tens
 * of megabytes of markup, which hangs the browser. The figures say what is
 * declared at a glance; `Export JSON` hands over the whole document as a file,
 * which is what an operator pastes into a bug report. Binding `$record.appJson`
 * nowhere here is also what keeps it off the wire.
 */
export const rawConfigCard = (families: readonly SummaryFamily[]): PageComponent =>
  factsCard({
    title: '$t:admin.schema.raw.heading',
    description: '$t:admin.schema.raw.summary',
    testId: 'config-schema-summary',
    body: {
      type: 'container',
      element: 'div',
      // No top padding: the card's own gap already parts the body from the
      // header's rule, as in the `dl-rows` block this card copies (`px-6`).
      // A `p-6` here stacked 24 px on that gap and left a 40 px blank band.
      props: { className: 'flex flex-col gap-3 px-6 pb-6' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'divide-border flex flex-col divide-y' },
          children: families.map(familyRow),
        },
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex justify-end' },
          children: [exportConfigButton()],
        },
      ],
    } as PageComponent,
  })
