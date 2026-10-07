/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const FORM_REFERENCE = /\$form\.([A-Za-z_][\w-]*)/g

/**
 * `$form.<field>` replaced by what the reader typed into that field. A field the
 * form does not have prints nothing. The result is drawn as TEXT, so a typed
 * value can never become markup.
 */
export const fillFormReferences = (
  text: string,
  values: Readonly<Record<string, string>>
): string => text.replace(FORM_REFERENCE, (_match, name: string) => values[name] ?? '')
