/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE RECURSIVE OPTION TREE — every option a component type accepts, at any
 * depth, flattened to the key paths an author writes.
 *
 * This sits beside `type-introspection.ts` and deliberately does not replace
 * it. That module reads ONE level and answers in the type's own vocabulary,
 * which is exactly what a props table wants: a row per field, `object` where a
 * field nests. This one answers the different question the Configuration
 * section asks — "name `columns[].format` and list its twelve values" — and
 * everything past the first level currently lives only in the schema source,
 * which is the one place a config-driven console cannot reach.
 *
 * The two share their entry points on purpose. The bag a type declares, the
 * own/shared split over it, and the decoder that answers for defaults are all
 * imported from the module beside this one, so the props table and the option
 * list cannot come to disagree about which bag a type reads or which of
 * `kpi`'s fields are its own.
 *
 * ─── THE AST TAGS ARE `Objects` AND `Arrays`, NOT `TypeLiteral`/`TupleType` ─
 *
 * Effect 4 spells an object node `Objects` (carrying `propertySignatures`) and
 * an array node `Arrays` (carrying `elements` and `rest`) — not the
 * `TypeLiteral` / `TupleType` a reader coming from another schema library will
 * reach for first, and not the spelling Effect 3 used. A walker written against
 * the wrong tags does not throw. It silently descends nowhere and publishes one
 * flat level, which renders as a Configuration section that looks complete and
 * is not.
 *
 * A second trap one level down: `Arrays.rest` is an array of NODES directly, so
 * the element is `rest[0]` and `rest[0].type` is `undefined`. Both were probed
 * against effect 4.0.0-rc.108 rather than assumed.
 */

import { Schema } from 'effect'
import {
  astOf,
  decodedDefaults,
  fieldBagOf,
  isSpread,
  proseAnnotationOf,
  unwrapOptional,
  type SchemaNode,
} from './type-introspection'

/**
 * How deep the walk goes, counting one level per object / array / suspend
 * descent.
 *
 * A real cut rather than a generous ceiling. Depth 5 adds roughly six hundred
 * rows across the catalogue, and what depth 4 cuts is nearly all one thing: of
 * the nodes truncated on `table`, the large majority sit under
 * `bulkActions` — the automation ACTION union, an entire second schema domain
 * whose parameters belong on the automations pages and not in a table's option
 * list. The remainder are the same shape one level down. So this is where a
 * component's own configuration ends and another domain's begins.
 */
const MAX_DEPTH = 4

/**
 * The most rows one type may publish before the response says it was cut.
 *
 * Measured by walking this catalogue at depth 4, own fields only, merged by
 * path: **1,865 options across the 80 catalogued types, the largest being
 * `table` at 207 and `calendar` at 192**. The cap sits comfortably above
 * that real maximum so it never fires on today's schema — a cap that fired
 * routinely would report "incomplete" on a complete list — and low enough that
 * a walk which started descending into a second domain is caught rather than
 * served.
 *
 * Those figures moved when containers began publishing their own row beside
 * their children: 353 paths that existed only as somebody's child gained one,
 * and the largest type went from 163 rows to 207. Half the cap is still
 * headroom, so the margin absorbed it without the cap changing.
 *
 * Re-measure rather than trusting this paragraph; `schema-option-tree.test.ts`
 * floors the populations so a walk that has gone blind fails loudly instead of
 * publishing an empty Configuration section on every page.
 *
 * Reaching it is REPORTED, never silent. A list truncated at N without saying
 * so is worse than an error: it is indistinguishable from a schema that shrank.
 */
export const SCHEMA_OPTION_ROW_CAP = 400

/** One option, addressed by the key path an author writes. */
export interface SchemaOption {
  /** `pagination.pageSize`, `columns[].format` — the config's own grammar. */
  readonly path: string
  /** What it accepts. Kinds are joined with ` | ` where branches disagree. */
  readonly kind: string
  /** A closed union's members — the one thing an author cannot otherwise get. */
  readonly values?: readonly string[]
  /** What the decoder produces when the option is omitted, when it declares one. */
  readonly defaultValue?: string
  /** The schema's own words, resolved through indirection. Never invented. */
  readonly description?: string
  /**
   * What the option falls back to, STATED by the schema rather than decoded.
   *
   * {@link defaultValue} is what the decoder produces for `{}`, and measured on
   * this catalogue it answers for a top-level option or not at all — a nested
   * `withDefault` is unreachable that way. The annotation is how a schema states
   * a default no decode can surface, so the two are complements and neither
   * replaces the other.
   *
   * Never emitted to JSON Schema (probed on `effect@4.0.0-rc.108`: adding 53 of
   * them left `app.json` byte-identical), so it costs nothing in the byte-gated
   * document and is readable only by an AST walk — this one.
   */
  readonly defaultNote?: string
  /**
   * Per-option guidance: when to reach for it, what it interacts with.
   *
   * Distinct from {@link description}, which says what the option IS. Kept
   * apart rather than folded into that sentence because a table cell wants the
   * definition and a reader configuring the option wants the advice, and one
   * paragraph serving both serves neither. AST-only, like {@link defaultNote}.
   */
  readonly howTo?: string
  /** Set only on a subtree the depth limit cut. Absent — never `false` — otherwise. */
  readonly truncated?: boolean
}

/**
 * One row of a group: an option row plus WHAT IT DRAWS.
 *
 * `value` is what tells the two envelopes apart, and it exists because a closed
 * union means two different things to the two readers. To the flat list,
 * `variant` is ONE key accepting seven members and `values` carries them. To a
 * Configuration section, it is SEVEN rows — and a config page cannot make that
 * turn itself, because a row template binds one rows source and has no way to
 * iterate an array hanging off the row it is drawing.
 */
export interface SchemaOptionGroupRow extends SchemaOption {
  /** A closed union member, or the row's own path where the key enumerates nothing. */
  readonly value: string
}

