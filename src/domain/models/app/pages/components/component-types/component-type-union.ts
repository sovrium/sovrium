/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { allComponents } from './component-type-union-definitions'
import { refusesUndrawableType } from './specialty/specimen-refusal'

export { ComponentTypeSchema } from './component-type-union-definitions'

// ─── Engine component types (the styleable surface) ─────────────────────────

/**
 * Component types the ENGINE draws, and which an operator may therefore restyle
 * through `design.components`.
 *
 * ## Why it is derived, not written
 *
 * A hand-written second list of ~85 type names is a second source of truth that
 * drifts, and the drift is silent in the direction that matters: a type added
 * to `allComponents` and forgotten here is simply not styleable, with nothing
 * anywhere saying so. This reads the SAME tuple `buildComponentUnion` iterates,
 * for the same reason {@link ComponentUnion} does.
 *
 * ## What is excluded, and why each is not an oversight
 *
 * - **`command-palette`** — it emits no visible markup server-side at all, only
 *   a JSON config block and its runtime; the overlay is built in the browser on
 *   the first ⌘K. There is no engine-owned element on the page to carry a
 *   class, so an entry here could only ever be a no-op. Its overlay follows the
 *   design tokens the runtime reads, not a per-type recipe.
 * - **`customHTML`** — its whole contract is that the author supplies the
 *   markup. There is no engine-owned element to attach a class to, and no
 *   stable part vocabulary to name one by, so a `design.components.customHTML`
 *   entry could only ever be a no-op. Author classes on it already go through
 *   `props.className`.
 * Config-AUTHORING editor types need no exclusion here: they do not exist at
 * all (see `retired-types.ts`).
 *
 * Everything else is in, including types whose renderer is thin: a thin
 * renderer is still an engine-owned element with a `root`.
 */
export const UNSTYLEABLE_COMPONENT_TYPES = [
  'command-palette',
  'customHTML',
] as const satisfies readonly DeclaredComponentType[]

/**
 * Every type name in {@link allComponents}, as a union of literals.
 *
 * Derived from the tuple rather than from {@link ComponentTypeSchema}, whose
 * member list is written out by hand: two hand-maintained lists could disagree,
 * and this one has to be exactly the set the runtime derivation below walks or
 * the two halves of `ENGINE_COMPONENT_TYPES` would describe different things.
 */
type DeclaredComponentType = Schema.Schema.Type<(typeof allComponents)[number][0]>

/**
 * The engine types an operator may restyle — the type-level half of
 * {@link ENGINE_COMPONENT_TYPES}.
 *
 * @public
 */
export type EngineComponentType = Exclude<
  DeclaredComponentType,
  (typeof UNSTYLEABLE_COMPONENT_TYPES)[number]
>

const UNSTYLEABLE: ReadonlySet<string> = new Set(UNSTYLEABLE_COMPONENT_TYPES)

/**
 * Every engine component type an operator may restyle, in `allComponents`
 * order.
 *
 * Typed as `readonly EngineComponentType[]` rather than `readonly string[]`,
 * and that is load-bearing rather than cosmetic: the `Schema.Struct` built from
 * this list takes its KEY type from the element type, so a `string[]` here
 * produces a struct whose TypeScript type is an index signature — one that
 * validates correctly at runtime while offering an author no autocomplete and
 * accepting `buton` at compile time. Measured, not assumed: that is exactly
 * what the first version of this emitted.
 *
 * Deduplicated: two entries of `allComponents` may legitimately share a fields
 * record, and a repeated literal would collapse silently inside that struct.
 */
export const ENGINE_COMPONENT_TYPES: readonly EngineComponentType[] = [
  ...new Set(
    allComponents.flatMap(([typeLiteral]) => {
      const { ast } = typeLiteral
      if (ast._tag !== 'Literal' || typeof ast.literal !== 'string') return []
      return UNSTYLEABLE.has(ast.literal) ? [] : [ast.literal as EngineComponentType]
    })
  ),
]

/**
 * Every component type whose schema declares a `formRef` — the kinds that can
 * embed a top-level `app.forms[]` form.
 *
 * DERIVED from each type's fields record, never listed by hand. The embedded-form
 * access gate (a page embedding a form the caller may not use is a 404) reads
 * this set, and a hand-written list is exactly how it once saw `form` alone and
 * missed a `dialog` carrying `formRef`: a new host type now joins the gate the
 * moment its schema declares the key.
 */
export const FORM_REF_HOST_TYPES: ReadonlySet<string> = new Set(
  allComponents.flatMap(([typeLiteral, fields]) => {
    const { ast } = typeLiteral
    if (ast._tag !== 'Literal' || typeof ast.literal !== 'string') return []
    return 'formRef' in fields ? [ast.literal] : []
  })
)

// ─── Container Types (components that support children nesting) ─────────────

