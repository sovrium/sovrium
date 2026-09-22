/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * Form name schema — kebab-case, URL-safe, matches FormNameSchema in the
 * domain layer. Used as the canonical reference for `formRef` and form trigger.
 */
export const formNameSchema = Schema.String.annotate({
  description: 'Kebab-case unique form name',
}).pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64), Schema.isPattern(/^[a-z][a-z0-9-]*$/))
)

/**
 * Layout mode for form rendering.
 */
export const formLayoutSchema = Schema.Literals([
  'single-page',
  'multi-step',
  'one-question',
]).annotate({ description: 'Form rendering layout' })

/**
 * Compact form summary used in list endpoints.
 */
export const formSummarySchema = Schema.Struct({
  id: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  name: formNameSchema,
  title: Schema.String,
  path: optionalField(Schema.String),
  accessLevel: Schema.Literals(['public', 'authenticated', 'role-restricted']),
  isOpen: Schema.Boolean,
}).annotate({ identifier: 'FormSummary' })

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type FormName = typeof formNameSchema.Type
/** @public */
export type FormLayout = typeof formLayoutSchema.Type
/** @public */
export type FormSummary = typeof formSummarySchema.Type
