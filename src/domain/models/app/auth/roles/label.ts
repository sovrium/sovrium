/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Role Label Schema
 *
 * The words a person reads for a role wherever the operator console shows one —
 * the invite dialog's role picker, the directory's Role column. The name stays
 * the identity every write and every permission names; the label only changes
 * what is displayed. Without one, the console uses its own words for a built-in
 * role (`viewer` reads "Viewer", the read-only console tier "Admin (read-only)"),
 * and makes any other name readable (`accounting-read` reads "Accounting read").
 */
export const RoleLabelSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Role Label',
    description:
      'What the console calls this role, in place of its name: the users directory, the invite dialog, the Change role picker and the account page show it. The name stays what permissions and writes use. Without a label the console uses its own words for a built-in role ("Admin (read-only)" for `admin-viewer`) and shows any other name made readable, `accounting-read` reading "Accounting read". A `$t:` key is translated in the operator\'s console language. A built-in role may be listed with only a label.',
    examples: ['Accountant', 'Project lead', '$t:roles.accounting'],
  }),
  Schema.check(Schema.isMinLength(1))
)
