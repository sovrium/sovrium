/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const SuccessPageActionSchema = Schema.Struct({
  label: Schema.String.pipe(Schema.minLength(1)),
  action: Schema.Literal('reset', 'navigate'),
  url: Schema.optional(Schema.String),
}).annotations({
  identifier: 'SuccessPageAction',
  title: 'Success Page Action',
})

export const SuccessPageOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('successPage'),
  title: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  buttonLabel: Schema.optional(Schema.String),
  buttonHref: Schema.optional(Schema.String),
  actions: Schema.optional(Schema.Array(SuccessPageActionSchema)),
  showSummary: Schema.optional(Schema.Boolean),
}).annotations({
  identifier: 'SuccessPageOnSuccess',
  title: 'Success Page (onSuccess)',
})

export const RedirectOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('redirect'),
  url: Schema.String.pipe(Schema.minLength(1)),
  delaySeconds: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
}).annotations({
  identifier: 'RedirectOnSuccess',
  title: 'Redirect (onSuccess)',
})

export const ResetOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('reset'),
  message: Schema.optional(Schema.String),
  preserveFields: Schema.optional(Schema.Array(Schema.String)),
}).annotations({
  identifier: 'ResetOnSuccess',
  title: 'Reset (onSuccess)',
})

export const ToastOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('toast'),
  message: Schema.String,
  variant: Schema.optional(Schema.Literal('success', 'info')),
}).annotations({
  identifier: 'ToastOnSuccess',
  title: 'Toast (onSuccess)',
})

export const MessageOnSuccessSchema = Schema.Struct({
  type: Schema.Literal('message'),
  message: Schema.String,
}).annotations({
  identifier: 'MessageOnSuccess',
  title: 'Inline Message (onSuccess)',
})

export const FormOnSuccessSchema = Schema.Union(
  SuccessPageOnSuccessSchema,
  RedirectOnSuccessSchema,
  ResetOnSuccessSchema,
  ToastOnSuccessSchema,
  MessageOnSuccessSchema
).annotations({
  identifier: 'FormOnSuccess',
  title: 'Form onSuccess',
  description: 'Post-submit behavior. Discriminated by `type`.',
})

export type SuccessPageAction = Schema.Schema.Type<typeof SuccessPageActionSchema>
export type SuccessPageOnSuccess = Schema.Schema.Type<typeof SuccessPageOnSuccessSchema>
export type RedirectOnSuccess = Schema.Schema.Type<typeof RedirectOnSuccessSchema>
export type ResetOnSuccess = Schema.Schema.Type<typeof ResetOnSuccessSchema>
export type ToastOnSuccess = Schema.Schema.Type<typeof ToastOnSuccessSchema>
export type MessageOnSuccess = Schema.Schema.Type<typeof MessageOnSuccessSchema>
export type FormOnSuccess = Schema.Schema.Type<typeof FormOnSuccessSchema>
