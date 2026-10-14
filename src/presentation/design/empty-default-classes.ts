/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui empty (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's `Empty` parts — a leaf module, so an island that draws an empty state (the API-key manager) imports
 * these strings alone. `display-default-classes.ts` re-exports it for the
 * server-rendered surfaces.
 */

/**
 * Compute the className for the `empty` root (`data-slot="empty"`).
 *
 * base-nova's string, unchanged: `border-dashed` sets the STYLE of a border it
 * does not draw, so an author who adds `border` gets the dashed "nothing here
 * yet" outline and one who does not gets an open, centred block.
 */
export const computeEmptyStateContainerClasses = (): string =>
  'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance'

/** Compute the className for the header that holds the title and description. */
export const computeEmptyHeaderClasses = (): string => 'flex max-w-sm flex-col items-center gap-2'

/**
 * Compute the className for the empty's title (`data-slot="empty-title"`):
 * base-nova's, less its `cn-font-heading` hook, which only the registry's
 * build gives a rule.
 */
export const computeEmptyStateTitleClasses = (): string => 'text-sm font-medium tracking-tight'

/** Compute the className for the empty's description (`data-slot="empty-description"`). */
export const computeEmptyDescriptionClasses = (): string =>
  'text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary'

/**
 * Compute the className for the empty's media (`data-slot="empty-icon"`), by
 * variant: `icon` frames the glyph in a muted tile, `default` draws it bare.
 */
export const computeEmptyMediaClasses = (variant: 'icon' | 'default'): string =>
  variant === 'icon'
    ? "mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    : 'mb-2 flex shrink-0 items-center justify-center bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0'

/** Compute the className for the content under the header (`data-slot="empty-content"`). */
export const computeEmptyContentClasses = (): string =>
  'flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance'
