/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The run page of the Runs surface, split out of `automations.ts` so each file
// holds one page (the list and its tabs there, one run's record here).

import { CARD_LIST_CLASS } from '../../components/card'
import { factsCard } from '../../components/card-blocks'
import { consolePage, toolbarRow } from '../../components/data-page'
import { AUTOMATION_RUN_DETAIL_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

// ─── THE RUN PAGE — `/runs/:id` ─────────────────────────────
//
// One run, read in full: its header, what it was given, each step with what it
// was handed, what it returned and what it logged, and the Retry gesture.
//
// It replaced a record-bound drawer over the grid. A drawer and a page showing
// the same run would each need the steps, the logs, the status words and Retry,
// and two surfaces describing one run had already drifted here once — the grid
// said `Success` while the drawer it opened said `completed`. So there is one
// run view, and it is this page.
//
// THE RECORD IS READ ON THE SERVER. The page-level `{ system }` binding reads
// the run-detail endpoint as the visitor before the page is sent, so every
// `$record.` value is in the first response, a run id that names nothing is the
// page's own 404, and `$record.id` is already in the Retry action's URL before
// anyone can press it.
//
// EVERY FIELD IS LABELLED FOR THE PERSON READING IT. Unlabelled, a field falls
// back to its envelope key — `automationName`, `durationMs`, `triggerType` —
// which is the API's spelling rather than the operator's, and reads as a debug
// dump beside the English the rest of the console speaks.
//
// OBJECTS PRINT AS JSON, AND ONLY IN A LONE-TOKEN `code` BLOCK. `triggerData`,
// a step's `input` and its `output` are arbitrary objects whose shape differs
// per trigger and per action. A `code` node whose whole content is one token
// prints such a value as indented JSON with sorted keys; anywhere else an
// object-valued token stays a literal token rather than printing
// `[object Object]`. So each of the three sits alone in its own `code` block.

/** The run header's trigger: the entry's name, then its type. */
const TRIGGER_VALUE = '$record.triggerName ($record.triggerType)'

/** A quiet section heading — the page's `h2` voice. */
const caption = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'h2',
    props: { className: 'text-foreground-subtle text-xs font-medium tracking-wide uppercase' },
    content,
  }) as PageComponent

/**
 * One JSON block, named in its own frame — "Data in", "Data out".
 *
 * The token stands ALONE in `content`, which is what makes an object print as
 * indented JSON rather than stay a literal token. The label is the frame's
 * `filename`: left unset, the frame captions itself from the language and
 * reads `app.json`, which names a file the run never had. As the filename it
 * also labels the block for assistive technology, so no heading repeats it.
 */
const jsonSection = (label: string, token: string): PageComponent =>
  ({
    type: 'code',
    filename: label,
    props: { language: 'json' },
    content: token,
  }) as PageComponent

/**
 * The run's facts, as the console's facts card (the library's `dl-rows` block):
 * a real description list, so a screen reader announces each term with its
 * value, one ruled row per fact.
 *
 * The status reads in the grid's vocabulary, without a map in this file: the
 * platform relabels any read of the runs endpoint — the grid's in the browser,
 * this page's `{ system }` record on the server — from one shared table, so the
 * row prints `Success` where the engine stored `completed`, in the reader's
 * language. Adding a second map here is exactly how one vocabulary would come
 * to have two spellings.
 *
 * Every value is the page record substituted on the server; a row's `detail`
 * is a typed string leaf, which the page-level record pass walks.
 */
const runFacts = (): PageComponent =>
  factsCard({
    title: '$t:admin.automations.runs.detail.facts.title',
    description: '$t:admin.automations.runs.detail.facts.description',
    testId: 'run-facts',
    body: {
      type: 'description-list',
      layout: 'rows',
      dividers: true,
      props: { className: 'px-6' },
      items: [
        {
          term: '$t:admin.automations.runs.detail.field.automation',
          detail: '$record.automationName',
        },
        { term: '$t:admin.automations.runs.detail.field.status', detail: '$record.status' },
        { term: '$t:admin.automations.runs.detail.field.trigger', detail: TRIGGER_VALUE },
        { term: '$t:admin.automations.runs.detail.field.started', detail: '$record.startedAt' },
        { term: '$t:admin.automations.runs.detail.field.finished', detail: '$record.completedAt' },
        { term: '$t:admin.automations.runs.detail.field.duration', detail: '$record.durationMs' },
        { term: '$t:admin.automations.runs.detail.field.attempt', detail: '$record.attempt' },
      ],
    } as PageComponent,
  })

