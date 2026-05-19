/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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

export const SimpleComponentReferenceSchema = Schema.Struct({
  component: ComponentReferenceNameSchema,
}).pipe(
  Schema.annotations({
    title: 'Simple Component Reference',
    description: 'Reference to a component by name without variable substitution',
  })
)

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

const ComponentNestedVariablesSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    title: 'Component Nested Variables',
    description: 'Variables with nested object support for dot-notation substitution',
  })
)

const ComponentReferenceWithVariablesSchema = Schema.Struct({
  component: ComponentReferenceNameSchema,
  variables: ComponentNestedVariablesSchema,
}).pipe(
  Schema.annotations({
    title: 'Component Reference (With Variables)',
    description: 'Shorthand component reference with nested variable substitution',
  })
)

export const ComponentReferenceSchema = Schema.Union(
  FullComponentReferenceSchema,
  HybridComponentReferenceSchema,
  ComponentReferenceWithVariablesSchema,
  ShorthandComponentReferenceSchema
).pipe(
  Schema.annotations({
    title: 'Component Reference',
    description:
      'Reference to a reusable component template. Supports full syntax ($ref + vars), hybrid syntax (component + vars), variables syntax (component + variables), or shorthand (component name only).',
  })
)

export type ComponentReferenceName = Schema.Schema.Type<typeof ComponentReferenceNameSchema>
export type ComponentVars = Schema.Schema.Type<typeof ComponentVarsSchema>
export type SimpleComponentReference = Schema.Schema.Type<typeof SimpleComponentReferenceSchema>
export type ComponentReference = Schema.Schema.Type<typeof ComponentReferenceSchema>
