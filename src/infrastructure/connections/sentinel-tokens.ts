/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const SENTINEL_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXNlZWQifQ.signature-placeholder'

export const SENTINEL_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXNlZWQtcmVmcmVzaCJ9.signature-placeholder'

export const isSentinelAccessToken = (plaintext: string | undefined): boolean =>
  plaintext !== undefined && plaintext.endsWith('.signature-placeholder')
