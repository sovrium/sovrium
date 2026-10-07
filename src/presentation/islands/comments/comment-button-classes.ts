/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'

/**
 * The three button weights a comment's actions and forms use.
 */

// Computed once at module scope: a button recipe is pure, and re-deriving the
// same three strings on every keystroke in an open edit box is pure waste.
export const PRIMARY_BUTTON = computeButtonDefaultClasses({ variant: 'default', size: 'sm' })
export const SECONDARY_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })
export const DESTRUCTIVE_BUTTON = computeButtonDefaultClasses({
  variant: 'destructive',
  size: 'sm',
})
