/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const VersionSchema = Schema.String.pipe(
  Schema.minLength(5, { message: () => 'Version must not be empty (minimum format: 0.0.0)' }),
  Schema.pattern(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    {
      message: () =>
        'Version must follow Semantic Versioning format (MAJOR.MINOR.PATCH, e.g., 1.0.0). No leading zeros allowed. Optional pre-release (-alpha) and build metadata (+build.123) are supported.',
    }
  ),
  Schema.annotations({
    title: 'Application Version',
    description:
      'The version of the application following Semantic Versioning (SemVer) 2.0.0 specification',
    examples: [
      '1.0.0',
      '0.0.1',
      '1.2.3',
      '1.0.0-alpha',
      '1.0.0-beta.1',
      '2.0.0-rc.1',
      '1.0.0+build.123',
      '1.0.0-alpha+001',
    ],
  })
)

export type Version = Schema.Schema.Type<typeof VersionSchema>

export type VersionEncoded = Schema.Schema.Encoded<typeof VersionSchema>
