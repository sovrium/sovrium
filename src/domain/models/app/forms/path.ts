/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const RESERVED_PATH_PREFIXES: ReadonlyArray<string> = ['/api/', '/admin/', '/forms/', '/auth/']

const findReservedPrefix = (path: string): string | undefined =>
  RESERVED_PATH_PREFIXES.find((prefix) => path.startsWith(prefix))

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

export type FormPath = Schema.Schema.Type<typeof FormPathSchema>
