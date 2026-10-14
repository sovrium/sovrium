/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui aspect-ratio (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `aspect-ratio` frame, as base-nova draws it: a relative box whose
 * `aspect-ratio` reads the `--ratio` custom property the renderer sets inline.
 *
 * base-nova leaves the child to the author (`className="size-full object-cover"`
 * on the image); a config cannot know to write that, so the frame lays its one
 * medium over itself instead — absolutely, edge to edge, covering — which is
 * what every shadcn example does by hand.
 */
const FRAME = 'relative aspect-(--ratio)'

/** The one medium, covering the frame edge to edge. */
const MEDIUM = '*:absolute *:inset-0 *:size-full *:object-cover'

/** The default className of an `aspect-ratio` frame. */
export const computeAspectRatioClasses = (): string => `${FRAME} ${MEDIUM}`

/**
 * The value `--ratio` takes: a fraction keeps its slash (`16 / 9`, which CSS
 * `aspect-ratio` reads natively), a number is printed as is.
 */
export const aspectRatioCssValue = (ratio: string | number): string =>
  typeof ratio === 'number'
    ? String(ratio)
    : ratio
        .split('/')
        .map((part) => part.trim())
        .join(' / ')
