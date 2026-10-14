/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Container types whose `children` are restricted — by type, by count, or both.
 *
 * ## Why this is a validator pass and not a schema rule
 *
 * `children` is injected into a container branch by `buildComponentUnion`, per
 * consumer, and the branch has no refinement hook (see `component-xor-rules.ts`
 * for the longer account). A rule about WHICH components a container may hold
 * therefore cannot be written beside the type's fields; it runs here, at the one
 * decode boundary every seam rides (`decodeAppConfigObject` →
 * `runSemanticChecks`), so boot, `sovrium validate` and a watch reload reach the
 * same verdict.
 *
 * ## Why refused rather than tolerated
 *
 * Each restriction exists because the extra child would be drawn wrongly with
 * nothing on the page saying why: a second child of a fixed-ratio frame spills
 * out of a box sized by its ratio, a paragraph inside it has no shape to keep,
 * and a conversation frame filled with something other than turns is not a
 * conversation. Each message names the container, what it holds, and what to
 * do instead.
 *
 * Walks the RAW config, so a `$ref` partial that has already been inlined is
 * checked like any other node. Pure: no I/O.
 */

interface ChildrenRule {
  /** The container type the rule governs. */
  readonly type: string
  /** The child types it accepts. */
  readonly accepts: readonly string[]
  /** The most children it may hold, when capped. */
  readonly max?: number
  /** What the container is, for the sentence: "a fixed-ratio frame". */
  readonly what: string
}

const CHILDREN_RULES: readonly ChildrenRule[] = [
  {
    type: 'aspect-ratio',
    accepts: ['image', 'video', 'iframe', 'map', 'qr-code'],
    max: 1,
    what: 'a frame that holds one medium at a fixed ratio',
  },
  {
    type: 'message-scroller',
    accepts: ['message', 'marker'],
    what: "a conversation's scroll frame, which holds its turns and its inline notes",
  },
]

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const listed = (types: readonly string[]): string => types.map((t) => `\`${t}\``).join(', ')

/** `a` or `an`, by the type name's first letter. */
const article = (type: string): string => (/^[aeiou]/.test(type) ? 'an' : 'a')

/** The child types of one node, strings (text children) reported as `text`. */
const childTypesOf = (children: readonly unknown[]): readonly string[] =>
  children.map((child) =>
    isRecord(child) && typeof child['type'] === 'string' ? child['type'] : 'text'
  )

/** Every rule this node breaks, as finished messages. */
const brokenRulesAt = (node: RawRecord, path: string): readonly string[] =>
  CHILDREN_RULES.filter((rule) => node['type'] === rule.type).flatMap((rule) => {
    const { children } = node
    if (!Array.isArray(children)) return []
    const types = childTypesOf(children)
    const tooMany =
      rule.max !== undefined && types.length > rule.max
        ? [
            `${path}: ${article(rule.type)} \`${rule.type}\` holds ${String(types.length)} children, and it is ${rule.what}: it holds ${rule.max === 1 ? 'one child' : `at most ${String(rule.max)} children`}. Move the others out beside it.`,
          ]
        : []
    const refused = [...new Set(types.filter((type) => !rule.accepts.includes(type)))].map(
      (type) =>
        `${path}: ${article(rule.type)} \`${rule.type}\` holds ${article(type)} \`${type}\`, and it is ${rule.what}: it holds only ${listed(rule.accepts)}. Place the \`${type}\` outside it.`
    )
    return [...tooMany, ...refused]
  })

/** Walk every node depth-first, collecting rule breaks with their location. */
const walk = (value: unknown, path: string): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap((item, index) => walk(item, `${path}[${index}]`))
  if (!isRecord(value)) return []
  const here = path === '' ? 'config' : path
  return [
    ...brokenRulesAt(value, here),
    ...Object.entries(value).flatMap(([key, child]) =>
      walk(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/**
 * Every restricted container whose children break its rule.
 *
 * @param config - The parsed config object, before or after decoding.
 * @returns One message per broken rule; empty when every container holds what it may.
 */
export const validateComponentChildren = (config: unknown): readonly string[] => walk(config, '')

/** The rules, for the test that keeps each one's types real. */
export const COMPONENT_CHILDREN_RULES = CHILDREN_RULES
