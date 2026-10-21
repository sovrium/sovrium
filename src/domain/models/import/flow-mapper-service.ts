/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE flow mapper: `CanonicalFlow`s in, `automations[]` entries — with the
 * `connections[]` and `env[]` entries they need — and the report's
 * `automations` section out, through the source's step registry
 * (`flow-step-mappings.ts`).
 *
 * ## Contract for a source adapter
 *
 * An automation source only parses its export into `CanonicalFlow`s; it never
 * builds a Sovrium action. {@link mapCanonicalFlow} then maps one flow, and
 * {@link planAutomations} maps a whole export and merges what the flows share.
 * What the adapter states, and how the mapper reads it:
 *
 * - **Steps** carry the source's own terms. An app step's `(tool, app,
 *   operation)` is looked up in the tool's registry (`flow-step-mappings.ts`);
 *   control flow is typed (`branch`, `filter`, `loop`, `delay`), as are `http`
 *   and `code`. Anything else is `unknown`, quoting its definition.
 * - **Edges** leave a branch labelled with the branch name (an unlabelled one
 *   leaves by the first branch) and a loop labelled `done` or `body`. Paths
 *   that meet again resume after the branch.
 * - **Branches** run in the step's `mode`, or the tool's default
 *   (`BRANCH_MODE_DEFAULTS`). A branch with no `condition` is the fallback: it
 *   runs only when no other branch matched. A branch that always runs (a Make
 *   route with no filter) states a condition with no rules.
 * - **Expressions** are tokenised by the tool's tokenizer
 *   (`tokeniseN8nValue`, `tokeniseMakeValue`, `tokeniseZapierValue`); a
 *   reference to the trigger has `root: 'trigger'`, one to a step names the
 *   step's `id`. Functions are mapped through the tool's registry
 *   (`flow-expression-mappings.ts`), and so are comparison operators.
 *
 * What the mapper guarantees:
 *
 * - **Every automation is written `enabled: false`**, TODO or not. The report
 *   tells a clean one (0 TODO) from one to finish.
 * - The registries are the whole rule: a step, trigger, function or operator
 *   they do not hold is a TODO quoting the source, never a guess.
 * - An app step lands on a connection shared across the whole import, one per
 *   app per source credential (`flow-connection-service.ts`): the library's,
 *   the observed-apps catalogue's, or a skeleton named after the app. Its env
 *   is declared by NAME only (`required: false`); a value is never written.
 * - Action names are derived from the source labels, deterministically:
 *   `^[a-zA-Z][a-zA-Z0-9_]*$`, unique within the automation, never a template
 *   root (`trigger`, `loop`, `loops`), and every expression reading a step is
 *   rewritten to the name that step received.
 */

import { catalogueEntryOf } from './flow-app-catalogue-service'
import { emitBlock, type ActionNote } from './flow-block-service'
import {
  connectionLine,
  nameConnections,
  planConnections,
  type ExistingConnection,
  type PlannedConnection,
} from './flow-connection-service'
import { noOp } from './flow-control-service'
import { structureFlow, type FlowBlock } from './flow-graph-service'
import { pollingOf } from './flow-poll-service'
import { fieldPathsByStep } from './flow-set-fields-service'
import { isAutomationSourceTool, type AutomationSourceTool } from './flow-step-mappings'
import { droppedReason, type ConnectionCall, type LibraryConnection } from './flow-step-service'
import { mapTrigger, type TriggerOutcome, type TriggerTargets } from './flow-trigger-service'
import {
  fitName,
  MAX_AUTOMATION_NAME_LENGTH,
  prefixedName,
  toKebabName,
  toSnakeName,
  uniqueNames,
} from './import-names-service'
import type { CanonicalFlow, CanonicalStep } from './canonical-flow'
import type { ImportReport } from './import-report'
import type { ConfigEntry } from './table-mapper-service'

export { codeStub, type LibraryConnection } from './flow-step-service'
export type { ExistingConnection, PlannedConnection } from './flow-connection-service'

type AutomationsSection = NonNullable<ImportReport['automations']>
type Todo = ImportReport['todo'][number]
type Unmapped = ImportReport['unmapped'][number]

