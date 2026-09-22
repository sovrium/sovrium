/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export of the shared island toast renderer.
 *
 * The implementation moved to `islands/shared/toast` — the auth form, the
 * kanban drop and the crud form all raise the same toast, so it does not belong
 * under `components/crud-form/`. This file remains so existing import sites
 * (`crud-form-island`, `auth-form`, `kanban`) keep working; new callers should
 * import from `shared/toast` directly.
 */

export { showSuccessToast, type SuccessToast } from '../../runtime/toast'
