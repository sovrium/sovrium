/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui item (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

import { computePartButtonClasses } from './button-variant-classes'

/**
 * The `reorderable-list` component's parts, on shadcn/ui's `Item` anatomy: the
 * list is an `ItemGroup` (`data-slot="reorderable-list"`), each row an outlined
 * small `Item` whose text sits in its `ItemContent`, and each row starts with a
 * grip handle drawn as a ghost icon button.
 *
 * A row picked up for moving — Space on its handle, or a drag — carries
 * `data-reorder-active="true"` (the inline reorder runtime sets it) and paints
 * the muted surface inside base-nova's focus ring, so the row being carried is
 * the one that stands out.
 *
 * The row itself is `computeItemClasses({ variant: 'outline' })`; only what the
 * list adds on top of it lives here.
 */

/** base-nova's `ItemGroup` at the small size, as a bare list. */
export const computeReorderableListClasses = (): string =>
  'group/item-group m-0 flex w-full list-none flex-col gap-2 p-0'

/** What a row adds to the outlined item: the muted ground while it is carried. */
export const computeReorderableRowClasses = (): string =>
  'data-[reorder-active=true]:bg-muted data-[reorder-active=true]:ring-3 data-[reorder-active=true]:ring-ring/50'

/** The grip handle: a ghost icon button, grabbed while pressed or picked up. */
export const computeReorderableHandleClasses = (): string =>
  `${computePartButtonClasses({ variant: 'ghost', size: 'icon-xs' })} cursor-grab text-muted-foreground active:cursor-grabbing aria-pressed:bg-muted aria-pressed:text-foreground`
