/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Page Name (human-readable display name for the page)
 *
 * Unlike the common NameSchema (database identifier with snake_case), page names
 * are human-readable labels used in admin interfaces, logs, and internal references.
 * They can contain spaces, capital letters, and other readable characters.
 *
 * Must be non-empty with max 63 characters to match database constraints for
 * internal identifiers, but doesn't enforce snake_case pattern since this is
 * a display name, not a database column name.
 *
 * @example "Home"
 * @example "About Us"
 * @example "Home Page"
 * @example "Pricing Plans"
 *
 */
export const PageNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Page Name',
    description: 'Human-readable name for the page',
    examples: ['Home', 'About Us', 'Home Page', 'Pricing', 'Contact'],
  }),
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(63))
)

/** @public */
export type PageName = Schema.Schema.Type<typeof PageNameSchema>
