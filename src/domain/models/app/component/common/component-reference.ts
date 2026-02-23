/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
 * @see specs/app/components/common/component-reference.schema.json#/properties/$ref
 */
export const ComponentReferenceNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]*$/, {
    message: () =>
      'Component reference name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens (kebab-case)',
  }),
  Schema.annotations({
    title: 'Component Reference Name',
    description: 'Name of the component to reference (kebab-case)',
    examples: ['icon-badge', 'section-header', 'call-to-action'],
  })
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
 * @see specs/app/components/common/component-reference.schema.json#/properties/vars
 */
export const ComponentVarsSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Component variable key must start with a letter and contain only alphanumeric characters',
    }),
    Schema.annotations({
      title: 'Component Variable Key',
      description: 'Variable name (alphanumeric)',
      examples: ['color', 'icon', 'text', 'titleColor'],
    })
  ),
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Component Variables',
    description: 'Variables to substitute in the component template',
  })
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
  Schema.annotations({
    title: 'Simple Component Reference',
    description: 'Reference to a component by name without variable substitution',
  })
)

/**
 * Component Reference (reference to a reusable component template with variable substitution)
 *
 * Allows referencing and customizing predefined component templates.
 * Supports two syntaxes:
 * 1. Full syntax: { $ref: 'component-name', vars: {...} }
 * 2. Shorthand syntax: { component: 'component-name' } (vars default to empty object)
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
 * // Shorthand syntax
 * const reference2 = {
 *   component: 'shared-component',
 * }
 * ```
 *
 * @see specs/app/components/common/component-reference.schema.json
 */
const FullComponentReferenceSchema = Schema.Struct({
  $ref: ComponentReferenceNameSchema,
  vars: ComponentVarsSchema,
}).pipe(
  Schema.annotations({
    title: 'Component Reference (Full Syntax)',
    description: 'Reference to a reusable component template with variable substitution',
  })
)

const ShorthandComponentReferenceSchema = Schema.Struct({
  component: ComponentReferenceNameSchema,
}).pipe(
  Schema.annotations({
    title: 'Component Reference (Shorthand)',
    description: 'Shorthand reference to a reusable component without variables',
  })
)

const HybridComponentReferenceSchema = Schema.Struct({
  component: ComponentReferenceNameSchema,
  vars: ComponentVarsSchema,
}).pipe(
  Schema.annotations({
    title: 'Component Reference (Hybrid)',
    description: 'Shorthand component reference with variable substitution',
  })
)

export const ComponentReferenceSchema = Schema.Union(
  FullComponentReferenceSchema,
  HybridComponentReferenceSchema,
  ShorthandComponentReferenceSchema
).pipe(
  Schema.annotations({
    title: 'Component Reference',
    description:
      'Reference to a reusable component template. Supports full syntax ($ref + vars), hybrid syntax (component + vars), or shorthand (component name only).',
  })
)

export type ComponentReferenceName = Schema.Schema.Type<typeof ComponentReferenceNameSchema>
export type ComponentVars = Schema.Schema.Type<typeof ComponentVarsSchema>
export type SimpleComponentReference = Schema.Schema.Type<typeof SimpleComponentReferenceSchema>
export type ComponentReference = Schema.Schema.Type<typeof ComponentReferenceSchema>
