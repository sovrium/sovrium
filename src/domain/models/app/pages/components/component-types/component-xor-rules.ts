/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Component keys that may not be declared together, and the message that says
 * which one the author has to drop.
 *
 * ## Why this is a validator pass and not a schema rule
 *
 * `buildComponentUnion` composes every branch from a fields record and injects
 * `children` per consumer; it has no per-branch refinement hook. So a rule
 * relating an INJECTED key to a DECLARED one cannot be written in the schema at
 * all — the branch that would carry the refinement does not exist as a value
 * anywhere the rule could be attached to.
 *
 * That leaves two places: here, or nowhere. The catalogue merges made "nowhere"
 * the expensive option, because a merge that folds two components into one
 * type by a key's PRESENCE creates exactly this shape — the key selects a
 * mechanism, and the other mechanism's keys become silently inert.
 *
 * ## Why silence was not good enough
 *
 * Everywhere else in this reshape, a key belonging to the other variant is
 * INERT rather than refused: `format` on a comments thread, `maxResults` on a
 * subscriber-scoped search. That is the right default — the union of both
 * shapes is one open struct, and refusing per-variant would need the hook that
 * does not exist.
 *
 * `children` is different, and the difference is what an author BELIEVES. An
 * ignored `format` costs nothing: the count was not being drawn. Ignored
 * `children` means an author wrote components, laid them out, and will find
 * none of them on the page — the record binding renders its own rows and drops
 * the subtree. There is no visible symptom that points at the cause, and the
 * config looks correct. So this one is refused, by name, with both keys named.
 *
 * ## Scope
 *
 * A closed table, checked at the one decode boundary every seam already rides
 * (`decodeAppConfigObject` → `runSemanticChecks`), which reaches boot,
 * `sovrium validate`, the `design-system` command and the `--watch` reload.
 * It walks the raw config rather than the decoded one so a rule can name a key
 * the decoder has already discarded.
 */

/**
 * One rule about a PAIR of keys on one component type.
 *
 * Three of the four families below share this shape and differ only in what
 * they assert about the pair: that both are not declared (XOR), that their
 * lengths agree (LENGTH), that their values are ordered (ORDER). Each family's
 * own docstring says what `keys` means for it — the ORDER rules read it as
 * `[lower, upper]`, the others as an unordered pair. The membership rules carry
 * a different shape and keep their own.
 */
interface KeyPairRule {
  /** The `type` the rule applies to. */
  readonly type: string
  /** The two keys, in the order that family's message reads them. */
  readonly keys: readonly [string, string]
  /** The sentence appended after the location. */
  readonly explanation: string
}

const XOR_RULES: readonly KeyPairRule[] = [
  {
    type: 'timeline',
    keys: ['children', 'dataSource'],
    explanation:
      'A timeline draws EITHER its authored children as a rail with markers, OR the records its `dataSource` binds as a Gantt — never both. The binding wins, so the children would be dropped without a trace on the page. Remove whichever one you did not mean: drop `dataSource` to keep the authored rail, or drop `children` to keep the record binding.',
  },
  {
    type: 'container',
    keys: ['repeat', 'dataSource'],
    explanation:
      'Both name the rows this container draws, and they answer from opposite places: `repeat` iterates an array the BOUND RECORD already carries, while `dataSource` issues a READ and clones the children per row of the result. Nothing decides between them, so one would be applied and the other dropped in silence. Remove whichever you did not mean: drop `dataSource` to iterate the record you already have, or drop `repeat` to fetch rows of your own.',
  },
  {
    type: 'graph',
    keys: ['columns', 'lanes'],
    explanation:
      'A graph draws EITHER the layered columns `columns` declares, OR the lanes `lanes` declares — `layout` decides which, and the key it does not name is never read. So one of the two is dropped without a trace on a page that otherwise looks correct: an author who wrote a full three-column partition, with its kinds, headings and orderings, would find none of it drawn and no symptom pointing at the cause. Remove whichever one you did not mean: drop `lanes` and keep `layout: layered` to draw the columns, or drop `columns` and keep `layout: lanes` to draw the lanes.',
  },
  {
    type: 'table',
    keys: ['tableRows', 'dataSource'],
    explanation:
      'A table draws EITHER the rows you wrote in the config, OR the records its `dataSource` binds as a grid — never both. The binding wins, so the authored rows would be dropped without a trace on the page. Remove whichever one you did not mean: drop `dataSource` to keep the written rows, or drop `tableRows` (and `tableHeaders`, which are its labels) to keep the record binding.',
  },
]

