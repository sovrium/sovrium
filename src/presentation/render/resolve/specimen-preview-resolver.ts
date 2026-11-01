/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The preview specimens nested inside a drawn specimen: a preview subject (a
 * type, an option and a value) resolved to the catalogued specimen that shows
 * that value.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { catalogSpecimenWithOption } from '@/domain/models/app/design/preview-option'
import { componentFields, synthesizedComponent } from './component-rewrite'
import { nameSpecimen, declaredValueOf, reportUndrawable } from './specimen-subject-values'
import type { SpecimenSubjectMode } from './specimen-subject-resolver'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Whether this subject is waiting for a row to supply any of its three values.
 *
 * All THREE are checked rather than only `type`, for the reason
 * {@link subjectAwaitsARow} gives about its own five: a Configuration section
 * names a LITERAL type from the route and takes the option and the value from
 * the row, so a check confined to `type` would resolve at route time, drop the
 * `subject` it resolved through, and take the two row references down with it —
 * every row then drawing the plain specimen.
 */
const previewAwaitsARow = (subject: unknown): boolean =>
  isRecord(subject) &&
  PREVIEW_SUBJECT_KEYS.some((key) => {
    const declared = subject[key]
    return typeof declared === 'string' && declared.includes('$record.')
  })

/** The three values a preview subject names. All required by the schema. */
const PREVIEW_SUBJECT_KEYS = ['type', 'option', 'value'] as const

/**
 * One `preview` node, with its subject replaced by the drawing it names.
 *
 * The resolved `type` / `option` / `value` are written BACK onto the subject
 * rather than dropped, because unlike a specimen the frame still prints them:
 * `showValue` reads out `option: value` above the drawing, and a row template
 * that resolved `$record.path` at expansion time must print the path rather than
 * the reference.
 *
 * An unresolvable subject takes the same two answers a specimen's does, for the
 * same reasons — a 404 in `route` mode, where a URL segment is the only
 * authority on whether the page exists, and an in-place refusal everywhere else,
 * because blanking a forty-row Configuration section over its eleventh row loses
 * the ten that were fine.
 */
/** A preview subject with all three of its values in hand. */
interface ResolvedPreviewSubject {
  readonly type: string
  readonly option: string
  readonly value: string | number | boolean
}

/**
 * The three values a subject names, resolved.
 *
 * `undefined` — a refusal — when ANY of them is missing, because all three are
 * required by the schema and a preview short of one has nothing to draw and
 * nothing to say. That is the difference from a specimen's axes, which are
 * genuinely optional: a type has a default variant and a resting state, and no
 * option has a "default option".
 */
const previewSubjectOf = (
  subject: Readonly<Record<string, unknown>>,
  routeParams: Readonly<Record<string, string>>
): ResolvedPreviewSubject | undefined => {
  const type = declaredValueOf(subject['type'], routeParams)
  const option = declaredValueOf(subject['option'], routeParams)
  const declared = subject['value']
  const value =
    typeof declared === 'number' || typeof declared === 'boolean'
      ? declared
      : declaredValueOf(declared, routeParams)
  return type === undefined || option === undefined || value === undefined
    ? undefined
    : { type, option, value }
}

export const resolvePreview = (
  node: Record<string, unknown>,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode
): Component | 'not-found' => {
  const { subject } = node
  if (!isRecord(subject)) return synthesizedComponent(node)
  if (mode !== 'row' && previewAwaitsARow(subject)) return synthesizedComponent(node)

  const resolved = previewSubjectOf(subject, routeParams)
  const drawn =
    resolved === undefined
      ? undefined
      : catalogSpecimenWithOption(resolved.type, resolved.option, resolved.value)

  if (resolved === undefined || drawn === undefined) {
    return mode === 'route' ? 'not-found' : reportUndrawable(node, resolved?.type)
  }
  return synthesizedComponent({
    ...node,
    subject: { ...subject, ...resolved },
    component: nameSpecimen(drawn, resolved.type),
  })
}

/**
 * Does this subtree carry a `preview`, which needs a resolution pass of its own?
 *
 * Asked before doing anything, so the extra walk below costs nothing for the 85
 * catalogue specimens that are not previews — which is every one of them but the
 * `preview` row itself.
 */
export const containsPreview = (node: unknown): boolean =>
  Array.isArray(node)
    ? node.some((entry) => containsPreview(entry))
    : isRecord(node) &&
      (node['type'] === 'preview' || Object.values(node).some((entry) => containsPreview(entry)))

/**
 * Resolve every `preview` inside a component the CATALOGUE just supplied.
 *
 * A drawn specimen is inserted after {@link resolveNode} has already walked the
 * node, so nothing else would ever visit it — and the catalogue's own `preview`
 * specimen is a preview, which would then render an empty stage on the one page
 * that documents the type. Bounded by `depth` rather than by trust: a preview
 * whose subject is itself `preview` is expressible, and a stack overflow is a
 * worse answer than a frame that stops recursing.
 *
 * `not-found` never propagates from here — a catalogue drawing is not a URL, so
 * an undrawable nested preview reports itself in place exactly as one row of an
 * index does.
 */
export const withResolvedPreviews = (
  node: object,
  routeParams: Readonly<Record<string, string>>,
  mode: SpecimenSubjectMode,
  depth: number
): Component => {
  const fields = componentFields(node)
  const children = Array.isArray(fields['children'])
    ? fields['children'].map((child: unknown) =>
        depth >= 2 || !isRecord(child)
          ? child
          : withResolvedPreviews(child, routeParams, mode, depth + 1)
      )
    : undefined
  const walked: Record<string, unknown> = {
    ...fields,
    ...(children === undefined ? {} : { children }),
  }
  if (walked['type'] !== 'preview') return synthesizedComponent(walked)
  const resolved = resolvePreview(walked, routeParams, mode === 'route' ? 'row' : mode)
  return resolved === 'not-found' ? reportUndrawable(walked, undefined) : resolved
}
