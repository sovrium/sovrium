/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * READING A COMPONENT TYPE'S SCHEMA — what an author may actually write into it.
 *
 * A surface documenting a component type is a projection of the schema's own
 * field bags, and every number on it has to come from the schema rather than
 * from a drawing. This module is the whole of that reading, and it is a domain
 * service because the reading is a fact about the schema: the same answer is
 * owed to the per-type page, to the `component-types` endpoint, and to the CLI
 * export, none of which may hold a private version of it.
 *
 * ─── WHY IT INSPECTS THE AST AND NOT THE SOURCE ────────────────────────────
 *
 * A description reaches a field three different ways: an inline
 * `X.annotate({ description })`, a `.pipe(Schema.annotate(...))`, and —
 * critically — INDIRECTION to a named schema. `button`'s `variant` carries no
 * annotation of its own; its description lives on `ButtonVariantSchema`.
 * Measured over forty-one own fields spanning twelve types, all forty-one
 * resolve through the AST, while a source-scan for `description:` inside the
 * fields block resolves roughly sixty percent — and renders a wrongly-sparse
 * table whose empty cells are indistinguishable from honest ones.
 *
 * ─── THE OPTIONAL WRAPPER IS THE FIRST THING TO GET PAST ───────────────────
 *
 * Every field in every bag is `Schema.optional(...)`, which in Effect 4 is a
 * `Union` of the real schema with `Undefined`. Annotations, literal members and
 * defaults all live on the member, not on the wrapper, so reading the wrapper's
 * own annotations returns `{}` for all eighty-five types. Measured, not assumed.
 */