/** Is this a plain object (and not an array)? */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every rule this node breaks, as finished messages.
 *
 * A key counts as DECLARED when it is present and not `undefined`. An explicit
 * `children: []` therefore still counts, and deliberately: an author who wrote
 * an empty array on a record-bound timeline has said something contradictory
 * and is better told than guessed at.
 */
const brokenRulesAt = (node: Readonly<Record<string, unknown>>, path: string): readonly string[] =>
  XOR_RULES.filter(
    (rule) =>
      node['type'] === rule.type &&
      node[rule.keys[0]] !== undefined &&
      node[rule.keys[1]] !== undefined
  ).map(
    (rule) =>
      `${path}: a \`${rule.type}\` declares both \`${rule.keys[0]}\` and \`${rule.keys[1]}\`, which are mutually exclusive. ${rule.explanation}`
  )

/**
 * Key pairs whose LENGTHS must match, and why a mismatch is not survivable.
 *
 * A different shape from the XOR rules above: both keys are expected, and it is
 * their arity that carries meaning. `tabs` is the only member — `panels[i]`
 * names the tab that shows `children[i]`, so an off-by-one silently puts the
 * wrong body under every tab after the mistake, and the page renders happily.
 *
 * Only checked when BOTH are present. A `tabs` whose panels each carry their
 * own `body` string needs no children at all, and one with children but no
 * panels renders no strip — both are wrong in ways the author can see.
 *
 * KNOWN LIMITATION, stated rather than designed around. Because the alignment
 * is positional, a tab set that MIXES string bodies and component bodies has to
 * give every panel a `children` slot, including the ones whose body is a
 * string. The alternatives were worse: an explicit `childIndex` per panel puts
 * the correlation back in the author's hands, and a "children may be shorter"
 * rule works only when every string-bodied panel happens to come last. If a
 * real config needs the mixed shape, that is the moment to revisit this — not
 * before.
 */
const LENGTH_RULES: readonly KeyPairRule[] = [
  {
    type: 'tabs',
    keys: ['panels', 'children'],
    explanation:
      '`panels[i]` names the tab that shows `children[i]`, so the two must be the same length. A mismatch puts the wrong body under every tab after it, and nothing on the page says so. Add the missing entry. A tab set whose panels ALL carry their own `body` string needs no `children` at all — but once any panel has a component body, every panel needs a `children` slot, because the alignment is positional.',
  },
]

/** Every length rule this node breaks, as finished messages. */
const brokenLengthRulesAt = (
  node: Readonly<Record<string, unknown>>,
  path: string
): readonly string[] =>
  LENGTH_RULES.filter((rule) => {
    const left = node[rule.keys[0]]
    const right = node[rule.keys[1]]
    return (
      node['type'] === rule.type &&
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length !== right.length
    )
  }).map((rule) => {
    const left = node[rule.keys[0]] as readonly unknown[]
    const right = node[rule.keys[1]] as readonly unknown[]
    return `${path}: a \`${rule.type}\` declares ${String(left.length)} \`${rule.keys[0]}\` and ${String(right.length)} \`${rule.keys[1]}\`. ${rule.explanation}`
  })

/**
 * Numeric key pairs whose ORDER carries meaning, and why an inversion is not
 * survivable.
 *
 * A third shape beside the XOR and the length rules: both keys are numbers
 * bounding the SAME quantity from opposite sides, and the schema can check each
 * one alone but never their relation — `Schema.check` sees one node.
 *
 * `code-editor` is the only member. `minLines: 20` with `maxLines: 3` asks for a
 * box that is at once at least twenty rows and at most three, and every reading
 * a renderer could take is a guess: clamp to the minimum and the author's
 * maximum is a lie, clamp to the maximum and the reserved height they asked for
 * never arrives. It is refused rather than resolved for the same reason the
 * `timeline` XOR is — the page renders happily either way, and no symptom points
 * at the cause.
 *
 * Equal is fine, and deliberately: a fixed-height editor is a real thing to
 * want, and `minLines: 8, maxLines: 8` is how an author says it.
 */
const ORDER_RULES: readonly KeyPairRule[] = [
  {
    type: 'code-editor',
    keys: ['minLines', 'maxLines'],
    explanation:
      'The two bound the same box from opposite sides, so a maximum below the minimum describes no box at all. Every way of resolving it discards one of the two numbers without saying so. Raise `maxLines`, lower `minLines`, or set them equal for a fixed-height editor.',
  },
]

