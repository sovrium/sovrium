/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The four reusable templates this console declares for itself.
//
// ─── WHY THE CONSOLE DECLARES ANY ──────────────────────────────────────────
//
// `/design-system/components` enumerates the components of the app it is
// mounted in, and until now the console declared none — so the page that
// documents reusable templates had nothing to document, on the one app whose
// whole purpose is to show what a Sovrium app looks like. Four of its own
// recurring shapes are lifted here, named, and given the guidance an author
// would read before reaching for one.
//
// ─── WHAT AN OPERATOR SEES, WHICH IS NOT THIS ──────────────────────────────
//
// The Components index reads the components of the app the SERVER booted with.
// On a mounted deployment that is the operator's array, so these four appear in
// the console's own preview and never on an operator's install — where the page
// correctly shows the empty state, because that operator has declared none.
// These are the console dogfooding its own page, not a feature an operator
// gains.
//
// ─── NO FOOTER AND NO BUILT-FROM CLAIM IN HERE ─────────────────────────────
//
// `Built-From Footer Drift` walks `pages` and nothing else, so markup that
// lives in this array is invisible to it: a `data-design-kit-type` stamp here
// would not be counted, and a `data-design-built-from-type` claim here would be
// a claim the gate cannot verify. Every stamp and every claim therefore stays
// on the page's own tree. That is also why none of the four closes with a
// footer — a reusable template is a part, and only a page states what it was
// built from.
//
// ─── THE VARIABLES ARE THE POINT ───────────────────────────────────────────
//
// Each `$name` is substituted from the `vars` of the reference that embeds it.
// A template with no variables is a copy-paste with extra steps; these carry
// the data each shape actually varies on, and nothing else.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

/** One reusable template, as the config type expresses it. */
type Template = NonNullable<AppConfig['components']>[number]

/**
 * The sticky bar over every console page.
 *
 * It carries where the reader is and the two controls that follow them
 * everywhere — and deliberately nothing else. A page's own actions belong to
 * the header below it, which is what keeps this bar identical on all of them.
 */
const consoleTopbar = {
  name: 'console-topbar',
  type: 'container',
  element: 'div',
  guidance: {
    usage: '$t:admin.ds.tpl.shell.usage',
    when: '$t:admin.ds.tpl.shell.when',
    dont: '$t:admin.ds.tpl.shell.dont',
  },
  props: {
    className:
      'border-border bg-background sticky top-0 z-10 flex min-h-13 items-center gap-2 border-b px-8',
  },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-muted-foreground text-sm' },
      content: '$app',
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-muted-foreground text-sm' },
      content: '/',
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-muted-foreground hidden text-sm sm:inline' },
      content: '$area',
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-muted-foreground hidden text-sm sm:inline' },
      content: '/',
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-foreground text-sm font-medium' },
      content: '$current',
    },
    {
      type: 'container',
      element: 'div',
      props: { className: 'ml-auto flex items-center gap-1' },
      children: [
        {
          type: 'icon',
          props: {
            name: 'search',
            size: 16,
            className: 'text-muted-foreground size-8 rounded-md p-2',
            'aria-label': '$t:admin.common.search',
          },
        },
        {
          type: 'icon',
          props: {
            name: 'moon',
            size: 16,
            className: 'text-muted-foreground size-8 rounded-md p-2',
            'aria-label': '$t:admin.common.toggleTheme',
          },
        },
      ],
    },
  ],
} as unknown as Template

/**
 * The title block of a records page.
 *
 * What the collection is, how many rows it holds, and the two things a reader
 * can do to it — then the line that narrows what is shown. It never repeats the
 * trail: the bar above it already said where this is.
 */