/** A flow of a tool whose registries exist. */
export type AutomationFlow = CanonicalFlow & { readonly tool: AutomationSourceTool }

/** Whether a flow comes from an automation source, so the mapper can read it. */
export const isAutomationFlow = (flow: CanonicalFlow): flow is AutomationFlow =>
  isAutomationSourceTool(flow.tool)

/** What the mapper reads besides the flows. */
export interface FlowMappingContext extends TriggerTargets {
  /** `--prefix`, applied to every automation name. */
  readonly prefix?: string
  /** A library connection by slug, or `undefined` when the library has none. */
  readonly connection: (slug: string) => LibraryConnection | undefined
  /** A connection the config already holds, by name. */
  readonly existing?: (name: string) => ExistingConnection | undefined
  /** The name each connection need received; absent, its slug. */
  readonly connectionName?: (need: ConnectionCall) => string
}

/** One flow, mapped. */
export interface MappedFlow {
  /** The `automations[]` entry, always `enabled: false`. */
  readonly automation: ConfigEntry
  /** The connections its trigger and actions need, in order of first appearance. */
  readonly calls: readonly ConnectionCall[]
  /** The env NAMES its credential URLs are read from. */
  readonly env: readonly string[]
  /** What someone has to finish, each quoting the original. */
  readonly todo: readonly Todo[]
  /** What was carried over with a loss, or dropped, and why. */
  readonly unmapped: readonly Unmapped[]
  /** The report line for this automation. */
  readonly created: AutomationsSection['created'][number]
}

/** The mapper's result for a whole export. */
export interface FlowPlan {
  readonly automations: readonly ConfigEntry[]
  /** Every connection the automations use, new or reused, sorted by name. */
  readonly connections: readonly PlannedConnection[]
  readonly env: readonly ConfigEntry[]
  readonly section: AutomationsSection
  readonly todo: readonly Todo[]
  readonly unmapped: readonly Unmapped[]
}

/** The no-op an automation whose source has no step gets, so it validates. */
const EMPTY_ACTION = 'nothing_yet'

const NO_STEP =
  'The source automation has no step that does anything after its trigger; a no-op stands in until its steps are added.'

/** Names a step may not take: the template roots `trigger`, `loop` and `loops`. */
const RESERVED_ACTION_NAMES: ReadonlySet<string> = new Set(['trigger', 'loop', 'loops'])

const todoAt = (target: string, original: string, reason: string): Todo => ({
  domain: 'automations',
  target,
  original,
  reason,
})

/** Why a trigger is a TODO: a form not migrated with the flow, or a trigger with no mapping. */
const triggerTodoReason = (flow: AutomationFlow, mapped: TriggerOutcome): string => {
  const { trigger } = flow
  if (mapped.reason !== undefined) return mapped.reason
  if ('todo' in trigger && trigger.todo !== undefined) return trigger.todo
  if (trigger.kind === 'form' && trigger.fallback === 'webhook') {
    return `The form ${trigger.form} was not imported with this automation, so it starts from a webhook: point the form's own webhook at it, or name the Sovrium form in its trigger.`
  }
  if (trigger.kind === 'form') {
    return `The form ${trigger.form} was not imported with this automation, so it starts by hand until its trigger names the Sovrium form.`
  }
  if (trigger.kind === 'record') {
    return `The table ${trigger.table === '' ? 'it watches is not named in the export and' : trigger.table} was not imported with this automation, so it starts by hand until its trigger names the Sovrium table.`
  }
  if (trigger.kind === 'schedule') {
    return 'The schedule is not stated in a form cron says exactly; the automation starts by hand until its cron expression is written.'
  }
  return 'The trigger does not map; the automation starts by hand until it is rebuilt.'
}

/** Every step that becomes an action, depth first, in the order its action is written. */
const actionSteps = (block: FlowBlock, tool: AutomationSourceTool): readonly CanonicalStep[] =>
  block.flatMap((item) => {
    if (item.kind === 'branch') {
      return [item.step, ...item.paths.flatMap((path) => actionSteps(path.block, tool))]
    }
    if (item.kind === 'loop') return [item.step, ...actionSteps(item.body, tool)]
    return droppedReason(item.step, tool) === undefined ? [item.step] : []
  })

