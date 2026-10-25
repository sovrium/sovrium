/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The keys removed from a hosted form (`forms[]`), and what replaces each.
 *
 * `disabledWhen` on a hosted form field was accepted and never applied: the
 * field stayed editable and the server stored whatever it received for it.
 * Deprecated with a warning in 0.43, refused from 0.44 ([internal ref]: one warning
 * release, then a refusal). Buttons, button fields and row actions keep their
 * own `disabledWhen`, which they do apply; only the hosted form field loses it.
 */

/**
 * The node path of one field of a hosted form. A page `form` component's
 * fields sit under `components[]` / `children[]` and are answered by the page
 * form's own removed-keys module.
 */
const HOSTED_FORM_FIELD_PATH = /^forms\[\d+\]\.fields\[\d+\]$/

/** Keys removed from one entry of `forms[].fields[]`. */
const REMOVED_ON_HOSTED_FORM_FIELD: ReadonlyMap<string, string> = new Map([
  [
    'disabledWhen',
    '`disabledWhen` has been removed from hosted form fields: it never had an effect there. To take a field out under a condition, use `visibleWhen`, which takes the same condition; a field it hides is neither validated nor sent.',
  ],
])

/**
 * The migration message for a key removed from a hosted form, or `undefined`
 * when this module has nothing to say about it.
 *
 * @param path - Dotted path of the NODE holding the key, e.g. `forms[0].fields[1]`.
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedHostedFormKey = (
  path: string,
  key: string
): string | undefined =>
  HOSTED_FORM_FIELD_PATH.test(path) ? REMOVED_ON_HOSTED_FORM_FIELD.get(key) : undefined

/** Every removed key, for the test that pins each message names its replacement. @internal */
export const REMOVED_HOSTED_FORM_FIELD_KEYS: readonly string[] = [
  ...REMOVED_ON_HOSTED_FORM_FIELD.keys(),
]
