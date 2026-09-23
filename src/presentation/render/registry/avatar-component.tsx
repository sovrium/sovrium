/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `avatar` — a person or a record as a picture, initials, or a stack of them.
 *
 * ─── THE FALLBACK CHAIN IS THE COMPONENT ───────────────────────────────────
 *
 * `src` → `initials` → initials derived from `label` → an empty disc, and
 * exactly ONE rung is drawn. Every rung above the last exists because the one
 * above IT can be absent at RENDER time rather than at decode time: a record's
 * photo column is null for most rows and its name column is not, so an author
 * binding `src: '$record.photo'` gets a readable initial instead of a broken
 * image without writing the fallback themselves.
 *
 * Deriving from `label` is the rung that earns the type its place over a bare
 * `image`, and it is one line here where it is a formula in a config.
 *
 * ─── AND THE PARTS ARE NAMED, NOT CLASSED ──────────────────────────────────
 *
 * `data-avatar-image`, `data-avatar-initials`, `data-avatar-status`,
 * `data-avatar-item` and `data-avatar-overflow` name the anatomy — the same
 * vocabulary `design.components.avatar.parts` restyles and the same one
 * `swatch` established with `data-token-chip`. A stylesheet or a spec
 * addressing them by class would pin the recipe rather than the anatomy.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/avatar.ts
 * Specs: [internal ref]
 */

import { deriveInitials } from '@/presentation/design/avatar-initials'
import {
  computeAvatarBoxClasses,
  computeAvatarGroupClasses,
  computeAvatarImageClasses,
  computeAvatarMemberClasses,
  computeAvatarOverflowClasses,
  computeAvatarStatusClasses,
  type AvatarShape,
  type AvatarSize,
  type AvatarStatus,
} from '../../design/display-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** One member of a group stack, as the schema declares it. */
interface AvatarMember {
  readonly src?: string
  readonly initials?: string
  readonly label?: string
  readonly status?: string
}

const AVATAR_SIZES = new Set<AvatarSize>(['sm', 'md', 'lg'])
const AVATAR_STATUSES = new Set<AvatarStatus>(['online', 'away', 'busy', 'offline'])

