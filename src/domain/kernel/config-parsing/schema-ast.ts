/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE one reading of Effect Schema's AST that the domain's structural walkers
 * share: the option tree a component's docs publish, the props table, the
 * field-type catalogue, the template-context table of the action union, the
 * component-type union's literal census and the decode reporter's union titles.
 *
 * WHY ONE MODULE. Each of those readers spelled the tags itself, and a
 * walker written against the wrong tag does not throw — it descends nowhere and
 * publishes one flat level that looks complete. Effect 4 renamed the very tags a
 * reader reaches for first (`Objects`, not `TypeLiteral`; `Arrays`, not
 * `TupleType`) and moved an array's element to `rest[0]`, which IS the node and
 * carries no `.type`. Six private spellings meant six places to get that wrong on
 * the next upgrade; one spelling, held by the tripwire test beside this file
 * against the installed Effect, means one.
 *
 * STRUCTURAL, NOT IMPORTED. {@link SchemaNode} is the minimum of the AST these
 * readers touch, written as a structural type: the shape is a few properties
 * deep and stable, and every reader here also accepts things that are not
 * schemas at all (a barrel's non-schema exports, a thunk's odd result). The
 * tripwire, not the type system, is what proves the spellings still hold.
 *
 * The second half reads Effect's own typed AST for the decode reporter: the
 * encoded side of a node, the discriminant a struct pins, and what a rejected
 * union's members are called. Pure: no I/O.
 */

import { SchemaAST } from 'effect'

/** One property of an `Objects` node: its key and the node it holds. */
export interface SchemaPropertyNode {
  readonly name: PropertyKey
  readonly type: SchemaNode
}

/** The minimum of Effect's AST the domain's structural readers touch. */
export interface SchemaNode {
  readonly _tag?: string
  readonly annotations?: Readonly<Record<string, unknown>>
  /** A `Union`'s members. */
  readonly types?: readonly SchemaNode[]
  /** A `Literal`'s value. */
  readonly literal?: unknown
  readonly defaultValue?: unknown
  readonly encoding?: unknown
  /** An `Objects` node's fields. Effect 4 spells it `Objects`, not `TypeLiteral`. */
  readonly propertySignatures?: readonly SchemaPropertyNode[]
  /** An `Arrays` node's element. `rest[0]` IS the node — there is no `.type`. */
  readonly rest?: readonly SchemaNode[]
  readonly elements?: readonly SchemaNode[]
  /** The refinements on this node, each carrying annotations of its own. */
  readonly checks?: readonly SchemaNode[]
  /** A `Suspend`'s deferred schema. */
  readonly thunk?: () => unknown
}

/**
 * The tag spellings the readers rely on, as Effect 4 writes them.
 *
 * Exported so the tripwire test can assert each one against the installed
 * Effect: a rename upstream fails that test, never a walker in silence.
 */
export const AST_TAG = {
  objects: 'Objects',
  arrays: 'Arrays',
  union: 'Union',
  suspend: 'Suspend',
  literal: 'Literal',
  undefined: 'Undefined',
  null: 'Null',
  string: 'String',
  declaration: 'Declaration',
} as const

/** One of the tags {@link AST_TAG} spells. */
export type AstTag = (typeof AST_TAG)[keyof typeof AST_TAG]

/** Whether `node` carries the tag `tag`. */
export const isTag = (node: SchemaNode | undefined, tag: AstTag): boolean => node?._tag === tag

/**
 * The `ast` of a schema value, or `undefined` for anything that is not one.
 *
 * The `'function'` arm is load-bearing, not defensive. An Effect 4 schema is
 * CALLABLE, so `typeof schema` is `'function'` and an object-only guard rejects
 * every schema it is handed — silently.
 */
export const astOf = (value: unknown): SchemaNode | undefined => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined
  const node = (value as { readonly ast?: unknown }).ast
  return typeof node === 'object' && node !== null ? (node as SchemaNode) : undefined
}

/**
 * The real schema inside a `Schema.optional(...)` wrapper: a `Union` with one
 * member besides `Undefined`. Anything else is returned as it is.
 */
export const unwrap = (node: SchemaNode): SchemaNode => {
  if (node._tag !== AST_TAG.union || node.types === undefined) return node
  const defined = node.types.filter((member) => member._tag !== AST_TAG.undefined)
  const [only] = defined
  return defined.length === 1 && only !== undefined && defined.length < node.types.length
    ? only
    : node
}

/** An `Objects` node's properties; empty for every other node. */
export const objectFields = (node: SchemaNode | undefined): readonly SchemaPropertyNode[] =>
  node?._tag === AST_TAG.objects ? (node.propertySignatures ?? []) : []

/** The element node of an `Arrays` node — `rest[0]`, else `elements[0]`. */
export const arrayElement = (node: SchemaNode | undefined): SchemaNode | undefined =>
  node?._tag === AST_TAG.arrays ? (node.rest?.[0] ?? node.elements?.[0]) : undefined

/** A `Union`'s members as declared, or `undefined` when `node` is not a union. */
export const unionMembers = (node: SchemaNode | undefined): readonly SchemaNode[] | undefined =>
  node?._tag === AST_TAG.union ? (node.types ?? []) : undefined

/** A `Literal` node's value when it is a string, else `undefined`. */
export const stringLiteral = (node: SchemaNode | undefined): string | undefined =>
  node?._tag === AST_TAG.literal && typeof node.literal === 'string' ? node.literal : undefined

