/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Whether the render in progress is a design-system SPECIMEN: a drawing made
 * for someone else (a specimen frame, a page export), in which no island is
 * mounted and nothing of the instance is read.
 *
 * A data island draws its loading skeleton on a served page, because the
 * browser is about to fetch its rows. A specimen never fetches anything, so a
 * skeleton there is a picture of a page that never finishes loading: in a
 * specimen, an island bound to a declared table draws the synthetic seed's
 * rows, and any other draws its empty state.
 *
 * A scope rather than a parameter for the reason `render-clock.ts` gives: the
 * island renderers sit at every depth of the tree and take no context of
 * their own. A render outside the scope is a served page.
 */
const scope = new AsyncLocalStorage<true>()

/** Whether the render in progress is a specimen. */
export const isSpecimenDrawing = (): boolean => scope.getStore() === true

/**
 * Run one render as a specimen.
 *
 * @param render - the render, which may be asynchronous.
 */
export const asSpecimenDrawing = <T>(render: () => T): T => scope.run(true, render)
