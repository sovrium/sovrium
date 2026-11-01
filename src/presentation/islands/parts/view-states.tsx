/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeAlertClasses,
  computeAlertDescriptionClasses,
  computeAlertTitleClasses,
} from '@/presentation/design/alert-default-classes'
import {
  computeEmptyDescriptionClasses,
  computeEmptyHeaderClasses,
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
} from '@/presentation/design/empty-default-classes'
import { useNamedHostAttributes } from '../hooks/use-named-host-attributes'
import {
  isMalformedRead,
  isNotFoundRead,
  isRateLimitedRead,
  isSessionEndedRead,
  RateLimitedNotice,
} from '../runtime/read-failure'
import type { ReactElement, ReactNode } from 'react'

/**
 * What a data view (calendar, chart, gallery, kanban, KPI, list, timeline)
 * draws INSTEAD of its records: the read in flight, the read refused, nothing
 * to draw, or a binding the config left out. One module for every view, on
 * shadcn/ui's `Alert` and `Empty` anatomy, so the seven views say the same
 * thing the same way and differ only in their words (`<view>.*`).
 *
 * A failed read never prints the response: its body and status name the
 * server's internals, which tell a reader nothing and an attacker something.
 * It is classified instead, by status, into a reason a reader can act on.
 */

/** A view's words in the page language, where they differ from English. */
export type ViewStrings = Readonly<Record<string, string>> | undefined

/**
 * The English every view shares, when the host sent no override. Each view
 * passes its OWN English (`words`) beside it, so an island carries the
 * fallbacks of its own states and no other view's: the page-language text
 * comes from the server catalogue under the same keys.
 */
const COMMON: Readonly<Record<string, string>> = {
  'component.refreshToRetry': 'Refresh the page to try again.',
  'component.configHint': 'Add it to this component in your app config, then redeploy.',
  'component.readFailure.rateLimited': 'too many requests, wait a moment',
  'component.readFailure.notFound': 'this data is not available to you',
  'component.readFailure.sessionEnded': 'your session has ended, sign in again',
  'component.readFailure.refused': 'the server did not accept the requested filter or sort',
  'component.readFailure.unavailable': 'the server could not answer',
}

/** A view's own English for its state keys (`<view>.loadFailed`, `<view>.missing…`, `<view>.empty…`). */
type ViewWords = Readonly<Record<string, string>>

const NO_WORDS: ViewWords = {}

const wordOf = (strings: ViewStrings, key: string, words: ViewWords = NO_WORDS): string =>
  strings?.[key] ?? words[key] ?? COMMON[key] ?? key

/** The views that read records and may fail to. */
type ReadingView = 'calendar' | 'chart' | 'gallery' | 'kanban' | 'kpi' | 'list' | 'timeline'

/**
 * The element that NAMES the island (`data-component`), and what the state
 * writes onto it — the KPI's `data-kpi-state`.
 */
export interface NamedHostState {
  readonly name: string
  readonly attributes: Readonly<Record<string, string>>
}

/** Attributes the state element carries itself (`data-chart-state`, …). */
type StateAttributes = Readonly<Record<`data-${string}`, string>>

const NO_HOST_ATTRIBUTES: Readonly<Record<string, string>> = {}

/** The ref that writes `host`'s attributes onto the naming element; inert without one. */
const useHostRef = (host: NamedHostState | undefined) =>
  useNamedHostAttributes<HTMLDivElement>(host?.name ?? '', host?.attributes ?? NO_HOST_ATTRIBUTES)

/** A failed read's reason, from its status alone. */
const readFailureReason = (error: unknown, strings: ViewStrings): string => {
  if (isRateLimitedRead(error)) return wordOf(strings, 'component.readFailure.rateLimited')
  if (isNotFoundRead(error)) return wordOf(strings, 'component.readFailure.notFound')
  if (isSessionEndedRead(error)) return wordOf(strings, 'component.readFailure.sessionEnded')
  if (isMalformedRead(error)) return wordOf(strings, 'component.readFailure.refused')
  return wordOf(strings, 'component.readFailure.unavailable')
}

/**
 * Whether asking again can change the answer: a 404 is answered the same way
 * however often it is asked, and an ended session needs a sign-in first, which
 * its reason already says.
 */
const isRefreshWorthwhile = (error: unknown): boolean =>
  !isNotFoundRead(error) && !isSessionEndedRead(error)

const ALERT_TITLE_CLASSES = computeAlertTitleClasses()
const ALERT_DESCRIPTION_CLASSES = computeAlertDescriptionClasses()
const ERROR_CLASSES = computeAlertClasses({ variant: 'destructive' })
const MISSING_CLASSES = computeAlertClasses({ variant: 'warning' })

/**
 * The read in flight: a `status` named in the page language, around the
 * view's own skeleton — drawn at the geometry the records will take, so the
 * swap moves no line.
 */
export function ViewLoading({
  label,
  className,
  attributes,
  host,
  children,
}: {
  readonly label: string
  readonly className?: string
  readonly attributes?: StateAttributes
  readonly host?: NamedHostState
  readonly children: ReactNode
}): ReactElement {
  return (
    <div
      className={className}
      ref={useHostRef(host)}
      role="status"
      data-loading-status=""
      aria-label={label}
      {...attributes}
    >
      {children}
    </div>
  )
}