/**
 * One top-level key of a type — the HEADING of a Configuration group.
 *
 * ─── IT CARRIES NO ROWS, AND THAT IS THE POINT ─────────────────────────────
 *
 * A row template cannot iterate an array hanging off the row it is drawing:
 * `rowsKey` is one flat `body[key]` lookup and `$record.` walks no path. So an
 * `items[]` published inside a group would be data no config page could reach
 * — the same wall the flat envelope hit. The engine's answer to a nested list
 * is a SECOND READ per outer row, so a group publishes its FACTS and its rows
 * come from {@link schemaOptionGroupRows}.
 *
 * `total` is here rather than only on the inner read so a heading can print its
 * own count before that read has happened.
 */
export interface SchemaOptionGroup {
  readonly key: string
  readonly kind: string
  readonly description?: string
  readonly defaultValue?: string
  /**
   * Whether {@link defaultValue} is present.
   *
   * The boolean beside the value, for the reason `drawable` sits beside
   * `specimenState` on the catalogue row: a config page has no `if`, so a real
   * default and the word `unset` are two nodes under two gates, and
   * `visibility.record` carries no presence operator to gate on absence with.
   */
  readonly hasDefault: boolean
  /** How many rows {@link schemaOptionGroupRows} answers with. Never `0`. */
  readonly total: number
}

/** Everything the Configuration section reads out of one type's schema. */
export interface SchemaOptionTree {
  readonly items: readonly SchemaOption[]
  /**
   * One heading per top-level key, beside {@link items} and never instead of it.
   *
   * Two questions, two shapes. "What key paths does this type accept" is the
   * flat list, which the option census and the endpoint specs read. "What
   * headings does a Configuration section print, and how many rows does each
   * carry" is this one. The rows themselves are a separate read; see
   * {@link SchemaOptionGroup}.
   */
  readonly groups: readonly SchemaOptionGroup[]
  /** Whether {@link SCHEMA_OPTION_ROW_CAP} fired. Reported, never silent. */
  readonly capped: boolean
}

/** One visit, before rows reached through several union branches are merged. */
interface RawOption {
  readonly path: string
  readonly kind: string
  readonly values?: readonly string[]
  readonly description?: string
  readonly defaultNote?: string
  readonly howTo?: string
  readonly truncated?: boolean
}

/**
 * The prose keys a node publishes, in the order a merge has to arbitrate them.
 *
 * One list, so a key added to {@link SchemaOption} cannot reach the reading and
 * miss the merge — the failure shape being a sentence that survives one branch
 * and vanishes the moment a second branch is added to the union beside it.
 */
const PROSE_KEYS = ['description', 'defaultNote', 'howTo'] as const

/** The prose a row carries, before it is merged with rows at the same path. */
type ProseAnnotations = {
  readonly [Key in (typeof PROSE_KEYS)[number]]?: string
}

/**
 * How far a walk may still descend, and what it has already expanded.
 *
 * Carried as one object rather than three parameters because the depth limit
 * became a CALLER's choice when {@link schemaOptionTreeFor} landed: a docs page
 * asking for two levels and a Configuration section asking for four are the
 * same walk with a different ceiling, and a ceiling read off a module constant
 * cannot be either.
 */
interface WalkContext {
  /** Levels descended so far. A bag's own fields start at 1. */
  readonly depth: number
  /** The `Suspend` nodes already expanded on this path — a second visit would not terminate. */
  readonly expanded: readonly SchemaNode[]
  /** The ceiling {@link depth} is compared against. Defaults to {@link MAX_DEPTH}. */
  readonly maxDepth: number
}

/** The same context, one level down. */
const deeper = (context: WalkContext): WalkContext => ({ ...context, depth: context.depth + 1 })

/** The primitive a node accepts, in the vocabulary an author writes. */
const PRIMITIVE_KINDS: Readonly<Record<string, string>> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Objects: 'object',
  Arrays: 'array',
  BigInt: 'number',
  Symbol: 'symbol',
  Any: 'unknown',
  Unknown: 'unknown',
  Never: 'never',
  Null: 'null',
  Declaration: 'object',
}

const kindOf = (node: SchemaNode): string =>
  PRIMITIVE_KINDS[node._tag ?? ''] ?? (node._tag ?? 'unknown').toLowerCase()

/**
 * One annotation of a node, when it is a string.
 *
 * Delegates to {@link proseAnnotationOf}, so a node's own `checks` are read
 * after the node itself. The indirection buys more than it looks like: in
 * Effect 4 `Schema.Finite` and `Schema.Int` ARE checks on a `Number`, so an
 * `annotate` written after one lands on the check and not on the node — and
 * without the fallback the table row for such an option publishes no prose at
 * all, however carefully it was written. [internal ref] makes that a rule rather than
 * a repair: a description carried by a node's own checks IS the node's.
 */
const annotationOf = (node: SchemaNode, key: string): string | undefined =>
  proseAnnotationOf(node, key)

/** A literal node's value as a string, or `undefined` when it carries none. */
const literalText = (node: SchemaNode): string | undefined => {
  if (node._tag !== 'Literal') return undefined
  const { literal } = node
  return typeof literal === 'string' || typeof literal === 'number' || typeof literal === 'boolean'
    ? String(literal)
    : undefined
}

/** The members of a union every branch of which is a literal, else `undefined`. */
const enumValuesOf = (node: SchemaNode): readonly string[] | undefined => {
  if (node._tag !== 'Union' || node.types === undefined) return undefined
  const members = node.types.filter((member) => member._tag !== 'Undefined')
  if (members.length === 0) return undefined
  const values = members.map(literalText)
  return values.every((value): value is string => value !== undefined) ? values : undefined
}

/** The node a `Suspend` stands for, expanded once. */
const suspendedNode = (node: SchemaNode): SchemaNode | undefined => {
  const { thunk } = node as { readonly thunk?: unknown }
  if (typeof thunk !== 'function') return undefined
  try {
    const resolved = (thunk as () => unknown)()
    return (
      astOf(resolved) ??
      (typeof resolved === 'object' && resolved !== null ? (resolved as SchemaNode) : undefined)
    )
  } catch {
    return undefined
  }
}

