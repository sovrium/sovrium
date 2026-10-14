/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'

/**
 * The three button weights a comment's actions and forms use: shadcn's
 * `buttonVariants` at `sm`, drawn as a part's button. The caller stamps
 * `data-slot="button"` beside the class, as shadcn's `Button` does.
 */

// Computed once at module scope: a button recipe is pure, and re-deriving the
// same three strings on every keystroke in an open edit box is pure waste.
export const PRIMARY_BUTTON = computePartButtonClasses({ variant: 'default', size: 'sm' })
export const SECONDARY_BUTTON = computePartButtonClasses({ variant: 'secondary', size: 'sm' })
export const DESTRUCTIVE_BUTTON = computePartButtonClasses({ variant: 'destructive', size: 'sm' })
