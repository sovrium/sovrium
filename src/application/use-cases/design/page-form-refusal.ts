/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form drawn as the server refused its submission (`--state
 * <page>:form.<name>=refused`): the form as the page draws it, every field
 * kept, with the refusal banner the form's runtime shows at its top, an alert
 * a reader's assistive technology announces.
 */

/** The refusal a form shows when the server turns its submission down. */
const REFUSAL = 'The server refused this submission. Check the fields and try again.'

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A drawing with the refusal banner opening the named form; unchanged when it
 * names none, or draws no such form.
 *
 * @param body - the page as drawn.
 * @param form - the form the server refused.
 */
export const withRefusedForm = (body: string, form: string | undefined): string => {
  if (form === undefined) return body
  const opening = new RegExp(`<form\\b[^>]*\\sdata-form-name="${escapeRegExp(form)}"[^>]*>`)
  return body.replace(
    opening,
    (tag) =>
      `${tag}<div data-form-error-message="${form}" role="alert" class="form-error-banner">${REFUSAL}</div>`
  )
}