import { Schema } from 'effect'
import * as aiTypes from '@/domain/models/app/pages/components/component-types/ai'
import {
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import * as contentTypes from '@/domain/models/app/pages/components/component-types/content'
import * as dataTypes from '@/domain/models/app/pages/components/component-types/data'
import * as displayTypes from '@/domain/models/app/pages/components/component-types/display'
import * as feedbackTypes from '@/domain/models/app/pages/components/component-types/feedback'
import * as formControlTypes from '@/domain/models/app/pages/components/component-types/form-controls'
import * as interactiveTypes from '@/domain/models/app/pages/components/component-types/interactive'
import * as layoutTypes from '@/domain/models/app/pages/components/component-types/layout'
import * as actionModule from '@/domain/models/app/pages/components/component-types/modules/action'
import * as contentModule from '@/domain/models/app/pages/components/component-types/modules/content'
import * as coreModule from '@/domain/models/app/pages/components/component-types/modules/core'
import * as i18nModule from '@/domain/models/app/pages/components/component-types/modules/i18n'
import * as interactionModule from '@/domain/models/app/pages/components/component-types/modules/interaction'
import * as responsiveModule from '@/domain/models/app/pages/components/component-types/modules/responsive'
import * as visibilityModule from '@/domain/models/app/pages/components/component-types/modules/visibility'
import * as navigationTypes from '@/domain/models/app/pages/components/component-types/navigation'
import * as overlayTypes from '@/domain/models/app/pages/components/component-types/overlays'
import * as specialtyTypes from '@/domain/models/app/pages/components/component-types/specialty'
import * as structuralTypes from '@/domain/models/app/pages/components/component-types/structural'

/** An opaque bag of schema fields, as the domain's `*Fields` records export them. */
export type FieldBag = Readonly<Record<string, unknown>>

/**
 * The minimum of Effect's AST this module reads.
 *
 * Written as a structural type rather than imported: the shape read here is
 * three properties deep and stable, while importing Effect's internal AST types
 * would couple this reading to a module the library marks as its own business.
 */
export interface SchemaNode {
  readonly _tag?: string
  readonly annotations?: Readonly<Record<string, unknown>>
  readonly types?: readonly SchemaNode[]
  readonly literal?: unknown
  readonly defaultValue?: unknown
  readonly encoding?: unknown
  /** An `Objects` node's fields. Effect 4 spells it `Objects`, not `TypeLiteral`. */
  readonly propertySignatures?: readonly {
    readonly name: string | symbol
    readonly type: SchemaNode
  }[]
  /** An `Arrays` node's element. `rest[0]` IS the node — there is no `.type`. */
  readonly rest?: readonly SchemaNode[]
  readonly elements?: readonly SchemaNode[]
  /**
   * The refinements attached to this node, each carrying annotations of its own.
   *
   * Read by {@link proseAnnotationOf} and by nothing else. See that function for
   * why a check's prose counts as the node's.
   */
  readonly checks?: readonly SchemaNode[]
}

/**
 * A node's prose annotation, reading its OWN annotations first and then the
 * annotations of its `checks`, in order.
 *
 * ## Why a check's description counts as the node's
 *
 * `Schema.Finite`, `Schema.Int`, `Schema.isMinLength(…)` and every other
 * refinement in Effect 4 are CHECKS on a base node, not nodes of their own —
 * `Schema.Finite` is a `Number` carrying one `isFinite` filter. `Schema.annotate`
 * piped after any of them therefore lands on the LAST check rather than on the
 * node, measured on `effect@4.0.0-rc.108`:
 *
 * ```
 * Finite.pipe(annotate({description}))          ast.annotations = null
 *                                               ast.checks[0].annotations.description = "…"
 * String.pipe(annotate({description}), check(…)) ast.annotations.description = "…"
 * ```
 *
 * Both spellings are the same fact to a reader, and the first is what an author
 * writes without thinking about it — 286 of 300 sampled undescribed nodes in
 * this schema carry their prose this way, essentially all of them because
 * `Schema.Finite` and `Schema.Int` are checks by construction. Un-sugaring them
 * into `Number.pipe(annotate, check(isFinite))` would churn the byte-gated
 * `app.json` for no reader gain.
 *
 * So the rule is: **a description carried by a node's own checks IS the node's
 * description**. It is safe because a check cannot outlive its node —
 * deleting the node deletes the check with it, which is the guarantee the whole
 * annotation tier rests on.
 *
 * What this does NOT rescue is prose piped after a check onto a node that has
 * **no** checks, and prose the JSON Schema emitter drops. Those remain findings;
 *.
 *
 * A check group nests its members under `checks` of its own, so the walk
 * recurses rather than scanning one level.
 */
export const proseAnnotationOf = (
  node: SchemaNode | undefined,
  key: string
): string | undefined => {
  if (node === undefined) return undefined
  const own = node.annotations?.[key]
  if (typeof own === 'string' && own.trim() !== '') return own
  return (node.checks ?? []).reduce<string | undefined>(
    (found, check) => found ?? proseAnnotationOf(check, key),
    undefined
  )
}

/**
 * The SEVEN shared module keys, read from the modules themselves.
 *
 * Not typed out, because the whole point of the own/shared split is that it
 * tracks the modules: a module gaining a key must move that key out of every
 * type's own-props table on the same commit, and a hand-written list would keep
 * printing it as though the type had declared it.
 *
 * `data-bound` is deliberately NOT among them. Its `dataSource` is a field an
 * author reasons about per type — `kpi` and `form` re-declare it after their
 * spread precisely because they mean something narrower by it — so it belongs
 * in the own table where its per-type description can be read.
 */
const SHARED_MODULES: readonly FieldBag[] = [
  coreModule.coreFields,
  contentModule.contentFields,
  interactionModule.interactionFields,
  responsiveModule.responsiveFields,
  visibilityModule.visibilityFields,
  actionModule.actionFields,
  i18nModule.i18nFields,
]

/** The per-category barrels, which export both `*TypeLiteral` and `*Fields`. */
const CATEGORY_BARRELS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  interactive: interactiveTypes,
  'form-controls': formControlTypes,
  data: dataTypes,
  layout: layoutTypes,
  content: contentTypes,
  display: displayTypes,
  navigation: navigationTypes,
  overlays: overlayTypes,
  feedback: feedbackTypes,
  structural: structuralTypes,
  specialty: specialtyTypes,
  ai: aiTypes,
}

/**
 * The `ast` of a schema value, or `undefined` for anything that is not one.
 *
 * The `'function'` arm is load-bearing, not defensive. An Effect 4 schema is
 * CALLABLE, so `typeof schema` is `'function'` and an object-only guard rejects
 * every schema in the catalogue — silently, returning an empty props table for
 * all eighty-five types rather than throwing anywhere a test would see it.
 */
export const astOf = (value: unknown): SchemaNode | undefined => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return undefined
  const node = (value as { readonly ast?: unknown }).ast
  return typeof node === 'object' && node !== null ? (node as SchemaNode) : undefined
}

/**
 * The real schema inside a `Schema.optional(...)` wrapper.
 *
 * Every field in every bag is optional, so without this every annotation read
 * on this page returns `{}` — which renders as a table of empty cells that
 * looks exactly like a schema carrying no documentation at all.
 */
export const unwrapOptional = (node: SchemaNode): SchemaNode => {
  if (node._tag !== 'Union' || node.types === undefined) return node
  const defined = node.types.filter((member) => member._tag !== 'Undefined')
  const [only] = defined
  return defined.length === 1 && only !== undefined && defined.length < node.types.length
    ? only
    : node
}

/** The literal members of a closed union, or `undefined` when it is not one. */
const literalsOf = (node: SchemaNode): readonly string[] | undefined => {
  if (node._tag !== 'Union' || node.types === undefined || node.types.length === 0) return undefined
  const members = node.types.filter((member) => member._tag !== 'Undefined')
  if (members.length === 0) return undefined
  const literals = members.map((member) => member.literal)
  return literals.every((literal) => typeof literal === 'string')
    ? (literals as readonly string[])
    : undefined
}

