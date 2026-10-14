/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeMessageAvatarClasses,
  computeMessageClasses,
  computeMessageContentClasses,
  computeMessageFooterClasses,
  computeMessageHeaderClasses,
} from '../../design/message-default-classes'
import { splitSlots } from '../elements/slot-children'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { AUTHOR_CONTINUED_KEY } from '../resolve/message-author-resolver'
import { avatarComponent } from './avatar-component'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

/** The BCP 47 locale of the page language, for formatting the time. */
const localeOf = (currentLang: string | undefined, languages: Languages | undefined): string => {
  const entry = languages?.supported.find((language) => language.code === currentLang)
  return entry?.locale ?? currentLang ?? 'en-US'
}

/**
 * The time a turn was said, as a `<time>` whose text is formatted in the page
 * locale. Formatted on the server in UTC: the served bytes are what a cache
 * stores, so the reader's own zone is not known here.
 */
const renderTime = (timestamp: string, locale: string): ReactElement => {
  const date = new Date(timestamp)
  const text = Number.isNaN(date.getTime())
    ? timestamp
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(date)
  return <time dateTime={timestamp}>{text}</time>
}

/** The author's picture or initials, or an empty spacer on a turn that continues a run. */
const renderAvatar = (
  source: Readonly<Record<string, unknown>>,
  config: ComponentDispatchConfig,
  continued: boolean
): ReactElement | undefined => {
  const avatar = source['avatar'] as
    { readonly src?: string; readonly initials?: string } | undefined
  if (avatar === undefined) return undefined
  if (continued)
    return (
      <div
        aria-hidden="true"
        className="w-8 shrink-0"
      />
    )
  const drawn = avatarComponent({
    ...config,
    elementPropsWithSpacing: { 'data-component-type': 'avatar' },
    component: {
      type: 'avatar',
      src: avatar.src,
      initials: avatar.initials,
      label: typeof source['author'] === 'string' ? source['author'] : undefined,
    } as ComponentDispatchConfig['component'],
  })
  return (
    <div
      data-slot="message-avatar"
      className={computeMessageAvatarClasses()}
    >
      {drawn}
    </div>
  )
}

/** The line above the surface naming the author and the time, when there is either. */
const renderMeta = (
  author: string | undefined,
  timestamp: string | undefined,
  locale: string
): ReactElement | undefined =>
  author === undefined && timestamp === undefined ? undefined : (
    <div
      data-slot="message-header"
      className={computeMessageHeaderClasses()}
    >
      {author === undefined ? undefined : <span>{author}</span>}
      {timestamp === undefined ? undefined : renderTime(timestamp, locale)}
    </div>
  )

/** A header or footer slot, drawn only when it holds something. */
const renderSlot = (
  slot: 'message-header' | 'message-footer',
  content: readonly ReactElement[],
  className: string
): ReactElement | undefined =>
  content.length === 0 ? undefined : (
    <div
      data-slot={slot}
      className={className}
    >
      {content}
    </div>
  )

/**
 * `message` — one turn of a conversation (`data-slot="message"`): the author's
 * avatar, then a column holding the author and the time, the `header` slot,
 * the surface (its children) and the `footer` slot. A turn that continues the
 * previous turn's author prints neither the name nor the picture.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/message.ts
 */
const messageComponent: ComponentRenderer = (config) => {
  const { elementPropsWithSpacing, component, renderedChildren, currentLang, languages } = config
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const continued = source[AUTHOR_CONTINUED_KEY] === true
  const align = source['align'] === 'end' ? 'end' : 'start'
  const author = typeof source['author'] === 'string' && !continued ? source['author'] : undefined
  const timestamp = typeof source['timestamp'] === 'string' ? source['timestamp'] : undefined
  const slots = splitSlots('message', component, renderedChildren)
  const header = slots['header'] ?? []
  const footer = slots['footer'] ?? []
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  return (
    <div
      {...rest}
      data-slot="message"
      data-align={align}
      className={mergePrestyle(computeMessageClasses(), authorClassName as string | undefined)}
    >
      {renderAvatar(source, config, continued)}
      <div
        data-slot="message-content"
        className={computeMessageContentClasses()}
      >
        {renderMeta(author, timestamp, localeOf(currentLang, languages))}
        {renderSlot('message-header', header, computeMessageHeaderClasses())}
        {slots['$children']}
        {renderSlot('message-footer', footer, computeMessageFooterClasses())}
      </div>
    </div>
  )
}

/** The message renderer, keyed by type. */
export const messageComponents = {
  message: messageComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
