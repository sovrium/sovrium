/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * onError response handler for actions
 *
 * Configures what happens after an action fails (toast notification,
 * retry, custom handlers). This property appears in the JSON schema
 * for automation actions via shared $defs with page-level actions.
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives in the pages/components/action module.
 *
 * @example
 * ```yaml
 * onError:
 *   toast:
 *     message: Operation failed
 *     variant: error
 * ```
 *
 * @see {@link ActionResponseSchema} from `@/domain/models/app/pages/components/action`
 */
export { ActionResponseSchema as OnErrorSchema } from '../../pages/components/action'