/** Every order rule this node breaks, as finished messages. */
const brokenOrderRulesAt = (
  node: Readonly<Record<string, unknown>>,
  path: string
): readonly string[] =>
  ORDER_RULES.filter((rule) => {
    const lower = node[rule.keys[0]]
    const upper = node[rule.keys[1]]
    return (
      node['type'] === rule.type &&
      typeof lower === 'number' &&
      typeof upper === 'number' &&
      upper < lower
    )
  }).map((rule) => {
    const lower = node[rule.keys[0]] as number
    const upper = node[rule.keys[1]] as number
    return `${path}: a \`${rule.type}\` declares \`${rule.keys[0]}: ${String(lower)}\` and \`${rule.keys[1]}: ${String(upper)}\`, but the maximum may not be below the minimum. ${rule.explanation}`
  })

/**
 * Keys whose value must NAME an entry declared elsewhere on the same node, and
 * why an unknown name is refused rather than ignored.
 *
 * The fourth shape, and the one the catalogue's newest type needs. A
 * `filter-bar` declares which fields it OFFERS and, separately, which
 * conditions it OPENS with; a condition naming a field the bar does not offer
 * is published to every subscriber and then cannot be edited or explained by
 * the control that published it. The reader sees a chip narrowing their data,
 * reaches for the menu to lift it, and the field is not in the menu.
 *
 * That is the `timeline` failure mode exactly — a page that renders happily
 * while doing something other than what the config says — so it takes the same
 * answer: refused at boot, naming the offending value and the names that were
 * available.
 *
 * The check is scoped to ONE node: `conditions[]` and `fields[]` are siblings,
 * so no lookup leaves the component. A rule that had to resolve a name across
 * the config would belong in `page-binding-validation.ts`, which is built for
 * exactly that and is a different pass.
 */
const MEMBERSHIP_RULES: readonly {
  readonly type: string
  /** The array of members, and the key on each member that holds the name. */
  readonly declares: readonly [string, string]
  /** The array of references, and the key on each reference that must match. */
  readonly references: readonly [string, string]
  readonly explanation: string
}[] = [
  {
    type: 'filter-bar',
    declares: ['fields', 'name'],
    references: ['conditions', 'field'],
    explanation:
      'A condition over a field the bar does not offer is still published to every subscriber, and the reader who wants to lift it will not find it in the menu — a filter they can see and cannot reach. Add the field to `fields`, or drop the condition.',
  },
]

/** Read the string at `key` of every member of `node[arrayKey]`. */
const namesIn = (node: Readonly<Record<string, unknown>>, arrayKey: string, key: string) => {
  const array = node[arrayKey]
  if (!Array.isArray(array)) return undefined
  return array.flatMap((member) => {
    const value = isRecord(member) ? member[key] : undefined
    return typeof value === 'string' ? [value] : []
  })
}

/**
 * Every membership rule this node breaks, as finished messages.
 *
 * Both arrays must be present for the rule to fire. A `filter-bar` missing
 * `fields` is already refused by the schema, and one missing `conditions` has
 * nothing to check — reporting either here would restate a refusal the author
 * has already been given, in worse words.
 */
const brokenMembershipRulesAt = (
  node: Readonly<Record<string, unknown>>,
  path: string
): readonly string[] =>
  MEMBERSHIP_RULES.filter((rule) => node['type'] === rule.type).flatMap((rule) => {
    const declared = namesIn(node, rule.declares[0], rule.declares[1])
    const referenced = namesIn(node, rule.references[0], rule.references[1])
    if (declared === undefined || referenced === undefined) return []
    const unknown = referenced.filter((name) => !declared.includes(name))
    return unknown.map(
      (name) =>
        `${path}: a \`${rule.type}\` names \`${rule.references[0]}[].${rule.references[1]}: ${name}\`, which is not one of its \`${rule.declares[0]}\` (${declared.length === 0 ? 'none declared' : declared.join(', ')}). ${rule.explanation}`
    )
  })

