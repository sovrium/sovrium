/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Family 12 of the page decode rules: shared-filter channels.
 *
 * Split out of `page-binding-validation.ts` only so that file stays under its
 * per-file `max-lines` cap — the same reason the Data-surface resolver was once
 * extracted from the dashboard builder. It is called from
 * `collectPageBindingViolations` and from nowhere else, and shares that
 * function's contract exactly: pure, no I/O, human-readable messages, empty
 * when the page is well-formed.
 *
 * @see ./page-binding-validation.ts — the caller, and the other twelve families
 */

/** One control's contribution to a shared-filter channel. */
interface PublishedParam {
  readonly channel: string
  readonly param: string
}

/**
 * A shared-filter channel is one string joining publishers to subscribers, and
 * both ends can be wrong in silence.
 *
 * TWO PUBLISHERS, ONE PARAM. Several controls legitimately share a channel —
 * that is the whole point, and how a runs directory drives one grid from an
 * automation picker and a status picker. Contributing the same `param` twice is
 * different: each emit overwrites the other's key, and which one survives is
 * whichever the operator touched last. There is no defensible precedence, the
 * same reason a breadcrumb may not carry items and `derive` together.
 *
 * A SUBSCRIBER CONSUMING A KEY NOBODY PUBLISHES. `sharedFilter.params` selects a
 * SUBSET of the channel's bag; naming a key outside it merges nothing, forever.
 *
 * Scoped so it cannot become a false refusal, which is the hazard for any rule
 * about a NAME resolving. It fires only when the channel is claimed on THIS page
 * by at least one `publishes` declaration: a `bindTo` naming a `search-input` (a
 * scalar publisher, whose params the SUBSCRIBER names) is not a channel in this
 * sense and is skipped, and so is a channel whose publisher lives outside the
 * page. A `bindTo` without `sharedFilter` is the legacy search binding and is
 * never read here at all.
 */
export function sharedFilterChannelViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  const declarations: readonly PublishedParam[] = nodes
    .map((node) => node['publishes'])
    .filter(isRecord)
    .flatMap((publishes) => {
      const { bindTo, param } = publishes
      return typeof bindTo === 'string' && typeof param === 'string'
        ? [{ channel: bindTo, param }]
        : []
    })

  const published: ReadonlyMap<string, readonly string[]> = new Map(
    [...new Set(declarations.map((one) => one.channel))].map((channel) => [
      channel,
      declarations.filter((one) => one.channel === channel).map((one) => one.param),
    ])
  )

  const duplicates = [...published].flatMap(([channel, params]) =>
    [...new Set(params)]
      .filter((param) => params.filter((candidate) => candidate === param).length > 1)
      .map(
        (param) =>
          `${label} declares two shared-filter publishers contributing "${param}" to channel "${channel}" — each emit would overwrite the other, with no defensible precedence`
      )
  )

  return [...duplicates, ...subscriberParamViolations(nodes, published, label)]
}

/** Every `sharedFilter.params` key must be one the named channel publishes. */
function subscriberParamViolations(
  nodes: readonly Record<string, unknown>[],
  published: ReadonlyMap<string, readonly string[]>,
  label: string
): readonly string[] {
  return nodes.flatMap((node) => {
    const { sharedFilter, bindTo } = node
    if (!isRecord(sharedFilter) || typeof bindTo !== 'string') return []
    const offered = published.get(bindTo)
    const wanted = sharedFilter['params']
    if (offered === undefined || !Array.isArray(wanted)) return []
    return wanted
      .filter((param): param is string => typeof param === 'string' && !offered.includes(param))
      .map(
        (param) =>
          `${label} declares a shared-filter subscriber consuming "${param}" from channel "${bindTo}", which publishes only ${offered.map((name) => `"${name}"`).join(', ')} — that key would never be merged`
      )
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
