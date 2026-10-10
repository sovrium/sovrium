/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BrowserAgentActionSchema } from './agent'
import { BrowserRunActionSchema } from './run'

/**
 * Browser Action — union of the ways of driving a browser: `run` plays fixed
 * steps, `agent` lets a model drive towards a goal inside the same limits.
 */
export const BrowserActionSchema = Schema.Union([
  BrowserRunActionSchema,
  BrowserAgentActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'BrowserAction',
    title: 'Browser Action',
    description:
      'Drive a browser on a site with no API: through fixed steps (`run`), or by an AI agent working towards a goal (`agent`), always within listed hosts',
  })
)

/** @public */
export type BrowserAction = Schema.Schema.Type<typeof BrowserActionSchema>
