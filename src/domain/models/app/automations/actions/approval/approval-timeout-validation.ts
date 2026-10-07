/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an approval's `timeout` may decide, refused at validation.
 *
 * A `timeout` is a deadline the app declares, and the engine keeps it by
 * deciding the request itself: `onTimeout: approve` resumes the run,
 * `onTimeout: reject` ends it (or continues it under `onReject: continue`).
 * Two shapes declare a deadline the engine could never keep:
 *
 *   - `onTimeout: escalate`, whose notification is not designed yet;
 *   - a `timeout` with no `onTimeout`, which names no outcome at all.
 *
 * Either would boot and leave the request open for ever, so both are refused
 * before the app starts, naming the automation and the step and saying what
 * to write instead. The schema still ACCEPTS `escalate` so this message, and
 * not a bare literal mismatch, is what the author reads; and the timeout sweep
 * keeps its branch for a request stored before this refusal existed.
 *
 * Reads every approval step in an automation's `actions`, however deeply a
 * branch nests it. Runs over the RAW config at the shared decode boundary, so
 * boot, `sovrium validate` and a watch reload reach the same verdict. Pure.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every approval-request step reachable from `value`, however deeply nested.
 *
 * A step nests steps inside its `props`: a `path` branch under
 * `props.paths[].actions`, a `loop` under `props.actions`. Only those keys are
 * followed, never the rest of a step's props — a record step's `fields` may
 * hold any object, and one that happened to read `type: approval` is data,
 * not a step.
 */
function approvalStepsOf(value: unknown): readonly RawRecord[] {
  if (Array.isArray(value)) return value.flatMap(approvalStepsOf)
  if (!isRecord(value)) return []
  const self = value['type'] === 'approval' && value['operator'] === 'request' ? [value] : []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    approvalStepsOf
  )
  return [...self, ...nested]
}

/** The refusal for one approval step, or `undefined` when its timeout decides. */
function timeoutRefusal(automation: string, step: RawRecord): string | undefined {
  const props = isRecord(step['props']) ? step['props'] : {}
  const where = `Automation '${automation}', step '${String(step['name'] ?? '(unnamed)')}'`
  if (props['onTimeout'] === 'escalate') {
    return `${where}: \`onTimeout\` must be \`approve\` or \`reject\`; \`escalate\` is not supported yet.`
  }
  if (props['timeout'] !== undefined && props['onTimeout'] === undefined) {
    return `${where}: \`timeout\` needs \`onTimeout: approve\` or \`onTimeout: reject\` — say what happens when nobody answers in time, or drop \`timeout\` to wait indefinitely.`
  }
  return undefined
}

/**
 * Refuse every approval whose timeout escalates, and every approval that
 * declares a `timeout` without saying what it decides.
 *
 * @returns one message per refused step, empty when every timeout decides
 */
export function validateApprovalTimeouts(config: unknown): readonly string[] {
  const automations = isRecord(config) ? config['automations'] : undefined
  if (!Array.isArray(automations)) return []
  return automations.filter(isRecord).flatMap((automation) => {
    const name = String(automation['name'] ?? '(unnamed)')
    return approvalStepsOf(automation['actions']).flatMap((step) => {
      const refusal = timeoutRefusal(name, step)
      return refusal === undefined ? [] : [refusal]
    })
  })
}
