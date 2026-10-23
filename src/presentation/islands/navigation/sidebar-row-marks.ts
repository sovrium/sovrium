/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fillRowTemplate, type ProjectedEntry } from './sidebar-entry-projection'

/*
 * The icon and badge a fetched group's rows carry (`source.icon`, `source.badge`),
 * filled from each row. Apart from the projection every fetched level shares, so
 * only a group that draws them loads this.
 */

/** A kebab-case Lucide icon name (`code`, `message-circle`). A STATIC literal. */
const LUCIDE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** An emoji, or one of the two halves of a flag. A STATIC literal. */
const PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

/**
 * The icon a row's value names: one emoji grapheme, drawn as text, or a Lucide
 * name, drawn from the icon's geometry. Anything else draws no icon — a row
 * value no config check could see is judged here, per row.
 */
function iconOf(value: string | undefined): ProjectedEntry['icon'] {
  if (value === undefined || value === '') return undefined
  if (LUCIDE_NAME.test(value)) return { lucide: value }
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
  return graphemes.length === 1 && PICTOGRAPH.test(value) ? { emoji: value } : undefined
}

/** The badge a row fills, or `undefined` when it is empty or `0`: nothing new stays quiet. */
function badgeOf(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' || Number(value) === 0 ? undefined : value
}

/** The icon and badge of one row, each only when the projection asks and the row fills it. */
export function rowMarks(
  projection: { readonly icon?: string; readonly badge?: string },
  flat: Readonly<Record<string, unknown>>
): Pick<ProjectedEntry, 'icon' | 'badge'> {
  const icon =
    projection.icon === undefined
      ? undefined
      : iconOf(fillRowTemplate(projection.icon, flat, false))
  const badge =
    projection.badge === undefined
      ? undefined
      : badgeOf(fillRowTemplate(projection.badge, flat, false))
  return { ...(icon === undefined ? {} : { icon }), ...(badge === undefined ? {} : { badge }) }
}
