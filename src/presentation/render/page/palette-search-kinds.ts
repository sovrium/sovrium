/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The kinds of data the console's search palette names (its prompt and its
 * Search data row), read off what the app declares.
 */

import type { App } from '@/domain/models/app'

/** Whether an optional list key of the app declares at least one entry. */
const declares = (list: ReadonlyArray<unknown> | undefined): boolean => (list?.length ?? 0) > 0

/**
 * The kinds of data a SEARCH palette can reach on `app`, in the order the
 * palette names them: tables give records, forms submissions, automations
 * runs, buckets files, agents conversations, connections connections, and
 * sign-in gives users, named last. A kind the app does not declare is never
 * named. Words only: what a caller may read is the search endpoint's to judge.
 */
export const declaredSearchKinds = (app: App): readonly string[] =>
  [
    declares(app.tables) && 'record',
    declares(app.forms) && 'submission',
    declares(app.automations) && 'run',
    declares(app.buckets) && 'file',
    declares(app.agents) && 'conversation',
    declares(app.connections) && 'connection',
    app.auth !== undefined && 'user',
  ].filter((kind): kind is string => kind !== false)
