/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Reserved URL prefixes that cannot be claimed by a form's custom `path`.
 *
 * Each prefix is exact (with trailing slash) so a form path like `/api/contact`
 * is rejected, while a hypothetical `/api-docs` (no trailing slash on the
 * reserved name) would be allowed — the slash matters.
 *
 * - `/api/`   — reserved for HTTP API endpoints
 * - `/admin/` — reserved for the built-in admin surface
 * - `/forms/` — reserved for the canonical form routes themselves
 * - `/auth/`  — reserved for Better Auth flows
 */
const RESERVED_PATH_PREFIXES: ReadonlyArray<string> = ['/api/', '/admin/', '/forms/', '/auth/']

const findReservedPrefix = (path: string): string | undefined =>
  RESERVED_PATH_PREFIXES.find((prefix) => path.startsWith(prefix))

/**
 * Form Path
 *
 * Optional public URL path at which the form is reachable. When set, the
 * form is reachable at this path AND at the canonical `/forms/{name}` route.
 * When omitted, the form is private and only addressable via the canonical
 * route, page-component reference, or automation trigger.
 *
 * - Must start with a forward slash
 * - May contain URL-safe characters (letters, digits, hyphens, slashes, underscores)
 * - Must NOT use a reserved prefix (`/api/`, `/admin/`, `/forms/`, `/auth/`)
 * - 2–256 characters
 *
 * @example
 * ```typescript
 * "/contact"
 * "/apply"
 * "/marketing/2026/intake"
 * ```
 */
export const FormPathSchema = Schema.String.pipe(
  Schema.minLength(2),
  Schema.maxLength(256),
  Schema.pattern(/^\/[a-zA-Z0-9_\-/]+$/, {
    message: () =>
      'Form path must start with / and contain only URL-safe characters (letters, digits, hyphens, slashes, underscores)',
  }),
  Schema.filter((path) => {
    const reserved = findReservedPrefix(path)
    if (reserved === undefined) return true
    return `Form path '${path}' uses reserved prefix '${reserved}' (reserved prefixes: ${RESERVED_PATH_PREFIXES.join(', ')})`
  }),
  Schema.annotations({
    identifier: 'FormPath',
    title: 'Form Path',
    description:
      'Public URL path for the form (e.g. /contact). When omitted, form is only reachable at canonical /forms/{name}. Reserved prefixes (/api/, /admin/, /forms/, /auth/) are rejected.',
    examples: ['/contact', '/apply', '/support'],
  })
)

/** @public */
export type FormPath = Schema.Schema.Type<typeof FormPathSchema>
