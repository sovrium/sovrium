/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Destructive-confirm-gate label contract — the trigger attribute names, and
 * the last-resort defaults the readers fall back to.
 *
 * ## Why this is a module and not three literals
 *
 * The gate's two affordance labels are resolved SERVER-side (the interpreter
 * knows the page's language) and handed to the client by stamping them on the
 * trigger element. That makes the attribute names a wire contract with one
 * writer and two readers, none of which can import the others:
 *
 *   1. WRITER — `presentation/ui/sections/renderers/element-renderers/button-action-builders.ts`
 *      stamps the resolved strings onto the server-rendered trigger.
 *   2. READER — `presentation/client.ts` (the STRING `data-confirm` gate).
 *   3. READER — `presentation/islands/shared/confirm-gate-runtime.ts` (the rich
 *      OBJECT `data-confirm-config` gate).
 *
 * The readers are client-bundle code and the writer is SSR-only — it pulls in
 * the renderer tree — so a reader that imported the writer would drag SSR
 * modules into the island payload. A pure domain module is the seam both sides
 * can reach (presentation → domain), exactly as
 * {@link ../services/active-assignment-cookie.ts} is for the active-assignment
 * cookie name, and for the same stated reason: it stops one surface being
 * renamed without the others.
 *
 * A rename that missed a reader would NOT throw. `getAttribute` returns `null`
 * for an unknown name, the `??` chain falls through to the last-resort default,
 * and every dialog quietly reverts to English in a French app — the precise
 * silent-degradation shape this change-set was written to remove.
 *
 * Everything here is a string constant: no I/O, no DOM types, no framework.
 */

/**
 * Trigger attribute carrying the language-resolved DISMISS label.
 *
 * Stamped from the `confirmGate.cancel` interpreter string. Read by both
 * vanilla-DOM gates, which build their buttons at click time and so have no
 * dialog element to hang a `data-translations` blob on — the trigger is the one
 * element that exists at render time.
 */
export const CONFIRM_CANCEL_LABEL_ATTR = 'data-confirm-cancel-label'

/** Sibling of {@link CONFIRM_CANCEL_LABEL_ATTR} for the AFFIRM affordance. */
export const CONFIRM_AFFIRM_LABEL_ATTR = 'data-confirm-affirm-label'

/**
 * Last-resort AFFIRM label, for a trigger rendered by some path that stamped no
 * attribute.
 *
 * ENGLISH on purpose, and it must stay equal to the `en` entry of
 * `confirmGate.confirm` in `domain/utils/translation-resolver.ts`.
 * `DEFAULT_INTERPRETER_LANG` is `'en'`, so a French last resort would be a
 * second fallback chain disagreeing with the first — which is the bug that put
 * an "Annuler" beside an author's English "Retry" on every console dialog.
 * Holding it here means the two readers cannot drift apart into exactly that
 * disagreement again.
 */
export const CONFIRM_AFFIRM_LABEL_FALLBACK = 'Confirm'

/** Last-resort DISMISS label. English for the same reason as {@link CONFIRM_AFFIRM_LABEL_FALLBACK}. */
export const CONFIRM_CANCEL_LABEL_FALLBACK = 'Cancel'
