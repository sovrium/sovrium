/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Button visual variants matching common design system patterns
 *
 * ─── WHY IT LIVES IN ITS OWN MODULE ────────────────────────────────────────
 *
 * The button vocabulary is read by every submit that names its weight, and one
 * of those submits is the auth form's, declared in `action-operations.ts`.
 * `shared-schemas.ts` imports the action union, which imports
 * `action-operations.ts`, so the auth action could not import the vocabulary
 * from there without closing an import cycle. Declared here with no import of
 * its own, it is a leaf every reader can reach; `shared-schemas.ts` re-exports
 * it, so its existing readers are unchanged.
 */
export const ButtonVariantSchema = Schema.Literals([
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
  'fab',
]).annotate({
  title: 'Button Variant',
  description: 'Visual style variant for button components',
})

/**
 * The sizes of a button, shadcn/ui's Button `size` scale: four text sizes and
 * four square icon-only sizes. An icon size draws the `icon` alone and names
 * the button with its `label`, so it needs both (refused otherwise).
 */
export const ButtonSizeSchema = Schema.Literals([
  'xs',
  'sm',
  'default',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
]).annotate({
  title: 'Button Size',
  defaultNote: 'default',
  description:
    "The button's size, shadcn/ui's Button sizes: 'xs', 'sm', 'default' or 'lg' for a labelled button; 'icon-xs', 'icon-sm', 'icon' or 'icon-lg' for a square icon-only one, which needs an `icon` and a `label` (its accessible name).",
})
