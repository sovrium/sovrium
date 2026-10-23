/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
} from '@/domain/models/app/languages/translation-resolver'
import { deriveInitials } from '@/presentation/design/avatar-initials'
import {
  computeReplySummaryAvatarClasses,
  computeReplySummaryAvatarsClasses,
  computeReplySummaryClasses,
  computeReplySummaryTimeClasses,
} from '@/presentation/design/reply-summary-classes'
import {
  buildCommentThreadIslandProps,
  resolveTableCommentsConfig,
} from './social-components-helpers'
import type { ComponentDispatchConfig } from './component-dispatch-config'
import type { ReplySummaryView } from '../resolve/conversation-extras'
import type { ReactElement } from 'react'

/** How the last reply's time reads, in the page locale, in UTC as a turn's time does. */
const formatInstant = (iso: string, locale: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(date)
}

/** The comment thread the sheet opens: the record's own, as a `comments` component draws it. */
const threadProps = (summary: ReplySummaryView, config: ComponentDispatchConfig) => {
  const { currentLang, languages, session, tables } = config
  return buildCommentThreadIslandProps({
    fields: {
      id: undefined,
      limit: 50,
      sort: 'oldest',
      paginationStyle: 'loadMore',
      emptyText: '',
      placeholder: resolveInterpreterString('comments.placeholder', currentLang, languages),
      table: summary.tableName,
      recordId: summary.recordId,
      refreshMode: 'none',
    },
    elementProps: {},
    session,
    threading: resolveTableCommentsConfig(summary.tableName, tables).threading,
    uiStrings: resolveInterpreterStringOverrides(
      ['comments.', 'form.saving', 'form.deleting'],
      currentLang,
      languages
    ),
  })
}

const isSummary = (value: unknown): value is ReplySummaryView =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { readonly count?: unknown }).count === 'number'

/** What the summary button holds: the last repliers' initials, the count, the last time. */
function SummaryContent(props: {
  readonly repliers: readonly { readonly name: string; readonly initials: string }[]
  readonly label: string
  readonly lastAt: string
  readonly lastAtText: string
}): ReactElement {
  return (
    <>
      <span className={computeReplySummaryAvatarsClasses()}>
        {props.repliers.map((replier) => (
          <span
            key={replier.name}
            title={replier.name}
            className={computeReplySummaryAvatarClasses()}
          >
            {replier.initials}
          </span>
        ))}
      </span>
      <span>{props.label}</span>
      <time
        dateTime={props.lastAt}
        className={computeReplySummaryTimeClasses()}
      >
        {props.lastAtText}
      </time>
    </>
  )
}

/**
 * The reply summary under a turn whose record has replies (`message.replies`):
 * the count, the last three repliers' initials and the last reply's time, as
 * one button. The `reply-thread` island takes it over and opens the record's
 * comment thread in a sheet from it; until then it is the same button, drawn.
 */
export function ReplySummary({
  summary,
  config,
  locale,
}: {
  readonly summary: unknown
  readonly config: ComponentDispatchConfig
  readonly locale: string
}): ReactElement | undefined {
  if (!isSummary(summary)) return undefined
  const { currentLang, languages } = config
  const word = (key: string) => resolveInterpreterString(key, currentLang, languages)
  const label =
    summary.count === 1
      ? word('conversation.reply')
      : fillPlaceholders(word('conversation.replies'), { count: summary.count })
  const repliers = summary.lastRepliers.map((name) => ({ name, initials: deriveInitials(name) }))
  const when = formatInstant(summary.lastAt, locale)
  const islandProps = {
    label,
    repliers,
    lastAt: summary.lastAt,
    lastAtText: when,
    title: word('conversation.thread'),
    closeLabel: word('dialog.close'),
    thread: threadProps(summary, config),
  }
  return (
    <span
      data-slot="message-replies"
      data-island="reply-thread"
      data-island-props={JSON.stringify(islandProps)}
    >
      {/* Disabled until the island takes it over: a press before then would open nothing. */}
      <button
        type="button"
        disabled
        className={computeReplySummaryClasses()}
      >
        <SummaryContent
          repliers={repliers}
          label={label}
          lastAt={summary.lastAt}
          lastAtText={when}
        />
      </button>
    </span>
  )
}
