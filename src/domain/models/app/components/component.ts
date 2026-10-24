/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { buildComponentUnion, ComponentTypeSchema } from '../pages/components/component-types'
import { RESERVED_TOKEN_NAMESPACES } from '../pages/substitute-record-vars'
import { ComponentChildrenSchema, ComponentSlotSchema } from './children'
import { ComponentGuidanceSchema } from './guidance'
import { ComponentReferenceNameSchema } from './reference'

/**
 * Component template name identifier (same pattern as component reference name)
 *
 * Must be in kebab-case:
 * - Start with lowercase letter
 * - Contain only lowercase letters, numbers, and hyphens
 * - Names the placed template's root: `data-component="{name}"`, and
 *   `data-testid="component-{name}"` (with an index suffix when the template is
 *   placed more than once) unless the template's own `props` declare a
 *   `data-testid`, which wins
 *
 * @example
 * ```typescript
 * const names = ['icon-badge', 'section-header', 'feature-card', 'cta-button-2']
 * ```
 */
export const ComponentTemplateNameSchema = ComponentReferenceNameSchema.annotate({
  title: 'Component Template Name',
  description:
    'Unique component template identifier in kebab-case. A placed template\'s root carries `data-testid="component-<name>"` (with an index suffix when it is placed more than once) unless its own `props` declare a `data-testid`, which wins.',
  examples: ['icon-badge', 'section-header', 'feature-card', 'cta-button-2'],
})

/**
 * How a placed template draws its root.
 *
 * `named` (the default) is what a placement has always drawn: the root is
 * named by its template — `data-component`, `data-type` and a
 * `component-<name>` test id. `transparent` draws none of them and keeps
 * every attribute the inline tree takes, so a placed template is
 * byte-identical to its tree written inline at the same position: the form an
 * app's own furniture (a shell, a grid, a tab strip) takes. A transparent
 * template is not listed on the Design System pages, and a design tool still
 * treats it as a template it may not edit inside.
 */
export const TemplateRenderSchema = Schema.Literals(['named', 'transparent']).annotate({
  title: 'Template Render Mode',
  description:
    "How a placed template draws its root. `named` marks it with the template's name (`data-component`, `data-type` and a `component-<name>` test id). `transparent` draws exactly what the same tree draws written inline at that position, and keeps the template off the Design System pages.",
  defaultNote: 'named',
  examples: ['transparent'],
})

/**
 * The names an input cannot take: each would hide a binding source inside the
 * template, because a declared input replaces every `$<name>` token written in
 * it, `$<name>.` and `$<name>:` included.
 *
 * Built from the page grammar's own namespace list
 * ({@link RESERVED_TOKEN_NAMESPACES}) plus every other root a page resolver
 * reads — design tokens, invitation and front-matter values, a collection's
 * neighbours, a sign-in form's fields, a fetch action's response, env
 * references, the relative-date tokens of a filter — and the two slot
 * keywords. A template's own placeholder words (`$label`, `$value`) are not
 * roots and stay free.
 */
export const RESERVED_TEMPLATE_INPUT_NAMES: readonly string[] = [
  ...RESERVED_TOKEN_NAMESPACES,
  'design',
  'invitation',
  'frontmatter',
  'collection',
  'form',
  'response',
  'env',
  'today',
  'now',
  'startOfMonth',
  'startOfNextMonth',
  'children',
  'slots',
]

const RESERVED_INPUT_NAMES: ReadonlySet<string> = new Set(RESERVED_TEMPLATE_INPUT_NAMES)

/** One input's name: the `$name` a template writes, kebab-free so `$name` reads as one token. */
const TemplateInputNameSchema = Schema.String.annotate({
  title: 'Template Input Name',
  description:
    'The name a template writes as `$name`: a letter, then letters and digits. The name of a binding source a page resolves (`record`, `parent`, `param`, `query`, `t`, `app`, `user`, `currentUser`, `session`, `window`, `vars`, `design`, `invitation`, `frontmatter`, `collection`, `form`, `response`, `env`) or of a relative-date token (`today`, `now`, `startOfMonth`, `startOfNextMonth`) is refused, as are the slot keywords `children` and `slots`.',
  examples: ['columns', 'dataSource', 'trail'],
}).check(
  Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
    message: 'A template input name starts with a letter and holds only letters and digits',
  }),
  Schema.makeFilter(
    (name: string) =>
      !RESERVED_INPUT_NAMES.has(name) ||
      `A template input cannot be named "${name}": that name is a binding source or a slot keyword, which it would hide inside the template`
  )
)

/**
 * One declared input of a template.
 *
 * `text`, `number` and `boolean` take a scalar, which may also be written
 * inside a longer string (`'grid-$id'`). `json` takes any JSON value and fills
 * a field whose WHOLE value is `$name`, at any depth: a root field such as
 * `columns` or `dataSource`, a prop, an array element. `slot` declares a named
 * slot, marked `children: $slots.<name>` and filled from the placement's
 * `slots.<name>`.
 */
export const TemplateInputSchema = Schema.Struct({
  kind: Schema.Literals(['text', 'number', 'boolean', 'json', 'slot']).annotate({
    description:
      'What the input takes: `text`, `number` or `boolean` for a scalar, `json` for any JSON value filling a whole field, `slot` for components the page passes to the slot `children: $slots.<name>` marks.',
  }),
  required: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Whether a placement must pass the input. A required input left out is refused at startup; an optional one left out removes every field whose whole value names it.',
      defaultNote: 'false',
    })
  ),
  description: Schema.optional(
    Schema.String.annotate({
      description: "What the input is for, shown beside it on the template's Design System page.",
    })
  ),
}).annotate({
  title: 'Template Input',
  description: 'One value a placement passes to the template, and what kind of value it is.',
})