/** The element node of an array — `rest[0]`, which IS the node, not `{ type }`. */
const elementOf = (node: SchemaNode): SchemaNode | undefined => node.rest?.[0] ?? node.elements?.[0]

/** Whether this node has a subtree the walk could descend into. */
const isContainer = (node: SchemaNode): boolean =>
  (node._tag === 'Objects' && (node.propertySignatures?.length ?? 0) > 0) ||
  (node._tag === 'Arrays' && elementOf(node) !== undefined)

/**
 * The words a node publishes: its own, else the wrapper's.
 *
 * `inner` wins because the wrapper is plumbing — every field in every bag is
 * `Schema.optional(...)`, and the optional wrapper describes nothing.
 *
 * All three prose keys resolve by the same rule, and deliberately so: a
 * `defaultNote` written on the wrapper and a `description` written on the
 * member would otherwise be found by different lookups, and the pair that
 * disagreed would be the one nobody re-read.
 */
const describedBy = (node: SchemaNode, inner: SchemaNode): ProseAnnotations =>
  Object.fromEntries(
    PROSE_KEYS.map((key) => [key, annotationOf(inner, key) ?? annotationOf(node, key)]).filter(
      (entry) => entry[1] !== undefined
    )
  )

/**
 * The row a node contributes when it is a CLOSED set of values, else nothing.
 *
 * A union of literals and a bare literal are the same fact to a reader — the
 * option accepts these and nothing else — so both collapse to one `enum` row
 * carrying its members, which is the one thing an author cannot obtain without
 * opening the schema.
 */
const closedValueRow = (
  inner: SchemaNode,
  path: string,
  described: ProseAnnotations
): RawOption | undefined => {
  const values = enumValuesOf(inner)
  if (values !== undefined) return { path, kind: 'enum', values, ...described }

  const literal = literalText(inner)
  return literal === undefined ? undefined : { path, kind: 'enum', values: [literal], ...described }
}

/**
 * Walk one node into flat rows.
 *
 * ─── EVERY NODE PUBLISHES ITS OWN ROW, INCLUDING THE ONES IT DESCENDS INTO ──
 *
 * Descending must not cost a field its own row. A field that accepts a scalar
 * OR an object, walked so that only the object's CHILDREN survive, is published
 * with the scalar branch's kind alone — `confirm` reading `string` while seven
 * `confirm.*` rows sit beneath it on the same page. The row is then contradicted
 * by its own children, and an author who trusts the leading columns of a table
 * whose whole purpose is to say what a field accepts writes the wrong config.
 * That is the confident wrong answer this module treats as worse than silence,
 * so a container's row is ADDED to its subtree and never substituted for it.
 *
 * Three shapes, each with its own rule:
 *
 *  - a UNION of literals collapses to one `enum` row carrying its members,
 *    because that list is the one fact an author cannot obtain without opening
 *    the schema. Any other union recurses into each branch at the SAME path and
 *    depth — the branch a path came from is not a fact the Configuration
 *    section uses, and merging is what keeps one key from printing twice. It
 *    emits no row of its own, but its DESCRIPTION outranks its branches',
 *    because only the field's own sentence covers every kind the merged row
 *    publishes; see {@link withFieldWords}.
 *  - an `Objects` emits its own row and then one per property signature, joined
 *    with a dot.
 *  - an `Arrays` emits its own row and then its element with `[]` appended.
 *
 * A container at the depth limit emits its row MARKED rather than vanishing: a
 * walk that dropped the deep nodes would publish an option list that reads as
 * complete and is not, and the console would render it as the whole story.
 */
const walk = (
  node: SchemaNode | undefined,
  path: string,
  context: WalkContext
): readonly RawOption[] => {
  if (node === undefined) return []
  const inner = unwrapOptional(node)
  if (inner._tag === 'Suspend') return walkSuspend(inner, path, context)

  const described = describedBy(node, inner)
  const closed = closedValueRow(inner, path, described)
  if (closed !== undefined) return [closed]

  if (inner._tag === 'Union')
    return withFieldWords(walkUnion(inner, path, context), path, described)

  const self: RawOption = { path, kind: kindOf(inner), ...described }
  if (!isContainer(inner)) return [self]
  if (context.depth >= context.maxDepth) return [{ ...self, truncated: true }]
  return [self, ...walkChildren(inner, path, context)]
}

/**
 * A union of anything but literals: every branch, at this same path and depth.
 *
 * Unlike a container, a union contributes no ROW of its own — its branches
 * already answer at its path, and since a container publishes its own row every
 * branch does. A union row would carry no kind the merge does not already have.
 * What it does contribute is its words; see {@link withFieldWords}.
 */
const walkUnion = (inner: SchemaNode, path: string, context: WalkContext): readonly RawOption[] =>
  (inner.types ?? [])
    .filter((member) => member._tag !== 'Undefined' && member._tag !== 'Null')
    .flatMap((member) => walk(member, path, context))

/**
 * Let the field's OWN sentence outrank the sentences of its branches.
 *
 * A union is annotated directly wherever the schema has something to say about
 * the field as a whole — `FilterValueSchema.annotate({ description: 'Literal
 * value, $currentUser reference, or template string…' })` — and that sentence is
 * the only one covering every kind the merged row publishes. So it is stamped
 * onto every row the branches produced AT THIS PATH, and the ordering is:
 *
 *  1. the field's OWN words, when the union carries them;
 *  2. silence, where it carries none and its branches disagree;
 *  3. a single branch's words, NEVER, while the field has its own.
 *
 * Rule 3 is the one worth stating, because the alternative is not obviously
 * wrong until you read the output. `dataSource.filter[].value` accepts five
 * kinds through five branches, two of which are the `$currentUser` and
 * route-param references carrying "Server-resolved reference to…". Letting a
 * branch's narrower sentence surface labels a row accepting strings, numbers,
 * booleans, arrays and objects with prose about a user reference, and a reader
 * concludes the field takes nothing else — the confident wrong answer this
 * module treats as worse than silence.
 *
 * Stamping rather than adding a second row is also what keeps
 * {@link agreedProse} honest: the rows at this path genuinely agree
 * afterwards instead of being forced to. Rows BELOW the path are untouched,
 * because a sentence about the field is not a sentence about its parts.
 *
 * A union with no words of its own passes through, so branch-level merging is
 * unchanged: branches describing different things still silence each other, and
 * a lone described branch still speaks for a field the schema left unannotated.
 */
