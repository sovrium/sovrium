/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Component reference name (kebab-case identifier)
 *
 * Name of the component to reference (must match a component name in the components array).
 * Uses kebab-case format for consistency with web standards.
 *
 * @example
 * ```typescript
 * const ref1 = 'icon-badge'
 * const ref2 = 'section-header'
 * const ref3 = 'call-to-action'
 * ```
 *
 * @see [internal ref]#/properties/$ref
 */
export const ComponentReferenceNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Component Reference Name',
    description: 'Name of the component to reference (kebab-case)',
    examples: ['icon-badge', 'section-header', 'call-to-action'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-z][a-z0-9-]*$/, {
      message:
        'Component reference name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens (kebab-case)',
    })
  )
)

/**
 * Component variables (for template substitution)
 *
 * Variables to substitute in the component template.
 * Keys are alphanumeric identifiers, values are strings, numbers, or booleans.
 *
 * @example
 * ```typescript
 * const vars = {
 *   color: 'orange',
 *   icon: 'users',
 *   text: '6 à 15 personnes',
 *   count: 10,
 *   enabled: true,
 * }
 * ```
 *
 * @see [internal ref]#/properties/vars
 */
const ComponentVarKeySchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Component Variable Key',
    description: 'Variable name (alphanumeric)',
    examples: ['color', 'icon', 'text', 'titleColor'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message:
        'Component variable key must start with a letter and contain only alphanumeric characters',
    })
  )
)

export const ComponentVarsSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
).pipe(
  Schema.annotate({
    title: 'Component Variables',
    description: 'Variables to substitute in the component template',
  }),
  // Keys: any string in the key position, and the pattern enforced by
  // `isPropertyNames`, so a mistyped key is refused by name at its own path
  // with the pattern it must match. A pattern on the key schema itself makes
  // Effect 4 skip the entry, and the config report then named it an unknown
  // property with nothing accepted. The JSON Schema rendering keeps the pattern.
  Schema.check(
    Schema.isPropertyNames(ComponentVarKeySchema, {
      toJsonSchema: () => ({
        propertyNames: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9]*$' },
      }),
    })
  )
)

/**
 * Simple Component Reference (reference to a component by name without variables)
 *
 * Simplified syntax for referencing components that don't require variable substitution.
 * Uses the `component` property to identify the component by name.
 *
 * @example
 * ```typescript
 * const simpleReference = {
 *   component: 'shared-component'
 * }
 * ```
 */
export const SimpleComponentReferenceSchema = Schema.Struct({
  component: ComponentReferenceNameSchema,
}).pipe(
  Schema.annotate({
    title: 'Simple Component Reference',
    description: 'Reference to a component by name without variable substitution',
  })
)

/**
 * Component nested variables (for deep object variable substitution)
 *
 * Variables with nested object support for dot-notation access ($user.name).
 * Values can be any type including nested objects.
 */
const ComponentNestedVariablesSchema = Schema.Record(Schema.String, Schema.Unknown).pipe(
  Schema.annotate({
    title: 'Component Nested Variables',
    description: 'Variables with nested object support for dot-notation substitution',
  })
)

/**
 * The page items a reference hands to its template's slot.
 *
 * Declared by the CALLER of {@link buildComponentReferenceSchema} rather than
 * here: the items are page components, and the page component schema
 * (`pages/components/component.ts`) itself places references — importing it
 * from this module would close an import cycle whose evaluation order decides
 * whether a union member is still in its temporal dead zone.
 */
export type ComponentReferenceChildrenSchema = Schema.Codec<
  ReadonlyArray<unknown>,
  ReadonlyArray<unknown>,
  never
>

/** The `children` key every reference form carries — see {@link buildComponentReferenceSchema}. */
const referenceChildrenField = (children: ComponentReferenceChildrenSchema) =>
  Schema.optional(
    children.annotate({
      description:
        "The page's own components for the template's slot. The template marks the slot by writing `children: $children` on one of its nodes; these components fill it, read in the page's scope — the page's record, `$t:` keys and visibility rules — and never receive the template's `vars`. A template with no slot refuses them.",
    })
  )

