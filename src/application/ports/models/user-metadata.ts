/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minimal user metadata embedded in domain records
 *
 * Represents the common shape returned by user-joined queries
 * (activity logs, comments, activity history). Defined at the
 * application boundary so both application and infrastructure
 * layers can reference the same contract.
 *
 * Variants:
 * - `UserMetadata` — core fields (id, name, email)
 * - `UserMetadataWithImage` — adds optional image (comments, activity history)
 */
export interface UserMetadata {
  readonly id: string
  readonly name: string
  readonly email: string
}

export interface UserMetadataWithImage extends UserMetadata {
  readonly image: string | null | undefined
}

/**
 * Variant with image typed as `string | undefined` only (no null).
 * Used by comment queries where infrastructure converts null → undefined.
 */
export interface UserMetadataWithOptionalImage extends UserMetadata {
  readonly image: string | undefined
}
