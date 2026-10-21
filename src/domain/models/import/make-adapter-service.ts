/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Make adapter: scenario blueprints as `CanonicalFlow`s.
 *
 * It reads the three shapes a blueprint reaches the import in:
 *
 * - the file the editor's "Export blueprint" writes: the bare blueprint
 *   `{ name, flow, metadata }`, which holds no schedule;
 * - the API's `GET /scenarios/{id}/blueprint` answer, an envelope
 *   `{ code, response: { blueprint, scheduling, … } }`;
 * - a snapshot written by `sovrium import fetch make:…`: one such envelope per
 *   scenario under `raw/blueprints/<scenarioId>.json`, beside the scenario
 *   list pages, which say whether each scenario was switched on.
 *
 * The trigger is the first module when it is one (a webhook, or a module whose
 * action starts with `watch` or `trigger`); otherwise the scenario runs on its
 * schedule, and `scheduling` is read: an interval in seconds, or a daily time.
 * A schedule Make states any other way, or a blueprint file that holds none,
 * is kept verbatim for the mapper to report. Modules become steps through
 * `make-module-service.ts`.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { lookupTrigger } from './flow-step-mappings'
import { chainOf } from './make-module-service'
import { modulesOf, rawOf, splitModule, type MakeModule, type Piece } from './make-piece-service'
import type { CanonicalFlow } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>
type Trigger = CanonicalFlow['trigger']

/** A blueprint and what the API said about it besides. */
interface Blueprint {
  readonly blueprint: Json
  readonly scheduling: Json | undefined
}

/** The blueprint a document holds: bare, or inside the API envelope. */
const blueprintOf = (document: unknown): Blueprint | undefined => {
  if (!isRecord(document)) return undefined
  const response = isRecord(document['response']) ? document['response'] : undefined
  const held = response === undefined ? document : response['blueprint']
  if (!isRecord(held) || !Array.isArray(held['flow'])) return undefined
  const scheduling = response?.['scheduling'] ?? held['scheduling']
  return { blueprint: held, scheduling: isRecord(scheduling) ? scheduling : undefined }
}

/** Whether a parsed JSON document is a Make blueprint, bare or in the API envelope. */
export const isMakeBlueprint = (document: unknown): boolean => {
  const read = blueprintOf(document)
  if (read === undefined) return false
  const flow = read.blueprint['flow'] as readonly unknown[]
  return (
    flow.length > 0 &&
    modulesOf(flow).length === flow.length &&
    modulesOf(flow).every((module) => /^[\w-]+:[\w-]+$/.test(module.module))
  )
}

/** Whether the first module starts the scenario rather than running in it. */
const isTriggerModule = (module: MakeModule): boolean => {
  const { app, action } = splitModule(module.module)
  return (
    lookupTrigger('make', module.module) !== undefined ||
    app === 'gateway' ||
    /^(?:watch|trigger)/i.test(action)
  )
}

const triggerOfModule = (module: MakeModule): Trigger =>
  lookupTrigger('make', module.module)?.target === 'webhook'
    ? { kind: 'webhook' }
    : { kind: 'unknown', sourceType: module.module, raw: rawOf(module) }

/** Seconds as the interval wording the mapper reads, when it has one. */
const intervalOf = (seconds: number): string | undefined => {
  if (!Number.isInteger(seconds) || seconds <= 0) return undefined
  if (seconds % 3600 === 0) return `every ${String(seconds / 3600)} hours`
  return seconds % 60 === 0 ? `every ${String(seconds / 60)} minutes` : undefined
}

const NO_SCHEDULE: Trigger = {
  kind: 'unknown',
  sourceType: 'scheduling',
  raw: 'The blueprint file holds no schedule: Make keeps it with the scenario, not in the export.',
}

/** A schedule as the interval wording the mapper reads, when Make states it plainly. */
const wordingOf = (scheduling: Json): string | undefined => {
  const { type, interval, time, restrict } = scheduling
  if (Array.isArray(restrict) && restrict.length > 0) return undefined
  if (type === 'indefinitely') return intervalOf(Number(interval))
  return type === 'daily' && typeof time === 'string' && /^\d\d:\d\d$/.test(time)
    ? `daily at ${time}`
    : undefined
}