/**
 * A key that a particular ARM of a sibling key cannot honour, and why the pair
 * is refused rather than left inert.
 *
 * The fifth shape, and the first whose conflict is NESTED: the XOR family above
 * relates two top-level keys, while here one side is a top-level key and the
 * other is one arm of a discriminated sibling. `dataSource` is not the problem
 * — `dataSource.table` honours everything — so a rule keyed on the pair of
 * top-level names would refuse the working configuration along with the broken
 * one.
 *
 * `kpi` is the only member. A `sparkline` names a ROW FIELD to plot and a ROW
 * FIELD to group by; a `dataSource.system` binding reads ONE SCALAR through
 * `valuePath` and returns no rows at all, so neither name refers to anything.
 * Today the config decodes, the card draws its figure, and the trend line is
 * simply absent — no error, no empty state, nothing in the log, and no way for
 * the author to tell a sparkline that is missing from one that is merely flat.
 *
 * Refused rather than widened. The alternative is publishing a series on system
 * endpoint rows so a KPI could plot one, which grows the shared system-source
 * contract — a family of a dozen endpoints — for one component's optional
 * decoration, and leaves every endpoint that did not publish a series right
 * back here.
 */
const ARM_CONFLICT_RULES: readonly {
  readonly type: string
  /** The top-level key whose presence conflicts. */
  readonly key: string
  /** The sibling key, and the arm of it that cannot honour `key`. */
  readonly arm: readonly [string, string]
  readonly explanation: string
}[] = [
  {
    type: 'kpi',
    key: 'sparkline',
    arm: ['dataSource', 'system'],
    explanation:
      'A `sparkline` plots `field` grouped by `groupBy`, and both are ROW FIELD names. A system binding reads one scalar through `valuePath` and returns no rows, so neither name refers to anything and the card would draw its figure while silently dropping the trend. Bind the KPI to a `dataSource.table` to keep the sparkline, or drop `sparkline` to keep the system binding.',
  },
]

/**
 * Every arm-conflict rule this node breaks, as finished messages.
 *
 * The arm counts as taken when it is present and not `undefined`, matching how
 * the XOR family reads a declared key — a `system: {}` an author wrote and then
 * emptied is still a system binding as far as the discriminator is concerned.
 */
const brokenArmConflictRulesAt = (
  node: Readonly<Record<string, unknown>>,
  path: string
): readonly string[] =>
  ARM_CONFLICT_RULES.filter((rule) => {
    const sibling = node[rule.arm[0]]
    return (
      node['type'] === rule.type &&
      node[rule.key] !== undefined &&
      isRecord(sibling) &&
      sibling[rule.arm[1]] !== undefined
    )
  }).map(
    (rule) =>
      `${path}: a \`${rule.type}\` declares \`${rule.key}\` alongside \`${rule.arm[0]}.${rule.arm[1]}\`, which cannot honour it. ${rule.explanation}`
  )

/**
 * Walk every node of the config, depth-first, collecting rule breaks.
 *
 * Declared below all five rule families so the file reads in the order it runs:
 * every `broken*RulesAt` it names is already in hand. A sixth family is one more
 * line here and one more section above.
 *
 * `here` is the node's own location, named once. The child path below is a
 * DIFFERENT expression — it appends the key rather than falling back to the root
 * label — so the two ternaries are not the same one repeated.
 */
const walk = (value: unknown, path: string): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap((item, index) => walk(item, `${path}[${index}]`))
  if (!isRecord(value)) return []
  const here = path === '' ? 'config' : path
  return [
    ...brokenRulesAt(value, here),
    ...brokenLengthRulesAt(value, here),
    ...brokenOrderRulesAt(value, here),
    ...brokenMembershipRulesAt(value, here),
    ...brokenArmConflictRulesAt(value, here),
    ...Object.entries(value).flatMap(([key, child]) =>
      walk(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/**
 * Every mutually-exclusive key pair the config declares together.
 *
 * Takes the RAW config object, not the decoded one, and returns one message per
 * offending node. An empty array means nothing to report — it does not mean the
 * config is otherwise valid.
 *
 * @param config - The parsed config object, before or after decoding.
 */
export const validateComponentXorRules = (config: unknown): readonly string[] => walk(config, '')

/** The rules, for the tests that keep each one's type and keys real. */
export const COMPONENT_XOR_RULES = XOR_RULES

/** The length rules, same purpose. */
export const COMPONENT_LENGTH_RULES = LENGTH_RULES

/** The order rules, same purpose. */
export const COMPONENT_ORDER_RULES = ORDER_RULES

/** The membership rules, same purpose. */
export const COMPONENT_MEMBERSHIP_RULES = MEMBERSHIP_RULES

/** The arm-conflict rules, same purpose. */
export const COMPONENT_ARM_CONFLICT_RULES = ARM_CONFLICT_RULES