/**
 * The inputs a template declares.
 *
 * Declaring inputs is what opts a template into structured substitution: a
 * template without `inputs` substitutes exactly as it always has (strings, in
 * `props`, `content`, `children` and the current-item marker). Each placed
 * node of a template that declares inputs is decoded as a page component at
 * startup, which is where a value of the wrong shape is refused.
 */
export const TemplateInputsSchema = Schema.Record(Schema.String, TemplateInputSchema).pipe(
  Schema.annotate({
    title: 'Template Inputs',
    description:
      'The values a placement passes, by name. A template that declares inputs may write `$name` as the whole value of any field, at any depth, including fields such as `columns`, `dataSource`, `panels` or `action`; the placement passes the value in `vars`. A value is inserted as written and never substituted again, so its `$t:` keys and binding tokens are resolved by the page exactly as if they were written inline. `$$` writes a literal `$`.',
    examples: [
      {
        label: { kind: 'text', required: true },
        columns: { kind: 'json' },
        trail: { kind: 'slot' },
      },
    ],
  }),
  Schema.check(
    Schema.isPropertyNames(TemplateInputNameSchema, {
      toJsonSchema: () => ({
        propertyNames: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9]*$' },
      }),
    })
  )
)

/** The keys every template branch carries beside its component fields. */
const templateFields = {
  name: ComponentTemplateNameSchema,
  guidance: Schema.optional(ComponentGuidanceSchema),
  render: Schema.optional(TemplateRenderSchema),
  inputs: Schema.optional(TemplateInputsSchema),
}

/**
 * Reusable UI component template with variable placeholders
 *
 * A component template defines the structure of a reusable component that can be
 * instantiated multiple times with different data via component references.
 *
 * Uses a discriminated union: each component type only accepts properties
 * relevant to its category (e.g., data-table accepts columns but not chartType).
 *
 * Required properties:
 * - name: Unique identifier (kebab-case)
 * - type: Component type (discriminated by category)
 *
 * Optional properties:
 * - props: Component properties (may contain $variable placeholders)
 * - children: Nested child components, or `$children` — the slot a placing
 *   reference fills with the page's own components (see `ComponentSlotSchema`)
 * - content: Text content (may contain $variable placeholders)
 * - guidance: What it is, when to reach for it, and the misuse to refuse
 *
 * `guidance` is injected here rather than into the per-type field records
 * because it is a property of the TEMPLATE, not of any component type: an
 * inline `{ type: 'badge' }` inside a page has no name to be documented under
 * and nothing to say beside a specimen. It sits alongside `name` for exactly
 * that reason — the two are the pair that makes a component template a
 * REUSABLE, referenceable thing rather than a one-off node.
 *
 * @example
 * ```typescript
 * const component = {
 *   name: 'icon-badge',
 *   type: 'badge',
 *   props: { color: '$color' },
 *   children: [
 *     { type: 'icon', props: { name: '$icon', size: 4 } },
 *     { type: 'text', props: { level: 'span' }, content: '$text' }
 *   ]
 * }
 * ```
 *
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Discriminated union with recursive children requires any
const FullTemplateSchema: Schema.Codec<any, any, never> = buildComponentUnion(
  {
    // `$children` here makes the template's root itself the slot: the template
    // is then a frame — its own type, props and classes — around the page's
    // components, with nothing of its own inside.
    children: Schema.optional(
      Schema.Union([ComponentChildrenSchema, ComponentSlotSchema]).annotate({
        description:
          "The template's child elements — components or text strings, with `$variable` placeholders — or `$children`, which makes the template's root its slot: a frame around the page components a placement passes as `children`.",
      })
    ),
  },
  templateFields
)

/**
 * A template that declares `inputs` and names one where its component type
 * expects another shape — `columns: $columns`, `panels: $panels`.
 *
 * Its component fields are NOT decoded here, because a field holding `$name`
 * only takes its shape once a placement passes the value. Each placed node is
 * decoded as a page component at startup instead, so the check still happens,
 * once per placement, with the placement named. A template whose inputs are all
 * written where a string belongs decodes through the full template union above.
 */
const InputTemplateSchema = Schema.StructWithRest(
  Schema.Struct({
    name: ComponentTemplateNameSchema,
    type: ComponentTypeSchema,
    guidance: Schema.optional(ComponentGuidanceSchema),
    render: Schema.optional(TemplateRenderSchema),
    inputs: TemplateInputsSchema,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
).annotate({
  title: 'Component Template With Inputs',
  description:
    'A template that declares inputs and writes `$name` in a field of another shape. Its fields are checked once placed, as the page component each placement produces.',
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Discriminated union with recursive children requires any
export const ComponentTemplateSchema: Schema.Codec<any, any, never> = Schema.Union([
  FullTemplateSchema,
  InputTemplateSchema,
]).pipe(
  Schema.annotate({
    title: 'Component Template',
    description: 'A reusable UI component template with variable placeholders',
  })
)

/** @public */
export type TemplateRender = Schema.Schema.Type<typeof TemplateRenderSchema>
/** @public */
export type TemplateInput = Schema.Schema.Type<typeof TemplateInputSchema>
/** @public */
export type TemplateInputs = Schema.Schema.Type<typeof TemplateInputsSchema>
/** @public */
export type ComponentTemplateName = Schema.Schema.Type<typeof ComponentTemplateNameSchema>
