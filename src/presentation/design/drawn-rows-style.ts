/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The style of rows and items the server drew ahead of their component: read
 * and found, never pressed. A press on one before its component is live would
 * land on markup with nothing behind it, so the press passes to the host, and
 * an automated reader waits for the live row.
 */
export const DRAWN_ROWS_STYLE = { pointerEvents: 'none' } as const
