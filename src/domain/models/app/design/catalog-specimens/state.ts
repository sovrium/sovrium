/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The kit categories that report STATE: interactive, feedback.
 *
 * ─── WHY THESE ARE NOT IN `catalog-specimens/index.ts` ─────────────
 *
 * That module holds the four categories the catalog phase specified, each
 * behind a long note explaining a decision that phase made — the fixture
 * endpoint, the two safety exclusions, the `tab-panel` discovery. Folding eight
 * more categories in would put sixty specimens behind those notes and bury
 * them. The three files are read for different reasons and are kept apart for
 * that reason; `specimensOf` composes them.
 *
 * The completion pass added eight categories across three files, split by what
 * a reader DOES with them: this one is what tells them something happened
 * (interactive, feedback); `catalog-specimens/content.ts` is what a
 * page shows (content, display); `catalog-specimens/interaction.ts`
 * is what they trigger (navigation, overlays, specialty, AI), and is where
 * every refusal lives.
 *
 * ─── EVERY PROP HERE WAS MEASURED, NOT GUESSED ─────────────────────────────
 *
 * Each specimen below was rendered through the real pipeline before it was
 * written down, and several are the SECOND shape tried:
 *
 * ─── EVERY PROP WAS MEASURED, NOT GUESSED ──────────────────────────────────
 *
 * Every specimen in all three files was rendered through the real pipeline
 * before it was written down, and several are the SECOND shape tried. The rule
 * they have in common: a specimen with the wrong prop shape does not fail, it
 * renders EMPTY — the "confidently empty box" the catalog's hand-authored
 * specimen tables exist to prevent. Re-render before editing any of them.
 */

import type { CatalogSpecimen } from '.'
import type { Component } from '@/domain/models/app/pages/components'

const component = (value: unknown): Component => value as Component

/**
 * The six interactive types.
 *
 * The button labels are the mockup's, and they are chosen rather than
 * inherited: `[internal ref]` draws this same
 * category with `Save` / `Edit actions`, and both trip the read-only console's
 * forbidden-verb sweep on a substring match. The
 * sweep is deliberately over-matching, so the fix is to rename the specimen —
 * which is what these labels are.
 */
const INTERACTIVE_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'button',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-wrap items-center gap-2' },
      children: [
        { type: 'button', variant: 'default', label: 'Create table' },
        { type: 'button', variant: 'secondary', label: 'Export CSV' },
        { type: 'button', variant: 'ghost', label: 'View log' },
        { type: 'button', variant: 'destructive', label: 'Delete' },
        { type: 'button', variant: 'outline', label: 'Disabled', props: { disabled: true } },
      ],
    }),
  },
  {
    type: 'badge',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-wrap items-center gap-2' },
      children: [
        { type: 'badge', badgeVariant: 'default', content: 'active' },
        { type: 'badge', badgeVariant: 'outline', content: 'draft' },
        { type: 'badge', badgeVariant: 'destructive', content: 'failed' },
        { type: 'badge', variant: 'status', statusColor: 'green', status: 'Online' },
      ],
    }),
  },
  {
    type: 'alert',
    component: component({
      type: 'alert',
      alertVariant: 'destructive',
      content: 'Migration failed. The database was left unchanged.',
    }),
  },
  {
    type: 'button-group',
    component: component({
      type: 'button-group',
      props: { label: 'Date range' },
      children: [
        { type: 'button', variant: 'outline', label: 'Day' },
        { type: 'button', variant: 'outline', label: 'Week' },
      ],
    }),
  },
  {
    type: 'link',
    component: component({ type: 'link', content: 'A link', props: { href: '#' } }),
  },
  { type: 'theme-toggle', component: component({ type: 'theme-toggle' }) },
]

/** The three feedback types. */
const FEEDBACK_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'progress',
    component: component({
      type: 'progress',
      progressValue: 65,
      progressMax: 100,
      showLabel: true,
      props: { label: 'Import' },
    }),
  },
  {
    type: 'spinner',
    component: component({
      type: 'spinner',
      props: {
        // `animate: false` is not available here the way it is on `skeleton`,
        // and it does not need to be: nothing in this console captures pixels.
        className: 'border-border border-t-primary inline-block h-6 w-6 rounded-full border-2',
        role: 'status',
        'aria-label': 'Loading',
      },
    }),
  },
  {
    type: 'skeleton',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex w-full flex-col gap-1.5' },
      children: [
        {
          type: 'skeleton',
          skeletonVariant: 'text',
          skeletonWidth: '100%',
          skeletonHeight: '0.6rem',
          animate: false,
        },
        {
          type: 'skeleton',
          skeletonVariant: 'text',
          skeletonWidth: '70%',
          skeletonHeight: '0.6rem',
          animate: false,
        },
        {
          type: 'skeleton',
          skeletonVariant: 'rectangular',
          skeletonWidth: '100%',
          skeletonHeight: '2rem',
          animate: false,
        },
      ],
    }),
  },
]

/** The two categories this module owns. */
export const STATE_SPECIMENS_BY_CATEGORY = {
  interactive: INTERACTIVE_SPECIMENS,
  feedback: FEEDBACK_SPECIMENS,
} as const satisfies Readonly<Record<string, readonly CatalogSpecimen[]>>