const withFieldWords = (
  rows: readonly RawOption[],
  path: string,
  described: ProseAnnotations
): readonly RawOption[] =>
  Object.keys(described).length === 0
    ? rows
    : rows.map((row) => (row.path === path ? { ...row, ...described } : row))

/** A `Suspend`, expanded ONCE — a second visit would not terminate. */
const walkSuspend = (
  inner: SchemaNode,
  path: string,
  context: WalkContext
): readonly RawOption[] =>
  context.expanded.includes(inner) || context.depth >= context.maxDepth
    ? [{ path, kind: 'object', truncated: true }]
    : walk(suspendedNode(inner), path, {
        ...deeper(context),
        expanded: [...context.expanded, inner],
      })

/** The rows a container contributes BELOW itself, one level deeper. */
const walkChildren = (
  inner: SchemaNode,
  path: string,
  context: WalkContext
): readonly RawOption[] =>
  inner._tag === 'Objects'
    ? (inner.propertySignatures ?? []).flatMap((property) =>
        walk(property.type, `${path}.${String(property.name)}`, deeper(context))
      )
    : walk(elementOf(inner), `${path}[]`, deeper(context))

/**
 * The description a merged group may publish: the one every describing branch
 * agrees on, or none.
 *
 * ─── DO NOT SIMPLIFY THIS BACK TO `find` ───────────────────────────────────
 *
 * Taking the first description found is the obvious spelling and it is wrong,
 * because a merged row is reached through branches that describe DIFFERENT
 * things. `dataSource.filter[].value` accepts five kinds, one of which is the
 * server-resolved `$currentUser` reference; that branch's sentence winning the
 * race labels a row accepting strings, numbers, booleans, arrays and objects
 * with prose saying it holds a user reference. A reader consults this column to
 * learn what the field takes, so the arbitrary winner is not a cosmetic
 * imprecision — it is a confident wrong answer, which is worse than no answer.
 *
 * Silence is therefore the output where the branches disagree. A row reached
 * through one branch is unaffected: it trivially agrees with itself and keeps
 * the schema's own words.
 *
 * This arbitrates between BRANCHES and is only ever asked the question when the
 * field itself said nothing. Where the union carries its own whole-field
 * sentence, {@link withFieldWords} has already stamped it onto every row at
 * that path, so the group agrees and this returns it — the field's own words,
 * not a branch's, and never a race between them.
 */
const agreedProse = (
  group: readonly RawOption[],
  key: keyof ProseAnnotations
): string | undefined => {
  const described = group
    .map((row) => row[key])
    .filter((description): description is string => description !== undefined)
  const [first] = described
  return first !== undefined && described.every((text) => text === first) ? first : undefined
}

/** Every prose key the branches at one path agree on, as a spreadable object. */
const agreedProseOf = (group: readonly RawOption[]): ProseAnnotations =>
  Object.fromEntries(
    PROSE_KEYS.map((key) => [key, agreedProse(group, key)]).filter(
      (entry) => entry[1] !== undefined
    )
  )

/**
 * Collapse rows sharing a key path, unioning what the branches accept.
 *
 * `columns[]` is a union of a regular column and an actions column, so
 * `columns[].label` is reached twice; `dataSource.filter[].value` is
 * `string | number | boolean | array | object` and is reached five times. A
 * table whose key column repeats reads as a rendering bug, so the path is
 * published ONCE and the kinds are joined — the row still describes everything
 * the schema accepts.
 *
 * The kinds and the values UNION because each branch contributes a true part of
 * the whole. A description cannot be unioned that way — two sentences about two
 * branches do not concatenate into a sentence about the field — so it survives
 * only when the branches agree; see {@link agreedProse}.
 */
const mergeByPath = (raw: readonly RawOption[]): readonly RawOption[] => {
  const paths = raw.map((row) => row.path).filter((path, index, all) => all.indexOf(path) === index)
  return paths.map((path): RawOption => {
    const group = raw.filter((row) => row.path === path)
    const kinds = group
      .map((row) => row.kind)
      .filter((kind, index, all) => all.indexOf(kind) === index)
    const values = group
      .flatMap((row) => row.values ?? [])
      .filter((value, index, all) => all.indexOf(value) === index)
    return {
      path,
      kind: kinds.join(' | '),
      ...(values.length === 0 ? {} : { values }),
      ...agreedProseOf(group),
      // Marked when ANY branch was cut: the honest claim is that the subtree
      // continues, and a reader choosing to trust a partly-walked row is the
      // failure the mark exists to prevent.
      ...(group.some((row) => row.truncated === true) ? { truncated: true } : {}),
    }
  })
}

/**
 * Every option one catalogued type accepts.
 *
 * ─── OWN FIELDS ONLY, BECAUSE THE SHARED MODULES DROWN THE TYPE ────────────
 *
 * Every component spreads some of seven shared modules. Walking them per type
 * is not a small overhead, it inverts the page: `button` goes from the twelve
 * options it genuinely accepts to 276, of which 264 are the automation-action
 * union reached through `action` and arbitrary HTML attributes reached through
 * `props`. That describes the schema's plumbing rather than the component, and
 * the detail route already names the shared modules as the modules they are.
 *
 * The split is by REFERENCE IDENTITY, not by key name, so a type re-declaring a
 * shared key after its spread keeps its own field — `kpi` and `form` both do.
 *
 * ─── DEFAULTS ARE ASKED OF THE DECODER ─────────────────────────────────────
 *
 * `withDefault` stores its value as an Effect behind the encoding chain rather
 * than as a readable node, so an AST walk either misses it or rebuilds it — and
 * a reconstructed default that drifts from the decoder is worse than none.
 * Decoding `{}` asks the decoder the question the column asks. Measured on this
 * catalogue, no NESTED encoding answers, so a default is published for a
 * top-level option or not at all; almost every row answers "unset", and that is
 * the honest output rather than a shortfall.
 */
