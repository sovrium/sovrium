/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words a record sheet draws without its author writing them, beyond its
 * Save and Close: the Cancel of a footer question, the navigation's controls
 * and landmark name, the name of the banner that refuses a save, and what a
 * refused footer write toasts.
 *
 * The SSR host resolves each against the page language and the app's
 * `languages` (`render/registry/record-bound-drawer.tsx`), as it does Close;
 * the island cannot, because an author's override lives in the config. A word
 * the host left out falls back to the English catalogue entry, which is what
 * an English page draws.
 */
export interface DrawerBuiltInLabels {
  /** A footer question's dismiss button (`confirmGate.cancel`). */
  readonly cancel?: string
  /** The navigation's step back (`recordDrawer.previous`). */
  readonly previous?: string
  /** The navigation's step forward (`recordDrawer.next`). */
  readonly next?: string
  /** The link to the record's own page (`recordDrawer.openFullPage`). */
  readonly fullPage?: string
  /** The navigation landmark's name (`recordDrawer.navigation`). */
  readonly navigation?: string
  /** The name of the banner a refused save shows (`recordDrawer.validationError`). */
  readonly validationError?: string
  /** A refused write's toast words, keyed by catalogue key (`rateLimit.retryIn`, …). */
  readonly writeRefusal?: Readonly<Record<string, string>>
}
