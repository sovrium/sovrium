/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page decode rule for `file-upload`: `compact` and `dropZone` together.
 *
 * `compact: true` draws only the trigger, at a toolbar's size, and reports the
 * outcome through toasts; a drop zone needs the area it draws. Asking for both
 * is a contradiction with no reading worth guessing, so it is refused, naming
 * the two keys and what each one is for.
 *
 * Called from `collectPageBindingViolations` and from nowhere else, and shares
 * its contract: pure, no I/O, human-readable messages, empty when the page is
 * well-formed.
 *
 * @see ./page-binding-validation.ts — the caller, and the other families
 */
export function compactFileUploadViolations(
  nodes: readonly Readonly<Record<string, unknown>>[],
  label: string
): readonly string[] {
  return nodes
    .filter(
      (node) =>
        node['type'] === 'file-upload' && node['compact'] === true && node['dropZone'] === true
    )
    .map(
      () =>
        `${label} declares a file-upload with both compact: true and dropZone: true — a compact upload draws only its trigger, while a drop zone needs the area it draws; keep one of the two`
    )
}
