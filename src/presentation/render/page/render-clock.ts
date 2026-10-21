/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { serverNow } from '@/domain/models/process-env/dev-clock'

/**
 * The clock one render answers "now" at.
 *
 * A served page reads the server's clock (`serverNow`: the wall clock, or the
 * instant `SOVRIUM_DEV_CLOCK` pins on a development server). A drawing made
 * for someone else — a design-system specimen, a page export — is drawn at a
 * fixed instant instead, whatever the environment sets, so the same config
 * always gives the same bytes: a look-back window, a `$today` filter, a
 * relative date and a calendar's opening month all read that instant.
 *
 * ## Why a scope and not a parameter
 *
 * The reads sit at every depth of the render — the collection resolver, the
 * filter pass, the record-text formatter, a form's `$now` prefill, a drawn
 * calendar — and most of them are reached through functions that take no
 * context of their own. A scope bound around ONE render answers all of them
 * the same instant, and an async render keeps it across every `await`. A
 * render outside any scope reads the server's clock, exactly as before.
 */
const scope = new AsyncLocalStorage<Readonly<Date>>()

/** The fixed instant of the render in progress, or `undefined` outside a fixed-instant render. */
export const renderInstant = (): Readonly<Date> | undefined => scope.getStore()

/** "Now" for the render in progress: its fixed instant, else the server's clock. */
export const renderNow = (): Readonly<Date> => renderInstant() ?? serverNow()

/**
 * Run one render at a fixed instant.
 *
 * @param at - the instant every clock read of the render answers.
 * @param render - the render, which may be asynchronous.
 */
export const atRenderInstant = <T>(at: Readonly<Date>, render: () => T): T => scope.run(at, render)
