/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const AiChatTypeLiteral = Schema.Literal('ai-chat')

export const aiChatFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  agent: Schema.optional(
    Schema.String.annotate({ description: 'Agent name from app.agents[] configuration' })
  ),
  placeholder: Schema.optional(
    Schema.String.annotate({ description: 'Placeholder text for the chat input field' })
  ),
  chatHeight: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Chat container height in pixels' }),
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
  showHistory: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Whether to show previous conversation history on load',
    })
  ),
  allowAttachments: Schema.optional(
    Schema.Boolean.annotate({ description: 'Whether to allow file attachments in chat' })
  ),
} as const
