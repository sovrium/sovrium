/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * Form name schema — kebab-case, URL-safe, matches FormNameSchema in the
 * domain layer. Used as the canonical reference for `formRef` and form trigger.
 */
export const formNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, 'must be kebab-case starting with a letter')
  .describe('Kebab-case unique form name')

/**
 * Layout mode for form rendering.
 */
export const formLayoutSchema = z
  .enum(['single-page', 'multi-step', 'one-question'])
  .describe('Form rendering layout')

/**
 * Compact form summary used in list endpoints.
 */
export const formSummarySchema = z
  .object({
    id: z.number().int().positive(),
    name: formNameSchema,
    title: z.string(),
    path: z.string().optional(),
    accessLevel: z.enum(['public', 'authenticated', 'role-restricted']),
    isOpen: z.boolean(),
  })
  .openapi('FormSummary')

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type FormName = z.infer<typeof formNameSchema>
/** @public */
export type FormLayout = z.infer<typeof formLayoutSchema>
/** @public */
export type FormSummary = z.infer<typeof formSummarySchema>