/**
 * Whitelist of component types that support `children` nesting.
 *
 * Only container/wrapper components should accept children. Data-driven components
 * (data-table, chart, kanban, etc.), leaf elements (icon, divider, spinner, etc.),
 * form controls, and content components (which use `content` field instead) do NOT
 * support children.
 *
 * New components default to NO children — add here only if they genuinely
 * wrap arbitrary child components.
 */
const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  // Layout containers
  'container',
  'split-pane',
  'flex',
  'grid',
  'sidebar',
  'card',
  // Text elements (wrap inline text/component children, e.g. <h1>Welcome</h1>)
  'text',
  // Interactive containers (wrap icon + text children, e.g. <Button><Icon /> Submit</Button>)
  'button',
  'badge',
  'link',
  'alert',
  'button-group',
  // Data containers (wrap child components like form fields)
  'form',
  'list',
  // Form-control composer (wraps a single input + label + description + error)
  'field',
  // Overlay containers
  'alert-dialog',
  'dialog',
  'drawer',
  'popover',
  'tooltip',
  'hover-card',
  // Display containers
  'empty-state',
  // A marquee scrolls its children, so it must be able to hold them
  'marquee',
  'scroll-area',
  'accordion',
  'tabs',
  // A stepper's children are its step bodies, index-aligned with `steps` the
  // way a tab set's children are aligned with `panels`
  'stepper',
  'timeline',
  'list-item',
  // Reorderable list wraps list-item children for drag-and-drop reordering
  'reorderable-list',
  // A dropdown's children are its TRIGGER, and there is no ambiguity about
  // that: the popup is `menuItems`, a structured field of its own, so the only
  // slot children could fill is the affordance that opens it. An app chrome
  // naming its operator needs an avatar and two lines inside that affordance
  // (the dropdown-children-are-the-trigger rule / Q9(a)), and a `triggerLabel` string cannot hold them.
  'dropdown-menu',
  // Custom components (may need arbitrary children)
  'customHTML',
])

// ─── Derived component shape ────────────────────────────────────────────────

/**
 * Decoded shape of ONE component branch — its `type` literal plus every key its
 * `<name>Fields` record declares — derived MECHANICALLY from the same
 * `allComponents` tuple `buildComponentUnion` iterates.
 *
 * Deriving rather than hand-writing is the whole point: a hand-written mirror
 * of 88 component definitions is a second source of truth that drifts, which is
 * precisely the failure this type exists to end.
 */
type ComponentBranchType<D> = D extends readonly [infer TypeLiteral, infer Fields]
  ? Fields extends Schema.Struct.Fields
    ? { readonly type: Schema.Schema.Type<TypeLiteral> } & Schema.Struct.Type<Fields>
    : never
  : never

/**
 * Discriminated union of every component's decoded shape, keyed by `type`.
 *
 * Does NOT carry `children`: that field is injected per consumer by
 * {@link buildComponentUnion} and only onto `CONTAINER_TYPES`, so a consumer
 * intersects its own children shape onto this union. Today only `TypedComponent`
 * (`pages/components/index.ts`) does; `ComponentTemplateSchema` and
 * `ComponentChildElementSchema` are still annotated `Schema.Schema<any, …>` and
 * would each add their own children shape the same way.
 */
export type ComponentUnion = {
  readonly [I in keyof typeof allComponents]: ComponentBranchType<(typeof allComponents)[I]>
}[number]

// ─── Union Builder ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic fields injected per consumer (children, name, etc.)
type InjectableFields = Record<string, any>

/**
 * Build a discriminated union of component schemas.
 *
 * Each consumer (page components, template components, child elements)
 * calls this with its own `children` field definition, since the children
 * type differs per context (page children support $ref, template children don't).
 *
 * Children are only injected into container types listed in CONTAINER_TYPES.
 * Data components, leaf elements, form controls, and content components
 * do NOT receive children — they use structured config or `content` instead.
 *
 * Each component type gets ONLY the shared field modules it opts into,
 * plus its own type-specific properties. A spacer gets only `props`,
 * while a data-table gets `props + responsive + visibility + i18n + dataBound`.
 *
 * @param childrenField - Object with a `children` key (Schema.optional(...))
 * @param extraFields - Additional fields to add to every branch (e.g. `name` for templates)
 */