/**
 * Component Reference (reference to a reusable component template with variable substitution)
 *
 * Allows referencing and customizing predefined component templates.
 * Supports four syntaxes:
 * 1. Full syntax: { $ref: 'component-name', vars: {...} } (vars optional; absent means no values)
 * 2. Hybrid syntax: { component: 'component-name', vars: {...} }
 * 3. Variables syntax: { component: 'component-name', variables: {...} }
 * 4. Shorthand syntax: { component: 'component-name' } (vars default to empty object)
 *
 * Every form also takes `children`: the page components that fill the
 * template's `$children` slot (see `ComponentSlotSchema` in `./children`).
 *
 * Built by a factory because the slot's items are page components, which are
 * declared where pages are — `pages/components/component.ts` builds the one
 * instance the AppSchema decodes, as `ComponentReferenceSchema`.
 *
 * @example
 * ```typescript
 * // Full syntax
 * const reference1 = {
 *   $ref: 'icon-badge',
 *   vars: {
 *     color: 'orange',
 *     icon: 'users',
 *     text: '6 à 15 personnes',
 *   },
 * }
 *
 * // Shorthand syntax, filling the template's slot
 * const reference2 = {
 *   component: 'app-shell',
 *   children: [{ type: 'text', element: 'h1', content: 'Invoices' }],
 * }
 * ```
 */
export const buildComponentReferenceSchema = (children: ComponentReferenceChildrenSchema) =>
  Schema.Union([
    Schema.Struct({
      $ref: ComponentReferenceNameSchema,
      // Optional: a template with no `$variable` placeholders is placed with a bare
      // `{ $ref: name }`. An absent `vars` is read as no values, exactly like `{}`.
      vars: Schema.optional(
        ComponentVarsSchema.pipe(
          Schema.annotate({
            description:
              "Values for the template's `$variable` placeholders. Omit it for a template that has none.",
            defaultNote: '{}',
          })
        )
      ),
      children: referenceChildrenField(children),
    }).pipe(
      Schema.annotate({
        title: 'Component Reference (Full Syntax)',
        description: 'Reference to a reusable component template with variable substitution',
      })
    ),
    Schema.Struct({
      component: ComponentReferenceNameSchema,
      vars: ComponentVarsSchema,
      children: referenceChildrenField(children),
    }).pipe(
      Schema.annotate({
        title: 'Component Reference (Hybrid)',
        description: 'Shorthand component reference with variable substitution',
      })
    ),
    Schema.Struct({
      component: ComponentReferenceNameSchema,
      variables: ComponentNestedVariablesSchema,
      children: referenceChildrenField(children),
    }).pipe(
      Schema.annotate({
        title: 'Component Reference (With Variables)',
        description: 'Shorthand component reference with nested variable substitution',
      })
    ),
    Schema.Struct({
      component: ComponentReferenceNameSchema,
      children: referenceChildrenField(children),
    }).pipe(
      Schema.annotate({
        title: 'Component Reference (Shorthand)',
        description: 'Shorthand reference to a reusable component without variables',
      })
    ),
  ]).pipe(
    Schema.annotate({
      title: 'Component Reference',
      description:
        "Reference to a reusable component template. Supports full syntax ($ref + vars), hybrid syntax (component + vars), variables syntax (component + variables), or shorthand (component name only). Any form may pass `children` to fill the template's `$children` slot.",
    })
  )

/** @public */
export type ComponentReferenceName = Schema.Schema.Type<typeof ComponentReferenceNameSchema>
/** @public */
export type ComponentVars = Schema.Schema.Type<typeof ComponentVarsSchema>
export type SimpleComponentReference = Schema.Schema.Type<typeof SimpleComponentReferenceSchema>
export type ComponentReference = Schema.Schema.Type<
  ReturnType<typeof buildComponentReferenceSchema>
>
