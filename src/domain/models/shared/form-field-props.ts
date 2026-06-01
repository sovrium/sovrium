/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PermissionValueSchema } from './permissions'
import { VisibleWhenConditionSchema } from './visible-when'

export const FormFieldPermissionsSchema = Schema.Struct({
  read: Schema.optional(PermissionValueSchema),
}).annotations({
  identifier: 'FormFieldPermissions',
  title: 'Form Field Permissions',
  description: 'Per-field read permissions for admin export + detail redaction',
})

export const commonFieldProps = {
  label: Schema.optional(Schema.String),
  placeholder: Schema.optional(Schema.String),
  helpText: Schema.optional(Schema.String),
  required: Schema.optional(Schema.Boolean),
  readOnly: Schema.optional(Schema.Boolean),
  hidden: Schema.optional(Schema.Boolean),
  defaultValue: Schema.optional(Schema.Union(Schema.String, Schema.Number, Schema.Boolean)),
  visibleWhen: Schema.optional(VisibleWhenConditionSchema),
  requiredWhen: Schema.optional(VisibleWhenConditionSchema),
  disabledWhen: Schema.optional(VisibleWhenConditionSchema),
  permissions: Schema.optional(FormFieldPermissionsSchema),
} as const