/**
 * The top-level key a path belongs to: its first segment, `.` or `[` stripped.
 *
 * `columns[].format` and `columns` are the same key; `pagination.pageSize` and
 * `pagination` are the same key. One splitter, so the partition and the caller
 * asking "which group is this row in" cannot come to disagree.
 */
const topLevelKeyOf = (path: string): string => path.split(/[.[]/)[0] ?? ''

/**
 * One exploded row: the key's own row, MINUS its members, plus the one it draws.
 *
 * Built field by field rather than by spreading and deleting, because dropping
 * `values` is the point: a row saying "I am `destructive`" while also carrying
 * all seven members reads to a page as though every row enumerated the whole
 * union, and the table would print the same seven-item cell seven times.
 */
const memberRow = (keyRow: SchemaOption, value: string): SchemaOptionGroupRow => ({
  path: keyRow.path,
  kind: keyRow.kind,
  ...(keyRow.description === undefined ? {} : { description: keyRow.description }),
  ...(keyRow.defaultNote === undefined ? {} : { defaultNote: keyRow.defaultNote }),
  ...(keyRow.howTo === undefined ? {} : { howTo: keyRow.howTo }),
  ...(keyRow.defaultValue === undefined ? {} : { defaultValue: keyRow.defaultValue }),
  ...(keyRow.truncated === true ? { truncated: true } : {}),
  value,
})

/**
 * The rows one group DRAWS, from a type's already-flattened options.
 *
 * Two shapes of group, and only two:
 *
 *  - the key row carries `values` — a CLOSED union, which collapsed to one flat
 *    row and has no subtree — so the group is one row per member.
 *  - anything else: the key's own row and every row beneath it, each addressed
 *    by its own path. A plain string still draws the one row saying it exists,
 *    which is why a group is never empty.
 *
 * Measured against this catalogue: NO key both carries `values` and owns
 * descendants, so the two shapes are exclusive in fact and not only by
 * construction.
 */
const rowsOfGroup = (
  items: readonly SchemaOption[],
  keyRow: SchemaOption,
  key: string
): readonly SchemaOptionGroupRow[] =>
  keyRow.values === undefined
    ? items
        .filter(
          (row) =>
            row.path === key || row.path.startsWith(`${key}.`) || row.path.startsWith(`${key}[`)
        )
        .map((row) => ({ ...row, value: row.path }))
    : keyRow.values.map((member) => memberRow(keyRow, member))

/**
 * The flat row a group is headed by, or a THROW.
 *
 * A group's `kind`, `description` and `defaultValue` are read off the row whose
 * path IS the key, never re-derived. That row always exists because a container
 * publishes its own row beside its children (see {@link walk}) — the property
 * 353 paths gained when that rule landed. If it is ever missing, the walk has
 * regressed, and the honest answer is a throw the option census turns into a
 * hard failure rather than a heading carrying an invented kind.
 */
const keyRowOf = (source: string, items: readonly SchemaOption[], key: string): SchemaOption => {
  const keyRow = items.find((row) => row.path === key)
  if (keyRow === undefined)
    // eslint-disable-next-line functional/no-throw-statements -- a walk regression, not a data case; the option census turns this into the hard failure it documents rather than serving a heading with an invented kind
    throw new Error(
      `${source}: the option walk published paths under "${key}" but no row ` +
        `for "${key}" itself. Every container emits its own row beside its children, so this ` +
        `means the walk regressed — see the walk note in schema-option-tree.ts.`
    )
  return keyRow
}

/**
 * The HEADINGS: one per top-level key present in the flat list.
 *
 * ─── THE PARTITION IS TOTAL IN BOTH DIRECTIONS ─────────────────────────────
 *
 * The set of group keys EQUALS the set of top-level keys present in `items`:
 * no key invented, none lost, and every flat path reachable as either a group's
 * key or a row of {@link schemaOptionGroupRows} for that key. A grouping that
 * dropped a path would publish a Configuration section documenting a schema
 * that is not the one the engine decodes — the same "complete and is not"
 * failure the depth mark exists for one level down.
 */
const groupByTopLevelKey = (
  source: string,
  items: readonly SchemaOption[]
): readonly SchemaOptionGroup[] => {
  const keys = items
    .map((row) => topLevelKeyOf(row.path))
    .filter((key, index, all) => all.indexOf(key) === index)

  return keys.map((key): SchemaOptionGroup => {
    const keyRow = keyRowOf(source, items, key)
    return {
      key,
      kind: keyRow.kind,
      ...(keyRow.description === undefined ? {} : { description: keyRow.description }),
      ...(keyRow.defaultValue === undefined ? {} : { defaultValue: keyRow.defaultValue }),
      hasDefault: keyRow.defaultValue !== undefined,
      // Counted from the rows the inner read will answer with, never from the
      // flat rows under the key: a closed union is ONE flat row and SEVEN drawn
      // ones, and a heading whose figure disagreed with the list beneath it is
      // the one defect a reader can see without opening anything.
      total: rowsOfGroup(items, keyRow, key).length,
    }
  })
}

/**
 * The rows a Configuration group draws — the INNER read of the two.
 *
 * Empty for a key the type does not declare, and that is a contract rather than
 * a degenerate case: a filter falling back to the whole list would draw every
 * option of the type under one heading and look like a working page, which is
 * the confident wrong answer this module treats as worse than silence.
 */
export const schemaOptionGroupRows = (
  type: string,
  key: string
): readonly SchemaOptionGroupRow[] => {
  const { items } = schemaOptionTree(type)
  if (!items.some((row) => topLevelKeyOf(row.path) === key)) return []
  return rowsOfGroup(items, keyRowOf(typeSource(type), items, key), key)
}

/** How a walk regression names itself when the walk was asked for by type name. */
const typeSource = (type: string): string => `schemaOptionTree('${type}')`

/**
 * One walked tree per type, for the process's lifetime.
 *
 * ─── THE CONSOLE READS THIS ONCE PER GROUP, NOT ONCE PER PAGE ──────────────
 *
 * A Configuration section is an outer read of the headings and then one INNER
 * read per heading, each a loopback request — twelve or more on `table`.
 * Every one of them re-walked a two-hundred-node AST, decoded `{}` for the
 * defaults, and merged the result. That is a render-path regression the moment
 * the second read lands.
 *
 * Sound to cache because the walk is a pure function of a BUILD constant: it
 * reads `fieldBagOf(type)` and nothing else, takes no `App`, and two instances
 * on the same binary answer identically — the same property `listComponentTypes`
 * states as its own contract. So there is no config change, no request and no
 * session that could invalidate an entry.
 *
 * ─── WHAT BOUNDS THE MAP IS THE CALLER'S GUARD, NOT THIS FUNCTION ──────────
 *
 * The key is a bare `string`, and one frame up it is a URL PATH PARAMETER
 * (`/api/admin/schema/component-types/:type/options`). Nothing here rejects a
 * name, so read on its own this looks like a map a visitor could mint entries
 * in — an unbounded, process-lifetime cache keyed on request data.
 *
 * It is not, and the reason is EXTERNAL to this module:
 * `componentTypeOptions` — the only caller of this function and of
 * {@link schemaOptionGroupRows} — returns `undefined` on
 * `categoryOf(type) === undefined` before either call, so a name outside the
 * catalogue never reaches the walk. The map is bounded by the catalogue, at 80
 * entries, BECAUSE of that guard and not otherwise.
 *
 * So the guard is load-bearing rather than incidental. Serving a type the
 * catalogue withholds — the one plausible reason to relax it — must NARROW it,
 * never drop it, and a second caller owes the same check before it gets here.
 */
const TREE_CACHE = new Map<string, SchemaOptionTree>()

export const schemaOptionTree = (type: string): SchemaOptionTree => {
  const cached = TREE_CACHE.get(type)
  if (cached !== undefined) return cached
  const tree = walkOptionTree(type)
  /* eslint-disable-next-line functional/no-expression-statements, functional/immutable-data --
     the memo write IS the state this module-level cache exists to hold; it is not
     observable, since the walk is a pure function of a build constant */
  TREE_CACHE.set(type, tree)
  return tree
}

const walkOptionTree = (type: string): SchemaOptionTree => {
  const bag = fieldBagOf(type)
  if (bag === undefined) return { items: [], capped: false, groups: [] }

  return assembleOptionTree({
    source: typeSource(type),
    raw: Object.entries(bag)
      .filter(([name, value]) => !isSpread(name, value))
      .flatMap(([name, value]) =>
        walk(astOf(value), name, { depth: 1, expanded: [], maxDepth: MAX_DEPTH })
      ),
    defaults: decodedDefaults(bag),
    rowCap: SCHEMA_OPTION_ROW_CAP,
  })
}

/**
 * Merge, cap, attach defaults and group — the half both entry points share.
 *
 * Extracted rather than duplicated because the ORDER of these four steps is
 * load-bearing in two places at once (defaults before grouping, cap as a
 * prefix), and a second copy is a second chance to get that order wrong on a
 * tree nobody re-measures.
 */
/**
 * A decoded default as a reader can retype it into a config file.
 *
 * `String(value)` is right for every scalar and WRONG for the two shapes a
 * `withDefault` most often carries: it renders `{}` as the literal text
 * `[object Object]` and `[]` as the empty string. Neither is a cell a reader
 * can act on, and the second is the worse of the two — an empty Default column
 * is indistinguishable from an option that declares no default at all.
 *
 * So a structural default is published as its JSON, which is what an author
 * would write. Scalars keep `String`, because `JSON.stringify` would wrap a
 * string default in quotes the config format does not want.
 */
const stringifyDefault = (value: unknown): string =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)

