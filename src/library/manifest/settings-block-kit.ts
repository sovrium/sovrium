/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the SETTINGS and PROFILE blocks share: a column 720 px wide (880 for
 * the list-heavy pages) made of GROUPS. A group is an `h2`, one help line and a
 * bordered surface of ROWS; a row is a label with its help on the left and the
 * control on the right, stacked on a phone. Destructive rows sit in a last
 * group bordered in the error role.
 *
 * The column sits beside the `vertical-nav-settings` block on a settings page;
 * the blocks draw only the column so a page can arrange the two as it likes.
 */

import type { BlockNode } from './block-kit'

/** The settings column, at the reading width the page holds. */
export const settingsColumn = (children: readonly BlockNode[], wide = false): BlockNode => ({
  type: 'container',
  element: 'section',
  props: {
    className: `flex w-full ${wide ? 'max-w-220' : 'max-w-180'} flex-col gap-10 px-4 py-6 sm:px-8 sm:py-8`,
  },
  children,
})

/** The page heading of a settings column and its line. */
export const settingsTitle = (title: string, sentence: string): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-col gap-1' },
  children: [
    {
      type: 'text',
      element: 'h1',
      props: { className: 'text-2xl font-semibold tracking-tight text-foreground' },
      content: title,
    },
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-md text-foreground-muted' },
      content: sentence,
    },
  ],
})

/** A group: its heading, one help line, and the bordered surface of rows. */
export const settingsGroup = (
  title: string,
  help: string,
  rows: readonly BlockNode[],
  options: { readonly danger?: boolean; readonly side?: readonly BlockNode[] } = {}
): BlockNode => ({
  type: 'container',
  element: 'section',
  props: { className: 'flex flex-col gap-3' },
  children: [
    {
      type: 'flex',
      props: { className: 'flex flex-wrap items-end justify-between gap-3' },
      children: [
        {
          type: 'flex',
          props: { className: 'flex flex-col gap-1' },
          children: [
            {
              type: 'text',
              element: 'h2',
              props: { className: 'text-lg font-semibold text-foreground' },
              content: title,
            },
            {
              type: 'text',
              element: 'p',
              props: { className: 'text-md text-foreground-muted' },
              content: help,
            },
          ],
        },
        ...(options.side ?? []),
      ],
    },
    {
      type: 'container',
      props: {
        className: `flex flex-col divide-y rounded-lg border bg-background-raised ${
          options.danger === true
            ? 'divide-error-border border-error-border'
            : 'divide-border border-border'
        }`,
      },
      children: rows,
    },
  ],
})

/** A row: label and help on the left, the control on the right; stacked on a phone. */
export const settingsRow = (
  label: string,
  help: string,
  controls: readonly BlockNode[]
): BlockNode => ({
  type: 'flex',
  props: {
    className: 'flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8',
  },
  children: [
    {
      type: 'flex',
      props: { className: 'flex min-w-0 flex-col gap-0.5 sm:max-w-64' },
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-md font-medium text-foreground' },
          content: label,
        },
        ...(help === ''
          ? []
          : [
              {
                type: 'text',
                element: 'p',
                props: { className: 'text-sm text-foreground-muted' },
                content: help,
              },
            ]),
      ],
    },
    {
      type: 'container',
      props: { className: 'flex min-w-0 flex-1 flex-col gap-2 sm:max-w-sm' },
      children: controls,
    },
  ],
})

/** A full-width row holding one list or grid, with no label column. */
export const settingsListRow = (children: readonly BlockNode[]): BlockNode => ({
  type: 'container',
  props: { className: 'min-w-0 p-2' },
  children,
})

/** A self-service account form posting to one of the built-in account endpoints. */
export const accountEndpointForm = (options: {
  readonly url: string
  readonly label: string
  readonly submitLabel: string
  readonly saved: string
  readonly failed: string
  readonly fields: readonly BlockNode[]
}): BlockNode => ({
  type: 'form',
  props: { 'aria-label': options.label },
  endpoint: {
    url: options.url,
    method: 'POST',
    responseEnvelope: 'better-auth',
    submitLabel: options.submitLabel,
    submitVariant: 'secondary',
    onSuccess: { type: 'toast', variant: 'success', message: options.saved },
    onError: { type: 'toast', variant: 'destructive', message: options.failed },
  },
  fields: options.fields,
})

/** The note every settings block carries on where it sits. */
export const SETTINGS_PLACE_NOTE =
  'The block draws the settings column. Place it on a signed-in page beside the `vertical-nav-settings` block — a two-column grid at `md` and up, the menu above on a phone — or alone.'
