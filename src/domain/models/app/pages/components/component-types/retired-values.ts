/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The option VALUES a component type stopped accepting — when its vocabulary
 * took shadcn/ui's names, or when the page composed its controls on a
 * shared-filter channel — each with the sentence that names the replacement.
 *
 * A retired value is not an unknown key: the decoder refuses it as a literal
 * mismatch and lists what the option accepts now, which tells an author what is
 * legal but not what their old spelling became. The decode-failure reporter
 * appends this sentence to the decoder's own line, so the replacement is named
 * in the same breath as the refusal.
 */

const middleRung = (type: string): readonly [string, string] => [
  `${type}.size=md`,
  '`size: md` is now `size: default`, the name shadcn/ui gives the middle rung.',
]

/** Retired values, keyed `type.key=value`. */
const RETIRED_VALUES: ReadonlyMap<string, string> = new Map([
  middleRung('button'),
  middleRung('toggle'),
  middleRung('toggle-group'),
  middleRung('progress'),
  middleRung('avatar'),
  [
    'input.inputType=one-time-code',
    '`inputType: one-time-code` is now its own type: use `type: input-otp`.',
  ],
  ['gallery.layout=carousel', '`layout: carousel` is now its own type: use `type: carousel`.'],
  [
    'card.variant=bubble',
    '`variant: bubble` is now its own type: use `type: bubble`, with `align: start` or `align: end`.',
  ],
  [
    'search-input.scope=subscribers',
    '`scope: subscribers` has been removed: a search box no longer waits for a component to name its id. Declare `publishes: { bindTo: <channel>, param: q }` on the box instead of `scope`, and subscribe the data components with `dataSource.bindTo: <channel>` and `sharedFilter: {}`.',
  ],
])

/**
 * The message for a value a type no longer accepts, or `undefined`.
 *
 * @param discriminant - The node's `type` literal.
 * @param key - The option the author set.
 * @param value - The value the author wrote.
 */
export const migrationHintForRetiredValue = (
  discriminant: string | undefined,
  key: string,
  value: unknown
): string | undefined =>
  discriminant === undefined || typeof value !== 'string'
    ? undefined
    : RETIRED_VALUES.get(`${discriminant}.${key}=${value}`)

const childAt = (node: unknown, segment: string | number): unknown =>
  typeof node === 'object' && node !== null
    ? (node as Record<string | number, unknown>)[segment]
    : undefined

/**
 * The decoder's lines for a refused value, with the retirement sentence appended
 * to the first one when the value at `segments` in `document` is a retired one.
 * The lines come back unchanged otherwise. Pure.
 *
 * @param lines - The decoder's own lines for the failure.
 * @param document - The config as parsed, when the caller has it.
 * @param segments - Path of the refused value from the config root.
 */
export const appendRetiredValueHint = (
  lines: readonly string[],
  document: unknown,
  segments: readonly (string | number)[]
): readonly string[] => {
  const key = segments.at(-1)
  if (typeof key !== 'string' || lines.length === 0) return lines
  const node = segments.slice(0, -1).reduce<unknown>(childAt, document)
  const type = childAt(node, 'type')
  const hint = migrationHintForRetiredValue(
    typeof type === 'string' ? type : undefined,
    key,
    childAt(node, key)
  )
  return hint === undefined ? lines : [`${lines[0]}. ${hint}`, ...lines.slice(1)]
}

/**
 * The message for a page action written under a retired name or a removed
 * type, or `undefined`. The action union mixes `type`- and `action`-keyed
 * members, so the reporter sees either as a rejected union value rather than
 * a refused literal.
 *
 * The `filter` page action is recognised by its `targetDataSource`, which only
 * it carried: an automation's `filter` step (`operator: continue`) is a live
 * action of another union and must never be pointed elsewhere.
 *
 * @param input - The rejected value, as the author wrote it.
 */
export const migrationHintForRetiredAction = (input: unknown): string | undefined => {
  if (childAt(input, 'action') === 'openDrawer') {
    return '`action: openDrawer` is now `action: openSheet`, the name shadcn/ui gives the panel that slides in from an edge.'
  }
  if (childAt(input, 'type') === 'filter' && childAt(input, 'targetDataSource') !== undefined) {
    return '`action: { type: filter, targetDataSource }` has been removed: no page ever acted on it. Give the control that should narrow the data `publishes: { bindTo: <channel>, field, operator }` and subscribe the data component with `dataSource.bindTo: <channel>` and `sharedFilter: {}`.'
  }
  return undefined
}

/** Every retired `type.key=value`, for the test that pins each message. @internal */
export const RETIRED_VALUE_KEYS: readonly string[] = [...RETIRED_VALUES.keys()]
