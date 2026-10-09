/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The browser autofill hint a form field's input carries.
 *
 * Derived from the field's TYPE only — an email field, a phone field, a link
 * field — and never from its name: a `name` column on a product form is not a
 * person's name, and a wrong hint is worse than none because the browser fills
 * it confidently. A `password` control derives nothing: only the author knows
 * whether it asks for the current password or a new one.
 *
 * The keys cover the three vocabularies that name a field's kind: a table
 * column type (`phone-number`), a hosted form's standalone input type (`phone`)
 * and an HTML input type / page form control (`tel`).
 */
const DERIVED_AUTOFILL_HINTS: Readonly<Record<string, string>> = {
  email: 'email',
  'phone-number': 'tel',
  phone: 'tel',
  tel: 'tel',
  url: 'url',
}

/**
 * The hint a field's input carries: the author's own `autocomplete` when she
 * declared one (`off` included), else the one its kind implies, else none.
 */
export const resolveAutofillHint = (
  kind: string | undefined,
  declared: string | undefined
): string | undefined =>
  declared ??
  (kind !== undefined && Object.hasOwn(DERIVED_AUTOFILL_HINTS, kind)
    ? DERIVED_AUTOFILL_HINTS[kind]
    : undefined)

/** {@link resolveAutofillHint} as a spreadable `{ autocomplete }`, empty when there is none. */
export const autofillHintOverlay = (
  kind: string | undefined,
  declared: string | undefined
): { readonly autocomplete?: string } => {
  const autocomplete = resolveAutofillHint(kind, declared)
  return autocomplete === undefined ? {} : { autocomplete }
}
