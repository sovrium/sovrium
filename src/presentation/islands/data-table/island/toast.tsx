/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export of the shared island toast renderer.
 *
 * The implementation moved to `islands/shared/toast` — a toast is not a
 * data-table concern, and three near-identical copies had accumulated. This
 * file remains so the data-table island's own call sites (`row-actions`,
 * `bulk-action-execute`) keep their local import; new callers should import
 * from `shared/toast` directly.
 */

export { renderToast } from '../../runtime/toast'