/** Each step's action name: its label in snake case, unique within the automation. */
const actionNames = (
  steps: readonly CanonicalStep[],
  reserved: readonly string[]
): ReadonlyMap<string, string> => {
  const names = uniqueNames(
    steps.map((step) => toSnakeName(step.name, 'step')),
    'snake',
    new Set([...RESERVED_ACTION_NAMES, ...reserved])
  )
  return new Map(steps.map((step, index) => [step.id, names[index] ?? 'step'] as const))
}

/**
 * Where the flow's trigger references read from. Make names a webhook's
 * payload fields directly (`{{1.email}}`), and so does Retool
 * (`startTrigger.data.email`), while the Sovrium webhook trigger holds the
 * payload under `body`, so those references read `trigger.data.body`. n8n's
 * webhook references already name `body`.
 */
const PAYLOAD_TOOLS: ReadonlySet<AutomationSourceTool> = new Set(['make', 'retool-workflows'])

const triggerRootOf = (
  tool: AutomationSourceTool,
  trigger: Readonly<Record<string, unknown>>
): string | undefined =>
  PAYLOAD_TOOLS.has(tool) && trigger['type'] === 'webhook' ? 'trigger.data.body' : undefined

/**
 * The connection a trigger's webhook is registered with: the library's, else
 * the catalogue's, else none (the TODO still says how to point the vendor at it).
 */
const registrationOf = (
  trigger: TriggerOutcome,
  context: FlowMappingContext
): ConnectionCall | undefined => {
  const { registration } = trigger
  if (registration === undefined) return undefined
  const library = context.connection(registration.slug)
  if (library !== undefined) {
    // A library connection not declaring the operation yet is installed without it.
    const { operation, ...installed } = registration
    return operation in library.operations
      ? { origin: 'library', ...registration }
      : { origin: 'library', ...installed }
  }
  return catalogueEntryOf(registration.slug) === undefined
    ? undefined
    : { origin: 'catalogue', ...registration }
}

/**
 * Map one flow onto one disabled `automations[]` entry named `name`.
 *
 * Pure and deterministic: the same flow and context always give the same
 * entry, byte for byte.
 */
export const mapCanonicalFlow = (
  flow: AutomationFlow,
  name: string,
  context: FlowMappingContext
): MappedFlow => {
  const block = structureFlow(flow)
  const trigger = mapTrigger(flow, context)
  const polling = pollingOf(
    trigger.poll,
    { ...context, tool: flow.tool, rendering: { actionOf: new Map(), tool: flow.tool } },
    triggerRootOf(flow.tool, trigger.trigger)
  )
  const { triggerRoot } = polling
  const steps = actionSteps(block, flow.tool)
  const emitted = emitBlock(block, {
    tool: flow.tool,
    names: actionNames(steps, polling.reserved),
    fieldPaths: fieldPathsByStep(steps, flow.tool),
    connection: context.connection,
    ...(context.connectionName === undefined ? {} : { connectionName: context.connectionName }),
    loops: [],
    top: polling.top,
    automation: name,
    ...(triggerRoot === undefined ? {} : { triggerRoot }),
  })
  const target = (note: ActionNote) => `automations.${name}.actions.${note.action}`
  const registration = registrationOf(trigger, context)
  const empty = emitted.actions.length === 0
  const polled = polling.wrap(empty ? [noOp(EMPTY_ACTION)] : emitted.actions)
  const todo: readonly Todo[] = [
    ...(trigger.todo === undefined
      ? []
      : [todoAt(`automations.${name}.trigger`, trigger.todo, triggerTodoReason(flow, trigger))]),
    ...[...polled.todo, ...emitted.todo].map((note) =>
      todoAt(target(note), note.original, note.reason)
    ),
    ...(empty ? [todoAt(`automations.${name}.actions.${EMPTY_ACTION}`, flow.name, NO_STEP)] : []),
  ]
  return {
    automation: {
      name,
      enabled: false,
      trigger: trigger.trigger,
      actions: polled.actions,
    },
    todo,
    unmapped: [
      ...emitted.unmapped.map((note) => ({
        domain: 'automations' as const,
        source: `${flow.name} › ${note.original}`,
        kind: 'step' as const,
        reason: note.reason,
      })),
      ...emitted.secrets.map((secret) => ({
        domain: 'automations' as const,
        source: `${flow.name} › ${secret.action}`,
        kind: 'step' as const,
        reason: `The address on ${secret.host} is a credential: anyone holding it can call it, so it is never written to the config. Set ${secret.env} to it before switching the automation on.`,
        fallback: `$env.${secret.env}`,
      })),
    ],
    calls: [
      ...(registration === undefined ? [] : [registration]),
      ...polled.calls,
      ...emitted.calls,
    ],
    env: emitted.secrets.map((secret) => secret.env),
    created: {
      name,
      source: flow.name,
      enabled: false,
      sourceActive: flow.active,
      todos: todo.length,
    },
  }
}

