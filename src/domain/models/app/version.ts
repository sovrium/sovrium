/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * VersionSchema defines validation rules for application versions.
 *
 * Application versions must follow Semantic Versioning (SemVer) 2.0.0 specification:
 * - Format: MAJOR.MINOR.PATCH (e.g., 1.0.0)
 * - Each component must be a non-negative integer without leading zeros
 * - Optional pre-release identifiers after hyphen (e.g., 1.0.0-alpha, 1.0.0-beta.1)
 * - Optional build metadata after plus sign (e.g., 1.0.0+build.123)
 *
 * Valid version format:
 * - MAJOR version: Incremented for incompatible API changes
 * - MINOR version: Incremented for backwards-compatible functionality additions
 * - PATCH version: Incremented for backwards-compatible bug fixes
 * - Pre-release: Hyphen followed by dot-separated identifiers (alphanumeric + hyphen)
 * - Build metadata: Plus sign followed by dot-separated identifiers (alphanumeric + hyphen)
 *
 * @see https://semver.org/
 *
 * @example
 * ```typescript
 * // Valid versions
 * const version1 = '1.0.0'
 * const version2 = '0.0.1'
 * const version3 = '1.2.3'
 * const version4 = '1.0.0-alpha'
 * const version5 = '1.0.0-beta.1'
 * const version6 = '2.0.0-rc.1'
 * const version7 = '1.0.0+build.123'
 * const version8 = '1.0.0-alpha+001'
 *
 * // Validate version
 * const validated = Schema.decodeUnknownSync(VersionSchema)(version1)
 * ```
 */
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

/**
 * TypeScript type inferred from VersionSchema.
 *
 * Use this type for type-safe access to validated version strings.
 *
 * @example
 * ```typescript
 * const version: Version = '1.0.0'
 * ```
 */
export type Version = Schema.Schema.Type<typeof VersionSchema>

/**
 * Encoded type of VersionSchema (what goes in).
 *
 * In this case, it's the same as Version since we don't use transformations.
 */
export type VersionEncoded = Schema.Schema.Encoded<typeof VersionSchema>