const assembleOptionTree = (input: {
  readonly source: string
  readonly raw: readonly RawOption[]
  readonly defaults: Readonly<Record<string, unknown>>
  readonly rowCap: number
}): SchemaOptionTree => {
  const merged = mergeByPath(input.raw)
  const capped = merged.length > input.rowCap
  const items = (capped ? merged.slice(0, input.rowCap) : merged).map((row): SchemaOption => ({
    ...row,
    ...(row.path in input.defaults
      ? { defaultValue: stringifyDefault(input.defaults[row.path]) }
      : {}),
  }))

  // Grouped from the FINISHED rows, defaults included, so a group's
  // `defaultValue` is the same string its key row publishes rather than a
  // second read of the decoder. Grouping the pre-default rows would give a
  // group `hasDefault: false` while the row inside it printed a default.
  //
  // Safe under the cap for a structural reason: the slice is a PREFIX, and a
  // container emits its own row before descending, so a key row can never be
  // cut while a path beneath it survives.
  return { capped, items, groups: groupByTopLevelKey(input.source, items) }
}

// =============================================================================
// The general entry point: any schema node, not only a catalogued type
// =============================================================================

/**
 * The top-level keys a root node publishes, as the walk's starting points.
 *
 * Three roots are addressable and nothing else is:
 *
 *  - an `Objects` publishes its property signatures, which is the bag case
 *    {@link walkOptionTree} already handles one level up;
 *  - a `Union` publishes every branch's keys, merged by path downstream. A
 *    discriminated union of shapes — an automation action, a field type — is
 *    ONE thing to a reader configuring it, and the merge is what turns the
 *    branches back into the single table an author writes against;
 *  - a `Suspend` is expanded once and re-asked.
 *
 * Anything else — a scalar, an array, a literal, a node whose `_tag` this build
 * of Effect does not spell the way this module expects — publishes NOTHING.
 *
 * That last clause is the design, not a gap. The failure this module exists to
 * make loud is a walk reading the wrong AST tags, which descends nowhere while
 * returning a plausible-looking flat level (see the header). Asked for a root's
 * own keys, a blinded walk returns zero rows rather than a partial tree, so the
 * caller sees an empty document instead of a short one — and an empty document
 * is the only shape a reader cannot mistake for the truth.
 */
