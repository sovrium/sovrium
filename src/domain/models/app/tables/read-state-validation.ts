/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readStateCountsOf } from './read-state-service'
import type { App } from '@/domain/models/app'

/**
 * Two relationships with `readState` pointing at one parent name their counts
 * apart: each count is a key of the parent's row, so two under one name would
 * silently answer one of them. `readState: { as }` gives the second its name.
 */
export const validateReadStateCountNames = (app: Pick<App, 'tables'>): true | string => {
  const clash = (app.tables ?? [])
    .map((parent) => ({ parent: parent.name, counts: readStateCountsOf(app, parent.name) }))
    .flatMap(({ parent, counts }) =>
      counts
        .filter((count, index) => counts.findIndex((other) => other.name === count.name) !== index)
        .map((count) => ({ parent, count }))
    )
    .at(0)
  if (clash === undefined) return true
  return `Two relationships with readState on table '${clash.parent}' share the count name '${clash.count.name}'; give one of them its own with readState: { as: <name> } (the second is ${clash.count.childTable}.${clash.count.linkField})`
}