export function buildComponentUnion(
  childrenField: Readonly<InjectableFields>,
  extraFields: InjectableFields = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- huge discriminated union exceeds the .d.ts serialization limit (TS7056); every consumer already widens to Schema.Schema<any, any, never>
): Schema.Codec<any, any, never> {
  const branches = allComponents.map(([typeLiteral, fields]) => {
    // Extract the type string from the Schema.Literal AST to check container membership
    const { ast } = typeLiteral
    const isContainer =
      ast._tag === 'Literal' && typeof ast.literal === 'string' && CONTAINER_TYPES.has(ast.literal)

    // `specimen` gets its `component` field injected here, for the SAME
    // reason `children` is: the field holds a component, the only place a
    // component union can be built is this module, and a specialty file that
    // imported it back would close a cycle whose failure is a ReferenceError
    // on `allComponents` — measured twice before it was believed. Unlike
    // `children` the schema is fixed rather than per-consumer, because the
    // refusal it carries is a safety rule that must not vary by call site.
    const isSpecimen = ast._tag === 'Literal' && ast.literal === 'specimen'

    return Schema.Struct({
      type: typeLiteral,
      ...(isContainer ? childrenField : {}),
      ...(isSpecimen ? specimenComponentField : {}),
      ...fields,
      ...extraFields,
    })
  })

  // Schema.Union requires at least 2 members.
  // v4 takes the members as ONE array — `branches` IS that array, so it is
  // passed directly. Wrapping it (`Union([branches])`) builds a one-member
  // union whose member is an Array rather than a Schema; the `as` cast makes
  // that type-check, and it throws only later inside `SchemaAST.toType`.
  return Schema.Union(branches as [(typeof branches)[0], (typeof branches)[0], ...typeof branches])
}

/**
 * The component a `specimen` may draw — the full type union, minus the types a
 * preview frame must not carry.
 *
 * ─── WHY IT LIVES HERE AND NOT BESIDE THE TYPE ─────────────────────────────
 *
 * `specimen` declares a field holding a COMPONENT, and the only place a
 * component union can be built is here, where {@link allComponents} is. So the
 * field is INJECTED into the specimen branch by {@link buildComponentUnion},
 * exactly as `children` is injected into a container branch — and for exactly
 * the same reason.
 *
 * The alternative was tried and is a real defect, not a stylistic loss: a
 * `specialty/specimen.ts` that imports a union back from this module closes a
 * cycle, and whichever of the two modules is entered FIRST decides whether it
 * throws. Entering through `catalog.ts` — which reaches `./specialty` before
 * anything reaches this file — read `allComponents` while `specimen.ts` was
 * still initialising and failed with `Cannot access 'SpecimenTypeLiteral'
 * before initialization`. The unit suite happened to enter the other way and
 * stayed green, which is what made the first version look correct.
 *
 * Consequence, stated rather than hidden: `component` is not in
 * `specimenFields`, so schema introspection does not list it — the same cost
 * `children` already pays, for the same reason.
 *
 * ─── THE REFUSAL IS DEPTH-INDEPENDENT ──────────────────────────────────────
 *
 * The check sits on the union that the specimen's children ALSO recurse
 * through, so a refused type is refused at any depth. A form nested three
 * levels inside a card is the same live write control as one at the top, and
 * [internal ref] A3 clause 2 is about the frame, not about the outermost element.
 */
// Typed as the injectable bag rather than inferred: a concretely-typed spread
// makes each branch Struct concrete, and the union then stops satisfying the
// `Schema.Codec<any, any, never>` every consumer of this builder declares.
const specimenComponentField: Readonly<InjectableFields> = {
  // OPTIONAL at the field level, and required by a rule one level up. A
  // specimen draws EXACTLY ONE of `component` (this literal) or `subject` (a
  // named type the engine draws its own catalogue specimen for), and no schema
  // node sees both: `subject` is declared in `specimen.ts` while this one is
  // injected here. So "exactly one" lives in
  // `src/domain/models/app/design-console-component-validation.ts`, and marking
  // this required would refuse every named-subject specimen before that rule
  // was ever consulted.
  component: Schema.optional(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the union it points at is Schema.Codec<any, any, never>; see ComponentSchema
    Schema.suspend((): Schema.Codec<any, any, never> => SpecimenComponentSchema).pipe(
      Schema.annotate({
        title: 'Specimen Component',
        description:
          'The component this specimen draws, declared exactly as it would be on a page. The snippet beside it is projected from this same literal, so the two cannot disagree. Mutually exclusive with `subject`; exactly one is required.',
      })
    )
  ),
} as const

/**
 * The specimen union itself. Its own `children` recurse back into it, which is
 * what makes the refusal reach every depth.
 *
 * The `identifier` is declared HERE and nowhere else: a second declaration of
 * the same name erases the `$defs` entry both would resolve to.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the union it wraps is already Schema.Codec<any, any, never>; see ComponentSchema
const SpecimenComponentSchema: Schema.Codec<any, any, never> = buildComponentUnion({
  children: Schema.optional(
    Schema.Array(
      Schema.Union([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
        Schema.suspend((): Schema.Codec<any, any, never> => SpecimenComponentSchema),
        Schema.String,
      ])
    ).pipe(
      Schema.annotate({
        identifier: 'SpecimenChildren',
        title: 'Specimen Child Components',
        description: 'Child components of the drawn component, or text strings',
      })
    )
  ),
}).pipe(
  Schema.check(refusesUndrawableType),
  Schema.annotate({
    identifier: 'SpecimenComponent',
    title: 'Specimen Component',
    description: 'A component a design-system specimen may draw',
  })
)