const dataPageHeader = {
  name: 'data-page-header',
  type: 'container',
  element: 'div',
  guidance: {
    usage: '$t:admin.ds.tpl.header.usage',
    when: '$t:admin.ds.tpl.header.when',
    dont: '$t:admin.ds.tpl.header.dont',
  },
  props: { className: 'bg-background flex flex-col gap-3.5 px-8 py-6' },
  children: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-wrap items-center gap-3' },
      children: [
        {
          type: 'text',
          element: 'h2',
          props: { className: 'text-foreground text-2xl font-semibold tracking-tight' },
          content: '$title',
        },
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              'bg-background-muted text-muted-foreground rounded-xs px-1.5 py-0.5 text-[11px]',
          },
          content: '$count',
        },
        {
          type: 'container',
          element: 'div',
          props: { className: 'ml-auto flex flex-none items-center gap-2' },
          children: [
            {
              type: 'button',
              label: '$t:admin.common.exportCsv',
              variant: 'outline',
              size: 'sm',
              props: { type: 'button', disabled: true },
            },
            {
              type: 'button',
              label: '$t:admin.common.newRecord',
              variant: 'default',
              size: 'sm',
              props: { type: 'button', disabled: true },
            },
          ],
        },
      ],
    },
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-wrap items-center gap-2' },
      children: [
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              'border-border text-muted-foreground flex h-8 w-70 max-w-full items-center rounded-xs border px-3 text-sm',
          },
          content: '$searchLabel',
        },
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              'border-border text-muted-foreground rounded-md border px-2.5 py-1 font-mono text-xs',
          },
          content: '$filterOne',
        },
        {
          type: 'text',
          element: 'span',
          props: {
            className:
              'border-border text-muted-foreground hidden rounded-md border px-2.5 py-1 font-mono text-xs sm:inline',
          },
          content: '$filterTwo',
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-muted-foreground ml-auto flex-none text-xs' },
          content: '$range',
        },
      ],
    },
  ],
} as unknown as Template

/**
 * What a console surface says when it has nothing to show.
 *
 * The next action is not optional here, and the `dont` says so: an empty state
 * without one is a dead end, which is the single most common way a surface that
 * renders correctly still fails the person reading it.
 */
const emptyStateCard = {
  name: 'empty-state-card',
  type: 'container',
  element: 'div',
  guidance: {
    usage: '$t:admin.ds.tpl.empty.usage',
    when: '$t:admin.ds.tpl.empty.when',
    dont: '$t:admin.ds.tpl.empty.dont',
  },
  props: { className: 'flex justify-center p-8' },
  children: [
    {
      type: 'container',
      element: 'div',
      props: {
        className:
          'border-border flex w-full flex-col items-start gap-2.5 rounded-lg border border-dashed px-7 py-6',
      },
      children: [
        { type: 'icon', props: { name: 'zap', size: 18, className: 'text-muted-foreground' } },
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground text-md font-semibold' },
          content: '$title',
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground-subtle max-w-[56ch] text-sm leading-relaxed' },
          content: '$body',
        },
        {
          type: 'button',
          label: '$action',
          variant: 'outline',
          size: 'sm',
          props: { type: 'button', disabled: true, className: 'mt-0.5' },
        },
      ],
    },
  ],
} as unknown as Template

/**
 * One line of the operational record.
 *
 * Who did what to which object, and when — with the clock time rather than a
 * relative one, because the reader is usually correlating this against a log
 * that has no idea what "3 minutes ago" means.
 */
const auditRow = {
  name: 'audit-row',
  type: 'container',
  element: 'div',
  guidance: {
    usage: '$t:admin.ds.tpl.timeline.usage',
    when: '$t:admin.ds.tpl.timeline.when',
    dont: '$t:admin.ds.tpl.timeline.dont',
  },
  props: {
    className: 'border-border flex items-center gap-2.5 border-b px-8 py-3 last:border-b-0',
  },
  children: [
    {
      type: 'text',
      element: 'span',
      props: {
        className:
          'bg-background-muted text-muted-foreground flex size-6.5 flex-none items-center justify-center rounded-full text-[11px] font-medium',
      },
      content: '$initial',
    },
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-w-0 flex-1 flex-col gap-0.5' },
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-wrap items-baseline gap-1' },
          children: [
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground text-sm font-medium' },
              content: '$actor',
            },
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground text-sm' },
              content: '$verb',
            },
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground font-mono text-sm' },
              content: '$subject',
            },
          ],
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-muted-foreground text-[11px]' },
          content: '$surface',
        },
      ],
    },
    {
      type: 'text',
      element: 'span',
      props: { className: 'text-muted-foreground flex-none font-mono text-[11px]' },
      content: '$at',
    },
  ],
} as unknown as Template

/** The four, in the order the Components index composes them. */
const templates: readonly Template[] = [consoleTopbar, dataPageHeader, emptyStateCard, auditRow]

export default templates