const topLevelEntriesOf = (
  node: SchemaNode,
  expanded: readonly SchemaNode[]
): readonly { readonly name: string; readonly type: SchemaNode }[] => {
  const inner = unwrapOptional(node)
  if (inner._tag === 'Suspend') {
    if (expanded.includes(inner)) return []
    const resolved = suspendedNode(inner)
    return resolved === undefined ? [] : topLevelEntriesOf(resolved, [...expanded, inner])
  }
  if (inner._tag === 'Objects')
    return (inner.propertySignatures ?? []).map((property) => ({
      name: String(property.name),
      type: property.type,
    }))
  if (inner._tag === 'Union')
    return (inner.types ?? [])
      .filter((member) => member._tag !== 'Undefined' && member._tag !== 'Null')
      .flatMap((member) => topLevelEntriesOf(member, expanded))
  return []
}

/**
 * What a walk regression on an anonymous node calls itself.
 *
 * A schema's `identifier` is the name it is published under — `Llms`, `Table` —
 * and is what a reader can act on. Falling back to the `_tag` is deliberate
 * rather than defensive: an unnamed root is exactly the case where the tag is
 * the only handle anyone has.
 */
const nodeSource = (node: SchemaNode): string =>
  `schemaOptionTreeFor(${annotationOf(node, 'identifier') ?? node._tag ?? 'anonymous'})`

/**
 * The defaults a root node's decoder produces for `{}`.
 *
 * The bag entry point asks a `Schema.Struct` it built itself; here there is only
 * an AST, so the schema is rebuilt from it with `Schema.make`. Probed on
 * `effect@4.0.0-rc.108`: a rebuilt schema decodes `{}` to the same defaults as
 * the original, including a `withDecodingDefault`, so this is the same question
 * {@link decodedDefaults} asks rather than a reconstruction of the answer —
 * which is the thing that would be worse than no column at all.
 *
 * A root that refuses `{}` — anything with a required key — yields no defaults
 * rather than throwing. A docs page must not fail to render because the schema
 * it documents has a mandatory field.
 */
/**
 * `Schema.make`, narrowed to the one shape this module can decode with.
 *
 * `make` is typed for an arbitrary AST, so its result declares `unknown`
 * decoding services and `decodeSync` rejects it. The node handed here came from
 * `astOf` over a real schema, which is by construction service-free — every
 * schema in `AppSchema` decodes synchronously, and one that did not would fail
 * the {@link decodedDefaultsOfNode} catch rather than misreport a default.
 */
const rebuildCodec = Schema.make as (
  ast: SchemaNode
) => Schema.Codec<unknown, unknown, never, never>

const decodedDefaultsOfNode = (node: SchemaNode): Readonly<Record<string, unknown>> => {
  try {
    const decoded: unknown = Schema.decodeSync(rebuildCodec(node))({})
    return typeof decoded === 'object' && decoded !== null
      ? Object.fromEntries(
          Object.entries(decoded as Readonly<Record<string, unknown>>).filter(
            ([, value]) => value !== undefined
          )
        )
      : {}
  } catch {
    return {}
  }
}

/**
 * Every option ANY schema node accepts — the same walk, without the catalogue.
 *
 * {@link schemaOptionTree} answers for a catalogued component type: it resolves
 * the type's field bag, subtracts the shared modules, and memoises the result
 * behind a name the console guards. None of that is true of a property of
 * `AppSchema`, which has no bag, no shared modules to subtract and no type name
 * — and which the documentation engine has to render exactly as faithfully.
 *
 * So the walk is the same and the ENTRY is different:
 *
 *  - the root is a node, and its own top-level keys are the starting paths;
 *  - the depth ceiling and the row cap are the CALLER's, because a fragment
 *    documenting one option wants two levels where a Configuration section
 *    wants four, and a ceiling read off a module constant serves one of them;
 *  - nothing is memoised. The cache one function up is keyed by a bare string
 *    and is bounded only by its caller's guard (see {@link TREE_CACHE}); a
 *    cache keyed by node identity would hold every schema the process ever
 *    rendered, for a walk whose cost is a few milliseconds.
 *
 * Both entry points share {@link assembleOptionTree}, so the merge, the cap, the
 * defaults and the grouping cannot come to differ between the console and the
 * manual — which would be the same option described two ways by one binary.
 *
 * @param node - The AST of the schema to walk. `astOf(XSchema)` produces one.
 * @param options - `depth` defaults to 4, `rowCap` to {@link SCHEMA_OPTION_ROW_CAP}.
 * @returns The flat rows, their group headings, and whether the cap fired.
 */
export const schemaOptionTreeFor = (
  node: SchemaNode,
  options?: { readonly depth?: number; readonly rowCap?: number }
): SchemaOptionTree => {
  const maxDepth = options?.depth ?? MAX_DEPTH
  const entries = topLevelEntriesOf(node, [])
  if (entries.length === 0) return { items: [], capped: false, groups: [] }

  return assembleOptionTree({
    source: nodeSource(node),
    raw: entries.flatMap((entry) =>
      walk(entry.type, entry.name, { depth: 1, expanded: [], maxDepth })
    ),
    defaults: decodedDefaultsOfNode(node),
    rowCap: options?.rowCap ?? SCHEMA_OPTION_ROW_CAP,
  })
}

// =============================================================================
// Addressing ONE option by the path an author writes
// =============================================================================

