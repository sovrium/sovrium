/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Form } from '@/domain/models/app/forms'

/** Whether the page's form node asks to leave its own title and description out. */
const omitsHeader = (component: unknown): boolean =>
  (component as { readonly showHeader?: unknown } | null | undefined)?.showHeader === false

/**
 * `showHeader: false` on a page's form node: the embedded form draws neither
 * its title nor its description — the page heads it already. Its fields, its
 * submit and its behaviour are untouched.
 *
 * @param form - The referenced form.
 * @param component - The page's form node.
 * @returns The form to render, without its description when the header is off.
 */
export const formForEmbedHeader = (form: Readonly<Form>, component: unknown): Readonly<Form> =>
  omitsHeader(component) ? { ...form, description: undefined } : form

/**
 * The embed render option that leaves the title out when the header is off.
 *
 * @param component - The page's form node.
 */
export const embedHeaderOptions = (component: unknown): { readonly omitTitle?: true } =>
  omitsHeader(component) ? { omitTitle: true } : {}