/**
 * The run's failure, shown as stored — and only when there is one.
 *
 * A `null` error substitutes to the empty string, which leaves the message
 * element with no content at all; the `has-[>p:empty]` rule then hides the
 * caption with it, so a run that succeeded shows no "Failure" heading over
 * nothing. The gate is a style rule rather than `visibility.record`, because a
 * page's `{ system }` record substitutes but does not gate.
 */
const runFailure = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-1 has-[>p:empty]:hidden' },
    children: [
      caption('$t:admin.automations.runs.detail.failure'),
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-error-fg font-mono text-xs break-words whitespace-pre-wrap' },
        content: '$record.error',
      },
    ],
  }) as PageComponent

/**
 * One logged line: the engine's own level word, then the message.
 *
 * `data-log-level` is the hook the console styles, and the ONLY one: the line
 * turns to the error role through `data-[log-level=error]:` and the level label
 * follows it through `in-data-[log-level=error]:`, so the colour rides a data
 * attribute and never a token inside a class list. Inside a repeat a token
 * resolves in content and in `data-*` attributes and in no other prop.
 */
const logLine = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      role: 'listitem',
      'data-testid': 'run-log',
      'data-log-level': '$log.level',
      className:
        'text-foreground flex items-baseline gap-3 px-3 py-1.5 data-[log-level=error]:text-error-fg',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: {
          className:
            'text-foreground-subtle in-data-[log-level=error]:text-error-fg w-12 shrink-0 font-mono text-xs uppercase',
        },
        content: '$log.level',
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'min-w-0 font-mono text-xs break-words whitespace-pre-wrap' },
        content: '$log.message',
      },
    ],
  }) as PageComponent

/**
 * A step's log: every line it wrote, in call order — or a sentence saying it
 * wrote none.
 *
 * The list repeats over the step's `logs`, the second level of a named, nested
 * repeat. A step that logged nothing draws no copy, which leaves the list with
 * no content at all, so `empty:hidden` removes it and the sentence right after
 * it — its next sibling, which is what `peer-empty:` needs — appears instead.
 * The endpoint always ships `logs`, empty for a silent step, so there is no
 * third state to handle.
 */
const stepLog = (): readonly PageComponent[] => [
  {
    type: 'container',
    element: 'div',
    repeat: { record: 'logs', as: 'log' },
    props: {
      role: 'list',
      'aria-label': '$t:admin.automations.runs.detail.log',
      className:
        'peer border-border divide-border flex max-h-64 flex-col divide-y overflow-y-auto rounded border empty:hidden',
    },
    children: [logLine()],
  } as PageComponent,
  {
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle hidden text-sm peer-empty:block' },
    content: '$t:admin.automations.runs.detail.noLogs',
  } as PageComponent,
]

/**
 * One station per step: its name and status on one line, its error, what it
 * was handed and what it returned, and what it logged.
 *
 * A station is NOT a control. Step-to-panel selection is not offered, and a
 * marker that cannot act is the affordance `BRAND.md` §9 forbids; a station
 * contains controls (the copy buttons of its JSON blocks) but is never one.
 *
 * `data-testid` is a literal; `data-step-index` and `data-step-status` resolve
 * per copy. The error line is empty — and invisible — on a step that did not
 * fail, because `null` substitutes to the empty string; that is what makes it
 * safe without the `visibility.record` gate a repeat may not carry.
 */
const stepStation = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: 'flex flex-col gap-3 px-4 py-3',
      'data-testid': 'run-step',
      'data-step-index': '$step.index',
      'data-step-status': '$step.status',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex items-baseline justify-between gap-3' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground min-w-0 font-mono text-sm' },
            content: '$step.name',
          },
          // Like the run header's status, the step's word is relabelled in the
          // reader's language on the server (`filtered` under its own key).
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle shrink-0 text-xs' },
            content: '$step.status',
          },
        ],
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-error-fg text-xs break-words empty:hidden' },
        content: '$step.error',
      },
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid gap-3 lg:grid-cols-2' },
        children: [
          jsonSection('$t:admin.automations.runs.detail.dataIn', '$step.input'),
          jsonSection('$t:admin.automations.runs.detail.dataOut', '$step.output'),
        ],
      },
      ...stepLog(),
    ],
  }) as PageComponent