/** One annotation, read from the unwrapped member and then from the wrapper. */
const annotation = (field: unknown, key: string): string | undefined => {
  const node = astOf(field)
  if (node === undefined) return undefined
  const inner = unwrapOptional(node)
  const value = inner.annotations?.[key] ?? node.annotations?.[key]
  return typeof value === 'string' ? value : undefined
}

/** One field of a type's schema, as the props table renders it. */
export interface TypeField {
  readonly name: string
  /** The accepted values, joined — `sm | md | lg` — or the primitive's name. */
  readonly accepts: string
  /** The schema's own words, resolved through indirection. Never invented. */
  readonly description?: string
  /** The decoding default, when the schema declares one. */
  readonly defaultValue?: string
  /** The closed union's members, when the field is one. */
  readonly members?: readonly string[]
  /** The resolved schema's `title`, which is what identifies a variant axis. */
  readonly title?: string
}

/** The primitive a non-union field accepts, in the vocabulary an author writes. */
const PRIMITIVE_LABELS: Readonly<Record<string, string>> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Objects: 'object',
  Object: 'object',
  Array: 'array',
  Tuple: 'array',
}

/**
 * What a field accepts, as a reader would write it.
 *
 * A closed union prints its members joined, because that is the one thing an
 * author cannot obtain without opening the schema. Everything else prints its
 * primitive, and an unrecognised node prints nothing rather than a guess.
 */
const acceptsOf = (node: SchemaNode, members: readonly string[] | undefined): string => {
  if (members !== undefined) return members.join(' | ')
  return PRIMITIVE_LABELS[node._tag ?? ''] ?? (node._tag ?? '').toLowerCase()
}

/**
 * The values a type's decoder produces when EVERY field is omitted.
 *
 * ─── THE DECODER IS ASKED, NOT THE AST ─────────────────────────────────────
 *
 * The Default column claims one thing: what an author gets if they do not write
 * the field. `withDecodingDefaultKey` stores its value as an Effect behind the
 * encoding chain rather than as a readable node, so an AST walk either misses it
 * or reconstructs it — and a reconstructed default that drifts from the decoder
 * is worse than none, because the column exists precisely to be trusted.
 *
 * Decoding `{}` asks the decoder the question the column asks. Exactly one field
 * in the whole component catalogue answers — `copy` on `code-element` — which is
 * also why the column survived review despite reading `unset` on nearly every
 * row: it is the only place that fact is stated at all.
 *
 * A bag that refuses an empty object yields no defaults rather than throwing: a
 * page must not 500 because one type's schema tightened.
 */
export const decodedDefaults = (bag: FieldBag): Readonly<Record<string, unknown>> => {
  try {
    const struct = Schema.Struct(bag as Record<string, never>)
    // `decodeSync`, not `decodeUnknownSync`: the input is the literal `{}`, whose
    // type is known at this call site, so the unknown-input decoder would claim a
    // runtime uncertainty that does not exist here (`preferTypedSchemaDecoder`).
    const decoded = Schema.decodeSync(struct)({}) as Readonly<Record<string, unknown>>
    return Object.fromEntries(Object.entries(decoded).filter(([, value]) => value !== undefined))
  } catch {
    return {}
  }
}

/** Read one field of a bag into the shape the props table renders. */
const readField = (
  name: string,
  field: unknown,
  defaults: Readonly<Record<string, unknown>>
): TypeField => {
  const node = astOf(field)
  const inner = node === undefined ? undefined : unwrapOptional(node)
  const members = inner === undefined ? undefined : literalsOf(inner)
  return {
    name,
    accepts: inner === undefined ? '' : acceptsOf(inner, members),
    ...(annotation(field, 'description') === undefined
      ? {}
      : { description: annotation(field, 'description') }),
    ...(name in defaults ? { defaultValue: String(defaults[name]) } : {}),
    ...(members === undefined ? {} : { members }),
    ...(annotation(field, 'title') === undefined ? {} : { title: annotation(field, 'title') }),
  }
}

/**
 * The field bag a catalogued type declares.
 *
 * Paired with the type literal through the barrel's own naming convention —
 * `ButtonTypeLiteral` beside `buttonFields` — which now holds for EVERY
 * catalogued type, with no exception and no fallback.
 *
 * There was one of each, and they were the same thing: `data-form` was a second
 * literal built from `form`'s bag, so `dataFormFields` resolved to nothing and
 * a `?? barrel['formFields']` coalesce caught it. That default would have
 * silently handed `formFields` to ANY later type whose bag went missing —
 * publishing a wrong option list instead of none, which is the harder failure
 * to notice. C3 merged the two literals, removing the exception rather than
 * patching around it, so the lookup is total again: `undefined` from here now
 * means a real naming break and reads as one.
 */