/**
 * One key path, split into the name it addresses and the arrays it indexes.
 *
 * `fields[]` is one segment carrying one array descent, not two segments: the
 * config's grammar writes the brackets as part of the key, and splitting them
 * apart would make `tables[]` and `tables.[]` the same path to this module and
 * different paths to a reader.
 */
interface PathSegment {
  readonly name: string
  /** How many `[]` follow the name — nested arrays are rare but legal. */
  readonly arrays: number
}

/** `fields[]` → `{ name: 'fields', arrays: 1 }`; anything else is a refusal. */
const SEGMENT = /^([A-Za-z_$][A-Za-z0-9_$-]*)((?:\[])*)$/

const parseOptionPath = (path: string): readonly PathSegment[] | undefined => {
  const segments = path.split('.').map((raw): PathSegment | undefined => {
    const match = SEGMENT.exec(raw)
    return match === null
      ? undefined
      : { name: match[1] ?? '', arrays: (match[2] ?? '').length / 2 }
  })
  return segments.length > 0 && segments.every((segment) => segment !== undefined)
    ? (segments as readonly PathSegment[])
    : undefined
}

/** A node with its optional wrapper removed and its `Suspend` chain expanded. */
const resolveNode = (node: SchemaNode, expanded: readonly SchemaNode[]): SchemaNode => {
  const inner = unwrapOptional(node)
  if (inner._tag !== 'Suspend' || expanded.includes(inner)) return inner
  const resolved = suspendedNode(inner)
  return resolved === undefined ? inner : resolveNode(resolved, [...expanded, inner])
}

/**
 * The type of one property, searching union branches in declaration order.
 *
 * A branch search rather than a merge, because the caller only needs somewhere
 * to CONTINUE descending from; the row itself is produced by
 * {@link schemaOptionTreeFor}, which merges every branch at the final step. So
 * a key declared by two branches of a discriminated union is descended through
 * the first and still described by all of them.
 */
const propertyTypeOf = (node: SchemaNode, name: string): SchemaNode | undefined => {
  const inner = resolveNode(node, [])
  if (inner._tag === 'Objects')
    return inner.propertySignatures?.find((property) => String(property.name) === name)?.type
  if (inner._tag === 'Union')
    return (inner.types ?? []).reduce<SchemaNode | undefined>(
      (found, member) => found ?? propertyTypeOf(member, name),
      undefined
    )
  return undefined
}

/** The element type behind one `[]`, searching union branches the same way. */
const elementTypeOf = (node: SchemaNode): SchemaNode | undefined => {
  const inner = resolveNode(node, [])
  if (inner._tag === 'Arrays') return elementOf(inner)
  if (inner._tag === 'Union')
    return (inner.types ?? []).reduce<SchemaNode | undefined>(
      (found, member) => found ?? elementTypeOf(member),
      undefined
    )
  return undefined
}

/** One whole segment: the property, then each of its array descents. */
const descendSegment = (node: SchemaNode, segment: PathSegment): SchemaNode | undefined =>
  Array.from({ length: segment.arrays }).reduce<SchemaNode | undefined>(
    (current) => (current === undefined ? undefined : elementTypeOf(current)),
    propertyTypeOf(node, segment.name)
  )

/** Where a descent got to: the node, and every node it passed through. */
interface Descent {
  readonly node: SchemaNode
  readonly visited: readonly SchemaNode[]
}

/** One option, and the schemas a reader would find it documented under. */
export interface SchemaOptionLocation {
  readonly option: SchemaOption
  /**
   * Every node the descent passed through, root first, optional wrappers and
   * `Suspend` links resolved away.
   *
   * Published so a caller can name the SCHEMA an option belongs to — which is
   * how `sovrium docs config` names the article that documents it — without
   * this module knowing anything about articles.
   */
  readonly visited: readonly SchemaNode[]
}

/**
 * The single option a config path names — `llms.full`, `tables[].fields[].type`.
 *
 * ─── DESCEND TO THE PARENT, THEN ASK THE ORDINARY WALK ─────────────────────
 *
 * The final row is produced by {@link schemaOptionTreeFor} over the option's
 * PARENT, not by a second reader written for one key. That is deliberate: the
 * walk is where union branches merge, where a closed union becomes its member
 * list, where a check's description counts as its node's, and where the decoder
 * is asked for a default. A lookup that read the leaf node directly would
 * answer differently from the table on the page documenting it, and the two
 * disagreeing about one option is the failure this whole module exists to
 * prevent.
 *
 * The depth is `1 + the leaf's array descents`, so `fields[]` is reached as the
 * child the walk publishes at `fields[]` rather than as a second lookup.
 *
 * @param root - The AST to resolve the path against, usually `astOf(AppSchema)`.
 * @param path - A dotted key path, `[]` marking an array descent.
 * @returns The option and its ancestry, or `undefined` when the path names
 *   nothing — a refusal the caller reports by name, never an empty answer.
 */
export const schemaOptionAt = (
  root: SchemaNode,
  path: string
): SchemaOptionLocation | undefined => {
  const segments = parseOptionPath(path)
  const leaf = segments?.at(-1)
  if (segments === undefined || leaf === undefined) return undefined

  const parent = segments.slice(0, -1).reduce<Descent | undefined>(
    (current, segment) => {
      if (current === undefined) return undefined
      const next = descendSegment(current.node, segment)
      return next === undefined
        ? undefined
        : { node: next, visited: [...current.visited, resolveNode(next, [])] }
    },
    { node: root, visited: [root] }
  )
  if (parent === undefined) return undefined

  const key = `${leaf.name}${'[]'.repeat(leaf.arrays)}`
  const tree = schemaOptionTreeFor(parent.node, { depth: 1 + leaf.arrays })
  const option = tree.items.find((row) => row.path === key)
  if (option === undefined) return undefined

  const leafNode = descendSegment(parent.node, leaf)
  return {
    option,
    visited:
      leafNode === undefined ? parent.visited : [...parent.visited, resolveNode(leafNode, [])],
  }
}
