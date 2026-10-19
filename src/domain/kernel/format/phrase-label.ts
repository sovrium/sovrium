/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A label as it reads INSIDE a phrase written in sentence case: "New quote",
 * never "New Quote". A label is declared as it stands alone (`Quote`), so a
 * heading that places it after other words lowers its first letter — unless
 * it opens on an acronym (two leading capitals, `VAT rate`), which keeps it.
 */

/** Two leading capitals: the label opens on an acronym and keeps its case. */
const OPENS_ON_ACRONYM = /^\p{Lu}\p{Lu}/u

/** `Quote` → `quote`; `VAT rate` stays. */
export const labelInPhrase = (label: string): string =>
  OPENS_ON_ACRONYM.test(label) ? label : `${label.charAt(0).toLocaleLowerCase()}${label.slice(1)}`

/**
 * The label to put in `template` at `placeholder`: lowered when the placeholder
 * sits after other words, as-is when it opens the phrase or follows a colon
 * (`Nouvel enregistrement : {label}`), where a capital is where it belongs.
 */
export const labelForPhrase = (template: string, placeholder: string, label: string): string => {
  const before = template.slice(0, Math.max(0, template.indexOf(placeholder))).trimEnd()
  return before === '' || before.endsWith(':') ? label : labelInPhrase(label)
}
