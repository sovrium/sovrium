/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page `form` component keys that no longer exist, and what replaces each.
 *
 * ## The decision these messages carry
 *
 * Two form surfaces, one job each. A top-level `forms[]` entry TAKES SOMETHING
 * IN: a submission with its own address, a row in the Submissions inbox,
 * anti-spam, an opening window or a cap, its own access rule, a one-question or
 * multi-step layout, conditional fields, file uploads, a success page. The page
 * `form` component WORKS ON DATA ALREADY IN THE APP: it edits the record a page
 * shows, posts to an endpoint of the author's own, or signs someone in or up.
 * To add a record from inside an app page, the form is declared in `forms[]`
 * and placed with `formRef` — the only bridge between the two.
 *
 * A second copy of the intake features behind a `crud` create action on the
 * page form would drift from the first. Each exists in `forms[]`, specified,
 * tested and documented once there; the keys are deleted rather than aliased,
 * so an author is told the destination instead of being offered two spellings.
 *
 * ## What a message has to do
 *
 * Name the replacement a reader can write today: the `forms[]` key, and
 * `formRef` to place the form. The test beside this file pins that every
 * message names both. The `crud` create action and an in-place `inlinePrefill`
 * are refused by `form-create-path-validation.ts` — they are values and
 * key combinations, not unknown keys, so the excess-property reporter that
 * reads this table never sees them.
 */

/** Keys removed from a `type: form` component itself. */
const REMOVED_ON_FORM: ReadonlyMap<string, string> = new Map([
  [
    'wizard',
    '`wizard` has been removed from the page `form`: a multi-step form takes something in, so it is a top-level `forms[]` entry with `layout: multi-step` and `steps[]`, placed on the page with `formRef`.',
  ],
  [
    'fieldGroups',
    '`fieldGroups` has been removed from the page `form`: declare the form in `forms[]` and group its fields with `forms[].fieldGroups`, then place it on the page with `formRef`.',
  ],
])

/** Keys removed from one entry of a page `form` component's `fields[]`. */
const REMOVED_ON_FORM_FIELD: ReadonlyMap<string, string> = new Map([
  [
    'visibleWhen',
    '`visibleWhen` has been removed from the page `form`’s fields: conditional fields belong to a form that takes something in. Declare the form in `forms[]`, where `forms[].fields[].visibleWhen` takes the same condition, and place it on the page with `formRef`.',
  ],
  [
    'requiredWhen',
    '`requiredWhen` has been removed from the page `form`’s fields: declare the form in `forms[]`, where `forms[].fields[].requiredWhen` takes the same condition, and place it on the page with `formRef`.',
  ],
  [
    'disabledWhen',
    '`disabledWhen` has been removed from the page `form`’s fields: declare the form in `forms[]`, where `forms[].fields[].disabledWhen` takes the same condition, and place it on the page with `formRef`.',
  ],
  [
    'accept',
    '`accept` has been removed from the page `form`’s fields: an upload belongs to a form that takes something in. Declare the form in `forms[]` with an attachment field (`forms[].fields[].accept`) and place it on the page with `formRef`. An attachment column on an edit form still draws its default control.',
  ],
  [
    'dropZone',
    '`dropZone` has been removed from the page `form`’s fields: declare the form in `forms[]` with an attachment field (`forms[].fields[].dropZone`) and place it on the page with `formRef`. An attachment column on an edit form still draws its default control.',
  ],
  [
    'maxFiles',
    '`maxFiles` has been removed from the page `form`’s fields: declare the form in `forms[]` with an attachment field (`forms[].fields[].maxFiles`) and place it on the page with `formRef`. An attachment column on an edit form still draws its default control.',
  ],
])

/**
 * A node path that addresses one entry of a component's `fields[]` — a
 * component reached through a page's `components`, a container's `children`,
 * or the app's shared `components`. `forms[N].fields[M]` does not match, so
 * the same key on a top-level form, where it is valid, gets no message.
 */
const COMPONENT_FIELD_PATH = /(?:components|children)\[\d+\]\.fields\[\d+\]$/

/**
 * The migration message for a removed page-form key, or `undefined` when this
 * module has nothing to say about it.
 *
 * @param path - Dotted path of the NODE holding the key, e.g.
 *   `pages[0].components[2]` or `pages[0].components[2].fields[1]`.
 * @param discriminant - The node's `type` literal when it has one (`form`).
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedFormKey = (
  path: string,
  discriminant: string | undefined,
  key: string
): string | undefined => {
  if (discriminant === 'form') return REMOVED_ON_FORM.get(key)
  if (discriminant === undefined && COMPONENT_FIELD_PATH.test(path)) {
    return REMOVED_ON_FORM_FIELD.get(key)
  }
  return undefined
}

/** Every removed key, for the test that pins each message names a destination. @internal */
export const REMOVED_FORM_KEYS = {
  form: [...REMOVED_ON_FORM.keys()],
  field: [...REMOVED_ON_FORM_FIELD.keys()],
} as const
