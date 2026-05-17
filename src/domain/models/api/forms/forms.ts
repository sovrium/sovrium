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
 * Public field info — what the client needs to render a field.
 *
 * Excludes server-only concerns (visibleWhen evaluation, prefill resolution).
 * The client-side renderer evaluates visibility/required-when on the resolved values.
 */
export const formFieldResponseSchema = z
  .object({
    name: z.string().min(1).describe('Field name (unique within the form)'),
    label: z.string().describe('Display label'),
    helpText: z.string().optional().describe('Help text shown below the field'),
    placeholder: z.string().optional().describe('Placeholder text'),
    inputType: z
      .enum([
        'short-text',
        'long-text',
        'email',
        'url',
        'number',
        'date',
        'datetime',
        'select',
        'multi-select',
        'checkbox',
        'radio',
        'rating',
        'signature',
        'attachment',
      ])
      .describe('Input control type'),
    required: z.boolean().default(false).describe('Whether the field is required'),
    options: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .optional()
      .describe('Choices for select/multi-select/radio fields'),
    accept: z
      .string()
      .optional()
      .describe('MIME types or extensions accepted for attachment fields'),
    maxFiles: z.number().int().min(1).optional().describe('Max files for multi-attachment'),
    defaultValue: z.unknown().optional().describe('Resolved default value (server-rendered)'),
  })
  .openapi('FormFieldResponse')

/**
 * Step info for multi-step layouts.
 */
export const formStepResponseSchema = z
  .object({
    id: z.string().min(1).describe('Step identifier'),
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(z.string()).min(1).describe('Field names contained in this step (in order)'),
  })
  .openapi('FormStepResponse')

/**
 * Full form definition as returned by `GET /api/forms/{name}`.
 *
 * This is the contract the client renderer reads to display the form.
 * Excludes server-only concerns (submitTo, automation references).
 */
export const formResponseSchema = z
  .object({
    id: z.number().int().positive().describe('Numeric form identifier'),
    name: formNameSchema,
    title: z.string().describe('Form title shown to submitters'),
    description: z.string().optional().describe('Form description / intro'),
    path: z
      .string()
      .regex(/^\//, 'must start with /')
      .optional()
      .describe('Custom public path (when omitted, only /forms/{name} is served)'),
    layout: formLayoutSchema.default('single-page'),
    fields: z.array(formFieldResponseSchema).min(1).describe('Field list in render order'),
    steps: z.array(formStepResponseSchema).optional().describe('Steps for multi-step layouts'),
    accessLevel: z
      .enum(['public', 'authenticated', 'role-restricted'])
      .describe('Resolved access requirement level'),
    availability: z
      .object({
        opensAt: z.iso.datetime().optional(),
        closesAt: z.iso.datetime().optional(),
        maxSubmissions: z.number().int().positive().optional(),
        isOpen: z.boolean().describe('Whether the form is currently accepting submissions'),
      })
      .optional()
      .describe('Resolved availability window and current open state'),
    antiSpam: z
      .object({
        honeypotFieldName: z
          .string()
          .optional()
          .describe('Hidden honeypot field name to render (when enabled)'),
        captchaProvider: z
          .string()
          .optional()
          .describe('CAPTCHA connection name to invoke client-side (Phase 3)'),
      })
      .optional(),
    onSuccess: z
      .object({
        type: z.enum(['successPage', 'redirect', 'reset', 'toast', 'message']),
        message: z.string().optional(),
        redirectUrl: z.string().optional(),
      })
      .optional()
      .describe('Post-submit behavior'),
    share: z
      .object({
        embeddable: z.boolean(),
        allowedOrigins: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .openapi('FormResponse')

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
 * Response shape for `GET /api/forms` — list of all forms.
 */
export const formListResponseSchema = z
  .object({
    items: z.array(formSummarySchema),
    total: z.number().int().min(0),
  })
  .openapi('FormListResponse')

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type FormName = z.infer<typeof formNameSchema>
/** @public */
export type FormLayout = z.infer<typeof formLayoutSchema>
/** @public */
export type FormFieldResponse = z.infer<typeof formFieldResponseSchema>
/** @public */
export type FormStepResponse = z.infer<typeof formStepResponseSchema>
/** @public */
export type FormResponse = z.infer<typeof formResponseSchema>
/** @public */
export type FormSummary = z.infer<typeof formSummarySchema>
/** @public */
export type FormListResponse = z.infer<typeof formListResponseSchema>