/**
 * One non-empty string annotation off a node's OWN annotations, or `undefined`.
 *
 * Typed loosely on purpose so Effect's own `SchemaAST.AST` and a structural
 * {@link SchemaNode} are both accepted.
 */
export const annotation = (
  node: { readonly annotations?: unknown } | undefined,
  key: string
): string | undefined => {
  const annotations = node?.annotations
  if (typeof annotations !== 'object' || annotations === null) return undefined
  const value = (annotations as Readonly<Record<string, unknown>>)[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Reduce a node to the ENCODED side — the shape the author actually writes in
 * the config file.
 *
 * Load-bearing, and for the same reason it is load-bearing in
 * `[internal ref]`: a union branch may be a struct
 * wrapped in a transformation, so a walk that does not reduce sees no property
 * signatures at all and silently reports nothing for those nodes.
 *
 * EFFECT 4: this is a model change, not a rename. v3 wrapped a struct in
 * `Refinement`/`Transformation` NODES and this walked `.from` to get underneath
 * them. v4 removed both node kinds: checks now live on `Base.checks` and
 * transformations on `Base.encoding` OF the struct node itself, so there is
 * nothing to walk past — `Objects` is already what `isObjects` sees. What
 * remains is reducing the `encoding` chain to its encoded end, which is exactly
 * `SchemaAST.toEncoded`. Using the published helper rather than hand-walking
 * `encoding[last].to` keeps the chain-direction question upstream's problem.
 *
 * Measured on this branch: all 89 branches of the real component union are plain
 * `Objects` with neither `checks` nor `encoding`, so this is presently a no-op
 * there. It is kept because absence across the whole of `AppSchema` was not
 * proven, and because a future transformation-wrapped branch would otherwise
 * regress to reporting nothing — the exact silent failure the decode reporter
 * exists to prevent.
 */
export const encodedSide = (ast: SchemaAST.AST): SchemaAST.AST => SchemaAST.toEncoded(ast)

/**
 * The literal a discriminated struct pins, preferring a property literally named
 * `type` before falling back to the first single-literal property.
 */
export const discriminantOf = (
  ast: SchemaAST.Objects
): { readonly name: string; readonly literal: string } | undefined => {
  const literals = ast.propertySignatures.flatMap((property) => {
    const propertyType = encodedSide(property.type)
    return SchemaAST.isLiteral(propertyType) && typeof propertyType.literal === 'string'
      ? [{ name: String(property.name), literal: propertyType.literal }]
      : []
  })
  return literals.find((entry) => entry.name === 'type') ?? literals[0]
}

/**
 * Every member's human title — but ONLY when the schema names ALL of them.
 *
 * The all-or-nothing gate is the safety property. A partial list reads as an
 * exhaustive one, so an author told "write `navigate` or `openSheet`" when a
 * third untitled variant exists is sent to a wrong conclusion with confidence.
 * Staying silent hands the failure back to the decoder's own formatter, which
 * is merely terse — the same "invent nothing" discipline `suggestKey` follows.
 *
 * Measured on the real `AppSchema`: the 89-branch component union carries no
 * titles at all and is therefore correctly skipped, while `RowClickAction`'s two
 * members are both titled and are reported. Members are read AS DECLARED, not
 * through `encodedSide`, because a title is put on the node the author's schema
 * names; a `Suspend` or transformation wrapper without one fails the gate and
 * that is the intended outcome.
 */
export const unionMemberTitles = (ast: SchemaAST.Union): readonly string[] | undefined => {
  const titles = ast.types.map((member) => annotation(member, 'title'))
  return titles.every((title): title is string => title !== undefined) ? titles : undefined
}

/**
 * The discriminant every member agrees on, and the literal each one pins — but
 * ONLY when the union is discriminated ALL the way through.
 *
 * Returns `undefined` unless every member is a struct, every member pins a
 * string literal, and they all pin it under the SAME property name. Three
 * things follow from that, all of them the point:
 *
 *  - **The list is exhaustive or it is not offered.** A partial list of `type`
 *    values reads as the complete set, so an author told "write `text` or
 *    `image`" while a third legal value exists is sent AWAY from a working
 *    config with confidence. That is strictly worse than the terse fallback,
 *    and it is the same reasoning that makes `unionMemberTitles`
 *    all-or-nothing and `suggestKey` refuse to invent.
 *  - **A `Suspend` or otherwise unreducible member fails the gate**, because
 *    `toEncoded` cannot show its properties and a member whose literals cannot
 *    be read cannot be proven absent from the list.
 *  - **Disagreeing names fail the gate.** A union half-discriminated on `type`
 *    and half on `variant` has no single "accepted values" list to print, and
 *    picking one name would silently drop the other half's members.
 *
 * Measured on the real `AppSchema`: the component union's 89 members all pin
 * `type`, carry no titles, and are therefore reported here rather than by
 * `unionMemberTitles`.
 */
export const unionDiscriminantValues = (
  ast: SchemaAST.Union
): { readonly name: string; readonly values: readonly string[] } | undefined => {
  const found = ast.types.map((member) => {
    const encoded = encodedSide(member)
    return SchemaAST.isObjects(encoded) ? discriminantOf(encoded) : undefined
  })

  const first = found[0]
  if (first === undefined || found.length === 0) return undefined
  if (!found.every((entry) => entry !== undefined && entry.name === first.name)) return undefined

  return {
    name: first.name,
    values: found.map((entry) => (entry as { readonly literal: string }).literal),
  }
}