/** A flow's automation name before it is fitted: kebab case, `--prefix` applied. */
const fullNameOf = (flow: AutomationFlow, prefix: string | undefined): string =>
  prefixedName(prefix, toKebabName(flow.name, 'automation'), 'kebab')

/**
 * Each flow's automation name, cut to the length an automation name holds and
 * unique. A cut name keeps its start and ends with a hash of the whole name,
 * so it is the same on every run.
 */
const automationNames = (
  flows: readonly AutomationFlow[],
  prefix: string | undefined
): readonly string[] =>
  uniqueNames(
    flows.map((flow) => fitName(fullNameOf(flow, prefix), 'kebab', MAX_AUTOMATION_NAME_LENGTH)),
    'kebab'
  ).map((name) => fitName(name, 'kebab', MAX_AUTOMATION_NAME_LENGTH))

/** The report line of a flow whose name was cut to fit: its full title. */
const cutNote = (flow: AutomationFlow, prefix: string | undefined, name: string) =>
  fullNameOf(flow, prefix).length > MAX_AUTOMATION_NAME_LENGTH
    ? [
        {
          domain: 'automations' as const,
          source: flow.name,
          kind: 'other' as const,
          reason: `An automation name holds at most ${String(MAX_AUTOMATION_NAME_LENGTH)} characters, so this one is cut and ends with a hash of the full title, shown here.`,
          fallback: name,
        },
      ]
    : []

/** Map flows onto disabled `automations[]` entries. Names are the flow names in kebab case, `--prefix` applied. */
export const planAutomations = (
  flows: readonly AutomationFlow[],
  context: FlowMappingContext
): FlowPlan => {
  const names = automationNames(flows, context.prefix)
  const mapAll = (given: FlowMappingContext) =>
    flows.map((flow, index) => mapCanonicalFlow(flow, names[index] ?? 'automation', given))
  // Mapped twice: once to learn which connections the steps need, in order of
  // first appearance, then again with each one's name.
  const needs = mapAll(context).flatMap((one) => one.calls)
  const { naming } = nameConnections(needs, context)
  const mapped = mapAll({ ...context, connectionName: naming })
  const connections = planConnections(
    mapped.flatMap((one) => one.calls),
    context
  )
  const library = new Set(connections.flatMap((one) => one.env))
  const urls = new Set(mapped.flatMap((one) => one.env).filter((key) => !library.has(key)))
  const env = [...library, ...urls].toSorted()
  return {
    automations: mapped.map((one) => one.automation),
    connections,
    env: env.map((key) => ({
      key,
      required: false,
      description: urls.has(key)
        ? 'The address an imported HTTP step calls, kept out of the config because it is a credential; set it before switching the automation on.'
        : `Read by an imported connection; set it before switching the automations on.`,
    })),
    section: {
      created: mapped.map((one) => one.created),
      connections: connections.map(connectionLine),
      env,
      neverImportable: [],
    },
    todo: mapped.flatMap((one) => one.todo),
    unmapped: [
      ...flows.flatMap((flow, index) => cutNote(flow, context.prefix, names[index] ?? '')),
      ...mapped.flatMap((one) => one.unmapped),
    ],
  }
}