/**
 * The steps, one station each, drawn on the server from the run's `steps`.
 *
 * The repeat is NAMED (`as: 'step'`) because a second repeat — each step's
 * `logs` — nests inside it, and an unnamed outer repeat would leave `$record.`
 * meaning two things at once. Inside it `$step.` reads the step and `$record.`
 * keeps reading the run.
 *
 * The host's `divide-y` separates the copies: a `first:` variant on the
 * template would fire on every copy, since each one is rendered as its own.
 */
const stepsSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.automations.runs.detail.steps',
      className: 'flex flex-col gap-2',
    },
    children: [
      caption('$t:admin.automations.runs.detail.steps'),
      {
        type: 'container',
        element: 'div',
        repeat: { record: 'steps', as: 'step' },
        props: {
          className: `${CARD_LIST_CLASS}`,
        },
        children: [stepStation()],
      },
    ],
  }) as PageComponent

/**
 * Where this automation lives, in place of a control.
 *
 * Configuration is code-only, so the console answers "where do I
 * change this?" with the ADDRESS rather than an edit affordance it would have to
 * refuse. Two lines, because they do two jobs: the first is a value an operator
 * copies into an editor, the second is why there is no button to press instead.
 */
const configuredInCode = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-1 border-t pt-3' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle font-mono text-xs' },
        // A config PATH, not prose: it reads the same in every language.
        content: 'automations[] → $record.automationName',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle text-sm' },
        content: '$t:admin.automations.runs.detail.configuredInCode',
      },
    ],
  }) as PageComponent

/** Back to the history — the page's way out, where the drawer's was Escape. */
const backToRuns = (): PageComponent =>
  ({
    type: 'link',
    content: '$t:admin.automations.runs.detail.back',
    props: {
      href: '/runs',
      className: 'text-muted-foreground hover:text-foreground text-sm underline',
    },
  }) as PageComponent

/**
 * Retry, confirm-gated: it starts a NEW run and leaves this one as it was. Both labels are spelled out because the confirm
 * gate's own defaults are French.
 */
const retryButton = (): PageComponent =>
  ({
    type: 'button',
    label: '$t:admin.automations.runs.detail.retry',
    variant: 'secondary',
    visibility: { capability: 'edit-operations' },
    confirm: {
      title: '$t:admin.automations.runs.detail.retry.title',
      message: '$t:admin.automations.runs.detail.retry.message',
      role: 'alertdialog',
      confirmLabel: '$t:admin.automations.runs.detail.retry',
      cancelLabel: '$t:admin.automations.cancel',
    },
    action: {
      type: 'fetch',
      method: 'POST',
      url: '/api/admin/automations/runs/$param.id/retry',
      onSuccess: { type: 'toast', message: '$t:admin.automations.runs.detail.retry.toast' },
      onError: {
        type: 'toast',
        variant: 'destructive',
        message: '$t:admin.automations.runs.detail.retry.error',
      },
    },
  }) as PageComponent

/**
 * `/runs/:id` — one run, read in full.
 *
 * Unlike the object sub-pages whose `h1` names the surface, this one's `h1`
 * names the run's AUTOMATION: a run has no name of its own, and "which
 * automation did this" is the first thing an operator opening it needs. The
 * trail carries the rest.
 *
 * `meta.title` cannot name the run: the route-param pass walks `components`
 * and `layout`, deliberately not `meta`.
 */
export const runPage: PageConfig = consolePage({
  id: 'dashboard-data-automation-run',
  path: '/runs/:id',
  title: '$t:admin.meta.automationRun',
  page: {
    requires: ['automations'],
    dataSource: { system: { endpoint: AUTOMATION_RUN_DETAIL_ENDPOINT, param: 'id' } },
  },
  shell: {
    breadcrumb: { runs: '$t:admin.crumb.runs' },
  },
  body: [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex min-w-0 flex-col gap-6 pt-2 pb-8' },
      children: [
        toolbarRow([backToRuns(), retryButton()]),
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-1' },
          children: [
            {
              type: 'text',
              element: 'h1',
              props: { className: 'text-foreground font-mono text-lg font-medium' },
              content: '$record.automationName',
            },
            {
              type: 'text',
              element: 'p',
              props: { className: 'sr-only' },
              content: '$t:admin.automations.runs.detail.blurb',
            },
          ],
        },
        runFacts(),
        jsonSection('$t:admin.automations.runs.detail.dataIn', '$record.triggerData'),
        runFailure(),
        stepsSection(),
        configuredInCode(),
      ],
    } as PageComponent,
  ],
})

/** The run history and the one run that reads out of it. */