/** The schedule a scenario with no trigger module runs on. */
const triggerOfSchedule = (scheduling: Json | undefined): Trigger =>
  scheduling === undefined
    ? NO_SCHEDULE
    : { kind: 'schedule', interval: wordingOf(scheduling) ?? JSON.stringify(scheduling) }

/** What the scenario list said about one scenario. */
export interface MakeScenarioFacts {
  readonly sourceId?: string
  readonly active?: boolean
}

/** The blueprint's name, when it has one. */
const nameOf = (blueprint: Json): string | undefined => {
  const { name } = blueprint
  return typeof name === 'string' && name !== '' ? name : undefined
}

/** The trigger, steps and edges of a blueprint's `flow[]`. */
const graphOf = (read: Blueprint): Pick<CanonicalFlow, 'trigger' | 'steps' | 'edges'> => {
  const flow = modulesOf(read.blueprint['flow'])
  const [first] = flow
  if (first === undefined || !isTriggerModule(first)) {
    const piece = chainOf(flow, { trigger: undefined })
    return { trigger: triggerOfSchedule(read.scheduling), ...stepsOf(piece) }
  }
  const piece = chainOf(flow.slice(1), { trigger: String(first.id) })
  return { trigger: triggerOfModule(first), ...stepsOf(piece) }
}

/** A piece's steps, entered from the trigger. */
const stepsOf = (piece: Piece): Pick<CanonicalFlow, 'steps' | 'edges'> => ({
  steps: piece.steps,
  edges: [
    ...(piece.entry === undefined ? [] : [{ from: 'trigger', to: piece.entry }]),
    ...piece.edges,
  ],
})

/** One blueprint as a flow, or `undefined` when the document holds none. */
export const adaptMakeBlueprint = (
  document: unknown,
  facts: MakeScenarioFacts = {}
): CanonicalFlow | undefined => {
  const read = blueprintOf(document)
  if (read === undefined) return undefined
  const name = nameOf(read.blueprint)
  return {
    tool: 'make',
    sourceId: facts.sourceId ?? name ?? 'scenario',
    name: name ?? 'Make scenario',
    active: facts.active ?? false,
    ...graphOf(read),
  }
}

/** A file of a Make input: its snapshot path and its parsed content. */
export interface MakeDocument {
  readonly path: string
  readonly json: unknown
}

/** Each scenario's id and on/off state, from the scenario list pages. */
const scenarioFacts = (
  documents: readonly MakeDocument[]
): ReadonlyMap<string, MakeScenarioFacts> =>
  new Map(
    documents.flatMap((document) =>
      (isRecord(document.json) && Array.isArray(document.json['scenarios'])
        ? document.json['scenarios']
        : []
      ).flatMap((scenario: unknown) =>
        isRecord(scenario) && typeof scenario['id'] === 'number'
          ? [
              [
                String(scenario['id']),
                { sourceId: String(scenario['id']), active: scenario['isActive'] === true },
              ] as const,
            ]
          : []
      )
    )
  )

/** The scenario id a snapshot names a blueprint file by (`raw/blueprints/<id>.json`). */
const idOfPath = (path: string): string | undefined =>
  /(?:^|\/)blueprints\/(\d+)\.json$/.exec(path)?.[1]

/** Every blueprint of a Make input as a flow, in path order. */
export const adaptMakeExport = (documents: readonly MakeDocument[]): readonly CanonicalFlow[] => {
  const facts = scenarioFacts(documents)
  return documents
    .toSorted((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }))
    .flatMap((document) => {
      const id = idOfPath(document.path)
      const flow = adaptMakeBlueprint(
        document.json,
        id === undefined ? {} : (facts.get(id) ?? { sourceId: id })
      )
      return flow === undefined ? [] : [flow]
    })
}