/** Read one string field off a component definition. */
const text = (source: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/** The rung of the size ladder this avatar draws at. `md` is the default. */
const sizeOf = (source: Readonly<Record<string, unknown>>): AvatarSize => {
  const declared = source['size']
  return AVATAR_SIZES.has(declared as AvatarSize) ? (declared as AvatarSize) : 'md'
}

/** The corner shape. `circle` is the default — people, rather than records. */
const shapeOf = (source: Readonly<Record<string, unknown>>): AvatarShape =>
  source['shape'] === 'square' ? 'square' : 'circle'

/**
 * The presence to draw, or `undefined` for silence.
 *
 * Silence is NOT `offline`: saying nothing about a person's presence and saying
 * they are away are different statements, and a renderer that defaulted one to
 * the other would invent a fact about them.
 */
const statusOf = (source: { readonly status?: unknown }): AvatarStatus | undefined => {
  const declared = source.status
  return AVATAR_STATUSES.has(declared as AvatarStatus) ? (declared as AvatarStatus) : undefined
}

/** The `$session.<field>` token, which an avatar may carry in any of its rungs. */
const SESSION_TOKEN = '$session.'

/** The rungs of the chain a session binding can be written into. */
const BOUND_KEYS = ['src', 'label', 'initials', 'alt'] as const

/**
 * The fall-back chain an avatar hands the CLIENT, when any rung is bound to the
 * caller's own session.
 *
 * All four rungs travel, templates and literals alike, so the client redraws
 * the whole chain from one payload rather than merging a resolved rung into a
 * server-rendered one — the mixing bug that would drop a static `initials`
 * beside a bound `src`. `imageClass` travels with them so the client makes no
 * styling decision of its own.
 */
function sessionBindingOf(
  source: Readonly<Record<string, unknown>>,
  shape: AvatarShape
): string | undefined {
  const values = BOUND_KEYS.map((key) => [key, text(source, key)] as const)
  if (!values.some(([, value]) => value !== undefined && value.includes(SESSION_TOKEN))) {
    return undefined
  }
  return JSON.stringify({
    ...Object.fromEntries(values.filter(([, value]) => value !== undefined)),
    imageClass: computeAvatarImageClasses({ shape }),
  })
}

/**
 * One rung as the SERVER may draw it: an unresolved token is an ABSENCE.
 *
 * This is the half a text substitution does not have to get right. A surviving
 * `$session.` token in visible text is merely ugly; the same token in `src` is
 * requested as a relative URL and painted as a broken image, and in the served
 * bytes it would be the identity itself — which must never be there, because a
 * cached page carrying one serves one caller's name to the next.
 */
const unboundValue = (value: string | undefined): string | undefined =>
  value !== undefined && value.includes(SESSION_TOKEN) ? undefined : value

/**
 * The one rung of the fallback chain this avatar draws.
 *
 * Returns `undefined` for the last rung — an empty disc — rather than an empty
 * span, so a chain that resolved to nothing is one element rather than two.
 */
const renderBody = ({
  src,
  alt,
  initials,
  label,
  shape,
}: {
  readonly src: string | undefined
  readonly alt: string | undefined
  readonly initials: string | undefined
  readonly label: string | undefined
  readonly shape: AvatarShape
}): ReactElement | undefined => {
  if (src !== undefined) {
    return (
      <img
        data-avatar-image=""
        src={src}
        // `alt` defaults to the NAME rather than to the empty string: an avatar
        // with no alternative text is a hole in the page for a reader who
        // cannot see it. An author who wants a decorative avatar says so by
        // declaring `alt: ''`, which is why `?? label` and not `|| label`.
        alt={alt ?? label ?? ''}
        className={computeAvatarImageClasses({ shape })}
      />
    )
  }
  const letters = initials ?? (label === undefined ? undefined : deriveInitials(label))
  return letters === undefined || letters === '' ? undefined : (
    <span data-avatar-initials="">{letters}</span>
  )
}

/** The presence dot, drawn only when a presence was declared. */
const renderStatus = (status: AvatarStatus | undefined): ReactElement | undefined =>
  status === undefined ? undefined : (
    <span
      data-avatar-status={status}
      className={computeAvatarStatusClasses({ status })}
    />
  )

/** One member of a stack: the same disc, pulled back over the one before it. */
const renderMember = ({
  member,
  index,
  size,
  shape,
}: {
  readonly member: AvatarMember
  readonly index: number
  readonly size: AvatarSize
  readonly shape: AvatarShape
}): ReactElement => (
  <span
    key={index}
    data-avatar-item=""
    role="img"
    aria-label={member.label ?? ''}
    className={computeAvatarMemberClasses({ size, shape, stacked: index !== 0 })}
  >
    {renderBody({
      src: member.src,
      alt: undefined,
      initials: member.initials,
      label: member.label,
      shape,
    })}
    {renderStatus(statusOf(member))}
  </span>
)

/**
 * The `+N` disc, counting the members a `max` HID rather than the total.
 *
 * A stack of six capped at three reads `A G T +3`, which is the arithmetic a
 * reader does anyway; `+6` beside three visible faces is a number they would
 * have to correct in their head.
 */
const renderOverflow = (hidden: number, size: AvatarSize): ReactElement | undefined =>
  hidden <= 0 ? undefined : (
    <span
      data-avatar-overflow=""
      className={computeAvatarOverflowClasses({ size })}
    >
      {`+${String(hidden)}`}
    </span>
  )

/**
 * `avatar` — one disc, or a stack of them.
 *
 * Declaring `items` makes it a group, and the single-avatar keys then go
 * UNREAD rather than refused: nothing the author wrote is lost, one avatar's
 * props are simply not what a group draws. `label` is the exception — on a
 * group it names the stack, because four discs are one thing to a reader and
 * four to the DOM.
 */
export const avatarComponent: ComponentRenderer = ({ elementPropsWithSpacing, component }) => {
  const source = (component ?? {}) as unknown as Readonly<Record<string, unknown>>
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  const size = sizeOf(source)
  const shape = shapeOf(source)
  const label = text(source, 'label')
  const items = Array.isArray(source['items'])
    ? (source['items'] as readonly AvatarMember[])
    : undefined

  if (items === undefined) {
    // A session-bound avatar renders its ABSENCE branch on the server and is
    // completed client-side from the caller's own session. The identity is
    // never in the served bytes, so a cached page cannot leak one caller's face
    // to the next.
    const sessionBinding = sessionBindingOf(source, shape)
    return (
      <span
        {...rest}
        role="img"
        aria-label={unboundValue(label) ?? unboundValue(text(source, 'alt')) ?? ''}
        data-session-avatar={sessionBinding}
        className={mergePrestyle(
          computeAvatarBoxClasses({ size, shape }),
          authorClassName as string | undefined
        )}
      >
        {renderBody({
          src: unboundValue(text(source, 'src')),
          alt: unboundValue(text(source, 'alt')),
          initials: unboundValue(text(source, 'initials')),
          label: unboundValue(label),
          shape,
        })}
        {renderStatus(statusOf(source))}
      </span>
    )
  }

  const max = typeof source['max'] === 'number' ? source['max'] : undefined
  const visible = max === undefined ? items : items.slice(0, max)
  return (
    <span
      {...rest}
      role="group"
      aria-label={label ?? ''}
      className={mergePrestyle(computeAvatarGroupClasses(), authorClassName as string | undefined)}
    >
      {visible.map((member, index) => renderMember({ member, index, size, shape }))}
      {renderOverflow(items.length - visible.length, size)}
    </span>
  )
}
