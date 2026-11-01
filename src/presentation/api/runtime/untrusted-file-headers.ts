/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Content-Security-Policy every stored file a person uploaded is served
 * under, whichever route serves it (a bucket download, a signed link, a chat
 * attachment): even when a browser renders the bytes, no embedded script,
 * style or network request can run.
 */
export const UNTRUSTED_FILE_CSP = "default-src 'none'"
