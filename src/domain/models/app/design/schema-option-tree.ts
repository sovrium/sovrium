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

import {
  astOf,
  decodedDefaults,
  fieldBagOf,
  isSpread,
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
  readonly truncated?: boolean
}

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

/** One annotation of a node, when it is a string. */
const annotationOf = (node: SchemaNode, key: string): string | undefined => {
  const value = node.annotations?.[key]
  return typeof value === 'string' ? value : undefined
}

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
 */
const describedBy = (node: SchemaNode, inner: SchemaNode): { readonly description?: string } => {
  const description = annotationOf(inner, 'description') ?? annotationOf(node, 'description')
  return description === undefined ? {} : { description }
}

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
  described: { readonly description?: string }
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
  depth: number,
  expanded: readonly SchemaNode[]
): readonly RawOption[] => {
  if (node === undefined) return []
  const inner = unwrapOptional(node)
  if (inner._tag === 'Suspend') return walkSuspend(inner, path, depth, expanded)

  const described = describedBy(node, inner)
  const closed = closedValueRow(inner, path, described)
  if (closed !== undefined) return [closed]

  if (inner._tag === 'Union')
    return withFieldWords(walkUnion(inner, path, depth, expanded), path, described)

  const self: RawOption = { path, kind: kindOf(inner), ...described }
  if (!isContainer(inner)) return [self]
  if (depth >= MAX_DEPTH) return [{ ...self, truncated: true }]
  return [self, ...walkChildren(inner, path, depth, expanded)]
}

/**
 * A union of anything but literals: every branch, at this same path and depth.
 *
 * Unlike a container, a union contributes no ROW of its own — its branches
 * already answer at its path, and since a container publishes its own row every
 * branch does. A union row would carry no kind the merge does not already have.
 * What it does contribute is its words; see {@link withFieldWords}.
 */
const walkUnion = (
  inner: SchemaNode,
  path: string,
  depth: number,
  expanded: readonly SchemaNode[]
): readonly RawOption[] =>
  (inner.types ?? [])
    .filter((member) => member._tag !== 'Undefined' && member._tag !== 'Null')
    .flatMap((member) => walk(member, path, depth, expanded))

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
 * {@link agreedDescription} honest: the rows at this path genuinely agree
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
  described: { readonly description?: string }
): readonly RawOption[] =>
  described.description === undefined
    ? rows
    : rows.map((row) => (row.path === path ? { ...row, ...described } : row))

/** A `Suspend`, expanded ONCE — a second visit would not terminate. */
const walkSuspend = (
  inner: SchemaNode,
  path: string,
  depth: number,
  expanded: readonly SchemaNode[]
): readonly RawOption[] =>
  expanded.includes(inner) || depth >= MAX_DEPTH
    ? [{ path, kind: 'object', truncated: true }]
    : walk(suspendedNode(inner), path, depth + 1, [...expanded, inner])

/** The rows a container contributes BELOW itself, one level deeper. */
const walkChildren = (
  inner: SchemaNode,
  path: string,
  depth: number,
  expanded: readonly SchemaNode[]
): readonly RawOption[] =>
  inner._tag === 'Objects'
    ? (inner.propertySignatures ?? []).flatMap((property) =>
        walk(property.type, `${path}.${String(property.name)}`, depth + 1, expanded)
      )
    : walk(elementOf(inner), `${path}[]`, depth + 1, expanded)

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
const agreedDescription = (group: readonly RawOption[]): string | undefined => {
  const described = group
    .map((row) => row.description)
    .filter((description): description is string => description !== undefined)
  const [first] = described
  return first !== undefined && described.every((text) => text === first) ? first : undefined
}

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
 * only when the branches agree; see {@link agreedDescription}.
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
    const description = agreedDescription(group)
    return {
      path,
      kind: kinds.join(' | '),
      ...(values.length === 0 ? {} : { values }),
      ...(description === undefined ? {} : { description }),
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
const keyRowOf = (type: string, items: readonly SchemaOption[], key: string): SchemaOption => {
  const keyRow = items.find((row) => row.path === key)
  if (keyRow === undefined)
    // eslint-disable-next-line functional/no-throw-statements -- a walk regression, not a data case; the option census turns this into the hard failure it documents rather than serving a heading with an invented kind
    throw new Error(
      `schemaOptionTree('${type}'): the option walk published paths under "${key}" but no row ` +
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
  type: string,
  items: readonly SchemaOption[]
): readonly SchemaOptionGroup[] => {
  const keys = items
    .map((row) => topLevelKeyOf(row.path))
    .filter((key, index, all) => all.indexOf(key) === index)

  return keys.map((key): SchemaOptionGroup => {
    const keyRow = keyRowOf(type, items, key)
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
  return rowsOfGroup(items, keyRowOf(type, items, key), key)
}

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

  const defaults = decodedDefaults(bag)
  const merged = mergeByPath(
    Object.entries(bag)
      .filter(([name, value]) => !isSpread(name, value))
      .flatMap(([name, value]) => walk(astOf(value), name, 1, []))
  )

  const capped = merged.length > SCHEMA_OPTION_ROW_CAP
  const items = (capped ? merged.slice(0, SCHEMA_OPTION_ROW_CAP) : merged).map(
    (row): SchemaOption => ({
      ...row,
      ...(row.path in defaults ? { defaultValue: String(defaults[row.path]) } : {}),
    })
  )

  // Grouped from the FINISHED rows, defaults included, so a group's
  // `defaultValue` is the same string its key row publishes rather than a
  // second read of the decoder. Grouping the pre-default rows would give a
  // group `hasDefault: false` while the row inside it printed a default.
  //
  // Safe under the cap for a structural reason: the slice is a PREFIX, and a
  // container emits its own row before descending, so a key row can never be
  // cut while a path beneath it survives.
  return { capped, items, groups: groupByTopLevelKey(type, items) }
}
