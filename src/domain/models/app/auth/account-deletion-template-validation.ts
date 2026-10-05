/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A custom `accountDeletion` template must carry the confirmation link.
 *
 * While immediate account deletion is on, the `accountDeletion` email is the
 * request that asks the user to confirm, and `$url` is the only way to do so.
 * A custom template replaces the default whole, so a template with no `$url`
 * in a body it supplies — or with no body at all — mails a confirmation that
 * can never be confirmed. The config is refused at decode so `validate` and
 * the server's start refuse it alike, before anything is mailed.
 *
 * `$url` is matched the way the email substituter matches it (`\$url\b`), so
 * `$urls` does not count. The subject is not checked: a subject is not
 * clickable. With `immediateAccountDeletion: false` the email is never sent,
 * and nothing is checked. The message quotes no template content.
 */

/** The slice of an `auth` block the check reads. */
export interface AccountDeletionTemplateConfig {
  readonly immediateAccountDeletion?: boolean
  readonly emailTemplates?: {
    readonly accountDeletion?: {
      readonly subject: string
      readonly text?: string
      readonly html?: string
    }
  }
}

const URL_VARIABLE = /\$url\b/

const WAYS_OUT =
  'add $url, remove the template to send the default one, or set auth.immediateAccountDeletion: false'

/**
 * Returns the refusal message for a custom `accountDeletion` template that
 * carries no confirmation link, or `undefined` when the config is acceptable.
 */
export const validateAccountDeletionTemplateLink = (
  config: AccountDeletionTemplateConfig
): string | undefined => {
  if (config.immediateAccountDeletion === false) return undefined
  const template = config.emailTemplates?.accountDeletion
  if (template === undefined) return undefined

  const suppliedParts = (['text', 'html'] as const).filter((part) => template[part] !== undefined)
  if (suppliedParts.length === 0) {
    return `auth.emailTemplates.accountDeletion has no body (no text, no html), so it cannot carry $url, the confirmation link without which the deletion can never be confirmed: ${WAYS_OUT}`
  }

  const partWithoutLink = suppliedParts.find((part) => !URL_VARIABLE.test(template[part] ?? ''))
  return partWithoutLink === undefined
    ? undefined
    : `auth.emailTemplates.accountDeletion.${partWithoutLink} does not contain $url, the confirmation link without which the deletion can never be confirmed: ${WAYS_OUT}`
}
