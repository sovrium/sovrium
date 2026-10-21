/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` planning, for the automations and the connections they
 * share: the flows mapped against what was imported with them, and the config
 * as it will read once the library connections are installed.
 */

import { isAutomationFlow, planAutomations } from '@/domain/models/import/flow-mapper-service'
import type { PlanInput } from './import-plan'
import type { PlannedConnection } from '@/domain/models/import/flow-mapper-service'

type Json = Readonly<Record<string, unknown>>

const listOf = (parsed: unknown, key: string): readonly Json[] => {
  const items = (parsed as Json | undefined)?.[key]
  return Array.isArray(items)
    ? items.filter((item): item is Json => typeof item === 'object' && item !== null)
    : []
}

/** The flows mapped, against the tables and forms imported with them. */
export const flowPlanOf = (
  input: PlanInput,
  flows: NonNullable<PlanInput['source']['flows']>,
  imported: ReadonlyMap<string, string>,
  forms: ReadonlyMap<string, string>
) =>
  planAutomations(flows.filter(isAutomationFlow), {
    connection: input.connection,
    ...(input.existing === undefined ? {} : { existing: input.existing }),
    table: (source) => imported.get(source),
    form: (source) => forms.get(source),
    ...(input.prefix === undefined ? {} : { prefix: input.prefix }),
  })

/**
 * The config with the library connections in place: a new one appended, one
 * the config already holds given the operations the import appends to it.
 */
export const withLibrary = (root: Json, library: readonly PlannedConnection[]): Json => {
  if (library.length === 0) return root
  const named = (entry: Json) => library.find((one) => one.reused && one.name === entry['name'])
  const extended = listOf(root, 'connections').map((entry) => {
    const planned = named(entry)
    if (planned === undefined || planned.extra.length === 0) return entry
    const held = Array.isArray(entry['operations']) ? (entry['operations'] as readonly Json[]) : []
    const appended = (
      Array.isArray(planned.entry['operations']) ? (planned.entry['operations'] as Json[]) : []
    ).filter((operation) => planned.extra.includes(String(operation['name'])))
    return { ...entry, operations: [...held, ...appended] }
  })
  const added = library.filter((one) => !one.reused).map((one) => one.entry)
  return { ...root, connections: [...extended, ...added] }
}