const isBag = (value: unknown): value is FieldBag =>
  typeof value === 'object' && value !== null && astOf(value) === undefined

export const fieldBagOf = (type: string): FieldBag | undefined => {
  const category = CATALOG_COMPONENT_CATEGORIES.find((candidate) =>
    catalogedTypesOf(candidate).includes(type)
  )
  if (category === undefined) return undefined
  const barrel = CATEGORY_BARRELS[category]
  if (barrel === undefined) return undefined

  const literalEntry = Object.entries(barrel).find(
    ([name, value]) => name.endsWith('TypeLiteral') && astOf(value)?.literal === type
  )
  if (literalEntry === undefined) return undefined
  const [literalName] = literalEntry
  const base = literalName.slice(0, -'TypeLiteral'.length)
  const bagName = `${base.charAt(0).toLowerCase()}${base.slice(1)}Fields`
  const bag = barrel[bagName]
  return isBag(bag) ? bag : undefined
}

/** Everything the per-type page reads out of one type's schema. */
export interface TypeIntrospection {
  /** The fields the type declares itself, in declaration order. */
  readonly own: readonly TypeField[]
  /** The shared module keys this type actually spreads. */
  readonly shared: readonly string[]
  /** The field carrying a variant axis, when the type declares one. */
  readonly variant?: TypeField
  /** The field carrying a size union, when the type declares one. */
  readonly size?: TypeField
}

/**
 * Whether a field carries a VARIANT axis.
 *
 * ─── THE RULE IS THE TITLE, AND THE ALTERNATIVES WERE MEASURED ─────────────
 *
 * Only four types carry a field literally keyed `variant`, and `badge`'s is a
 * single-member mode. Most that have the concept use a prefixed key —
 * `alertVariant`, `progressVariant`, `popupVariant`. So keying on the NAME
 * reaches four types and misses the concept.
 *
 * Broadening to "any closed literal union" reaches roughly thirty types and
 * sweeps in `element` — thirteen HTML tags on `text`, eight on `container` —
 * plus `inputType`, `orientation` and `chartType`. A "Variants" matrix of
 * thirteen HTML tags is a taxonomy of the schema, not a set of visual choices
 * an author makes.
 *
 * The resolved schema's `title` separates them cleanly and by the domain's own
 * words: `Button Variant`, `Alert Variant`, `Image Variant` against `Text
 * Element` and `Code Frame`. Roughly six of eighty-five types qualify, and that
 * is the honest output rather than a shortfall.
 *
 * The two inline unions (`theme-toggle`, `dropdown-menu`) carry a description
 * and no title, and are deliberately OUT: admitting an untitled union means
 * admitting `element`, and no property separates the two.
 */
const isVariantField = (field: TypeField): boolean =>
  field.members !== undefined && field.members.length > 1 && (field.title ?? '').endsWith('Variant')

/**
 * Whether a field carries a SIZE union.
 *
 * Keyed on the union and not on the name: `qr-code` declares a `size` that is
 * `Schema.Int`, and a rule keyed on the name draws a sizes row over a number
 * with no members — printing however many cells its fallback invents.
 */
const isSizeField = (field: TypeField): boolean =>
  field.name === 'size' && field.members !== undefined && field.members.length > 1

/**
 * Read one catalogued type's schema.
 *
 * ─── THE OWN/SHARED SPLIT CANNOT BE READ OFF THE BUILT SCHEMA ──────────────
 *
 * Composition is JS object spread inside an `as const` record, so by the time
 * `Schema.Struct` exists, `props` from `coreFields` is indistinguishable from a
 * `label` declared inline. It is computed here by subtracting the shared module
 * keys — and by REFERENCE IDENTITY rather than by key alone, so a type that
 * re-declares a shared key after its spread keeps its own field in its own
 * table. `kpi` and `form` do exactly that, and a naive key subtraction files
 * their field under a module that does not describe it.
 */
export const isSpread = (name: string, value: unknown): boolean =>
  SHARED_MODULES.some((module) => name in module && module[name] === value)

export const introspectType = (type: string): TypeIntrospection => {
  const bag = fieldBagOf(type)
  if (bag === undefined) return { own: [], shared: [] }

  const defaults = decodedDefaults(bag)
  const own = Object.entries(bag)
    .filter(([name, value]) => !isSpread(name, value))
    .map(([name, value]) => readField(name, value, defaults))
  const shared = Object.keys(bag).filter((name) => isSpread(name, bag[name]))

  return {
    own,
    shared,
    ...(own.find(isVariantField) === undefined ? {} : { variant: own.find(isVariantField) }),
    ...(own.find(isSizeField) === undefined ? {} : { size: own.find(isSizeField) }),
  }
}