/**
 * A refused read. With `onRetry`, a spent read budget (429) draws the shared
 * rate-limited notice whose Retry asks again; any other failure says what the
 * view could not load, why in words, and — unless `hint` is off — to refresh.
 */
export function ViewError({
  of,
  words,
  error,
  strings,
  onRetry,
  hint = true,
  lead,
  attributes,
  host,
}: {
  readonly of: ReadingView
  readonly words: ViewWords
  readonly error: unknown
  readonly strings: ViewStrings
  readonly onRetry?: () => void
  readonly hint?: boolean
  /** Drawn above the sentence: the KPI keeps its label in its failure. */
  readonly lead?: ReactNode
  readonly attributes?: StateAttributes
  readonly host?: NamedHostState
}): ReactElement {
  const ref = useHostRef(host)
  if (onRetry !== undefined && isRateLimitedRead(error))
    return (
      <RateLimitedNotice
        onRetry={onRetry}
        strings={strings}
      />
    )
  const message = wordOf(strings, `${of}.loadFailed`, words).replace('{error}', () =>
    readFailureReason(error, strings)
  )
  return (
    <div
      data-slot="alert"
      className={ERROR_CLASSES}
      ref={ref}
      role="alert"
      {...attributes}
    >
      {lead}
      <div
        data-slot="alert-title"
        className={ALERT_TITLE_CLASSES}
      >
        {message}
      </div>
      {hint && isRefreshWorthwhile(error) && (
        <div
          data-slot="alert-description"
          className={ALERT_DESCRIPTION_CLASSES}
        >
          {wordOf(strings, 'component.refreshToRetry')}
        </div>
      )}
    </div>
  )
}

/**
 * A binding the config left out: the `sentence` saying which, its `{setting}`
 * drawn as code, and — with `hint` — how to add it.
 */
export function ViewMissing({
  sentence,
  setting,
  hint = false,
  words,
  strings,
  attributes,
  host,
}: {
  readonly sentence: string
  readonly setting?: string
  readonly hint?: boolean
  readonly words: ViewWords
  readonly strings: ViewStrings
  readonly attributes?: StateAttributes
  readonly host?: NamedHostState
}): ReactElement {
  const [before, after] = wordOf(strings, sentence, words).split('{setting}')
  return (
    <div
      data-slot="alert"
      className={MISSING_CLASSES}
      ref={useHostRef(host)}
      role="alert"
      {...attributes}
    >
      <div
        data-slot="alert-title"
        className={ALERT_TITLE_CLASSES}
      >
        {before}
        {setting !== undefined && after !== undefined && (
          <>
            <code>{setting}</code>
            {after}
          </>
        )}
      </div>
      {hint && (
        <div
          data-slot="alert-description"
          className={ALERT_DESCRIPTION_CLASSES}
        >
          {wordOf(strings, 'component.configHint')}
        </div>
      )}
    </div>
  )
}

/** The views that may find nothing to draw. */
type EmptyView = 'chart' | 'gallery' | 'timeline'

/** Under the engine's own empty words, its hint; under the author's own title, the author's next step, if any. */
const emptyHintOf = (
  title: string | undefined,
  region: { readonly description?: string } | undefined,
  engineHint: string
): string | undefined => (title === undefined ? engineHint : region?.description)

/**
 * Nothing to draw: shadcn/ui's `Empty`, titled with the author's `message`,
 * else the view's own line and where records will come from. With `region`,
 * the empty state is a named landmark a screen-reader user can reach.
 */
export function ViewEmpty({
  of,
  words,
  message,
  strings,
  region,
  announce = false,
  attributes,
}: {
  readonly of: EmptyView
  readonly words: ViewWords
  readonly message: string | undefined
  readonly strings: ViewStrings
  readonly region?: {
    readonly name: string
    readonly title?: string
    readonly description?: string
  }
  /** Announce the empty state as a `status` (when it replaces a live list). */
  readonly announce?: boolean
  readonly attributes?: StateAttributes
}): ReactElement {
  const title = region?.title ?? message
  const hint = emptyHintOf(title, region, wordOf(strings, `${of}.emptyHint`, words))
  const Root = region === undefined ? 'div' : 'section'
  return (
    <Root
      data-slot="empty"
      data-empty="true"
      className={`${computeEmptyStateContainerClasses()} border`}
      role={region === undefined ? (announce ? 'status' : undefined) : 'region'}
      aria-label={region?.name}
      {...attributes}
    >
      <div
        data-slot="empty-header"
        className={computeEmptyHeaderClasses()}
      >
        <div
          data-slot="empty-title"
          className={computeEmptyStateTitleClasses()}
        >
          {title ?? wordOf(strings, `${of}.empty`, words)}
        </div>
        {hint !== undefined && (
          <p
            data-slot="empty-description"
            className={computeEmptyDescriptionClasses()}
          >
            {hint}
          </p>
        )}
      </div>
    </Root>
  )
}
