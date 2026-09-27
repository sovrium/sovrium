/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Permissions-Policy grant a response needs, or no header at all.
 *
 * The platform-wide policy denies the microphone to every origin
 * (`microphone=()`), and a page that records must be granted it for its OWN
 * origin or `getUserMedia` rejects before the browser even asks the visitor.
 * The security-headers middleware merges this grant into the structural policy,
 * one feature wide.
 *
 * The caller passes a boolean decided from the CONFIG
 * (`render/page/page-microphone-detection.ts`). It was first decided by
 * scanning the rendered HTML for a marker attribute — a string any record
 * value or query-string prefill could spell — and must never go back to that.
 */
export const microphonePolicyHeaders = (
  capturesMicrophone: boolean
): Readonly<Record<string, string>> =>
  capturesMicrophone ? { 'Permissions-Policy': 'microphone=(self)' } : {}
