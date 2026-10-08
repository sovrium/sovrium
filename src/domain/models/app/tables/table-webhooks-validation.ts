/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Shape of a webhook relevant to table-level validation. */
interface WebhookForValidation {
  readonly name: string
  readonly payload?: {
    readonly includeFields?: ReadonlyArray<string>
    readonly excludeFields?: ReadonlyArray<string>
  }
}

type ValidationError = { readonly message: string; readonly path: ReadonlyArray<string> }

/**
 * Every column referenced by a webhook's `payload.includeFields` /
 * `excludeFields` must name a real field on the table. The implicit `id`
 * column is always valid even though it is not a declared field.
 */
const validateWebhookPayloadFields = (
  webhooks: ReadonlyArray<WebhookForValidation>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  const isKnown = (field: string): boolean => field === 'id' || fieldNames.has(field)
  const offending = webhooks.flatMap((webhook) => {
    const selectors = [
      ...(webhook.payload?.includeFields ?? []),
      ...(webhook.payload?.excludeFields ?? []),
    ]
    return selectors
      .filter((field) => !isKnown(field))
      .map((field) => ({ webhook: webhook.name, field }))
  })
  const first = offending[0]
  if (first) {
    return {
      message: `Webhook '${first.webhook}' payload references field '${first.field}' which does not exist on the table`,
      path: ['webhooks'],
    }
  }
  return undefined
}

/**
 * Webhook names must be unique within a table — each webhook expands into a
 * distinct delivery configuration keyed by name, so a duplicate name would
 * make delivery logging ambiguous. Additionally, `payload` field selectors
 * must reference real table fields.
 *
 * Returns the first problem found, or `undefined`.
 */
export const validateWebhooks = (
  webhooks: ReadonlyArray<WebhookForValidation> | undefined,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  if (!webhooks || webhooks.length === 0) return undefined

  const names = webhooks.map((webhook) => webhook.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate !== undefined) {
    return {
      message: `Duplicate webhook name '${duplicate}': webhook names must be unique within a table`,
      path: ['webhooks'],
    }
  }

  return validateWebhookPayloadFields(webhooks, fieldNames)
}
