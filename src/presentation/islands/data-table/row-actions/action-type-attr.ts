/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The `data-action-type` a row action's controls carry: the action's `type`,
 * or its `action` literal. Every control that dispatches the action (the inline
 * button, the menu item, the confirm button) names it the same way.
 */
export function actionTypeAttr(action: ActionColumnItem): string {
  return 'type' in action.action ? action.action.type : action.action.action
}
