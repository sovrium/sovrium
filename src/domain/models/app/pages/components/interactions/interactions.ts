/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ClickInteractionSchema } from './click'
import { EntranceAnimationSchema } from './entrance'
import { HoverInteractionSchema } from './hover'
import { ScrollInteractionSchema } from './scroll'

export const InteractionsSchema = Schema.Struct({
  hover: Schema.optional(HoverInteractionSchema),
  click: Schema.optional(ClickInteractionSchema),
  scroll: Schema.optional(ScrollInteractionSchema),
  entrance: Schema.optional(EntranceAnimationSchema),
}).annotations({
  title: 'Component Interactions',
  description: 'Interactive behaviors triggered by user actions or page events',
})

export type Interactions = Schema.Schema.Type<typeof InteractionsSchema>
