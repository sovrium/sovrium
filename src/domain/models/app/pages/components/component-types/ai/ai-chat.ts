/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SpeechLanguageSchema, SpeechQualitySchema } from '../../../../speech'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const AiChatTypeLiteral = Schema.Literal('ai-chat')

/**
 * Push-to-talk dictation for the chat composer.
 *
 * The browser records while the person holds the microphone button, posts the
 * recording to `POST /api/ai/transcriptions`, and the transcript becomes the
 * message. The recording is transcribed and discarded — never stored — and the
 * speech engine is the operator's (`STT_*` environment variables), so this
 * option states only intent: what happens to the transcript, the language
 * spoken, the tier, and the longest recording accepted.
 */
const AiChatVoiceInputSchema = Schema.Struct({
  mode: Schema.optional(
    Schema.Literals(['draft', 'send']).annotate({
      defaultNote: 'draft',
      description:
        'What happens to the transcript: "draft" places it in the message box for the person to review and send, "send" sends it as the message straight away.',
    })
  ),
  language: Schema.optional(SpeechLanguageSchema),
  quality: Schema.optional(
    SpeechQualitySchema.pipe(
      Schema.annotate({
        defaultNote: 'fast',
        description:
          'Speech-to-text tier for dictation. Defaults to "fast", because the person is waiting for the transcript before they can send.',
      })
    )
  ),
  maxDurationSeconds: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '300',
        description:
          'Longest recording accepted, in seconds (1 to 300). Recording stops by itself when the limit is reached.',
      }),
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(300)
      )
    )
  ),
}).annotate({
  title: 'Chat Voice Input',
  description:
    'Adds a push-to-talk microphone button to the chat composer. The recording is transcribed by the speech-to-text endpoint the operator configures and is never stored.',
})

/** @public */
export type AiChatVoiceInput = Schema.Schema.Type<typeof AiChatVoiceInputSchema>

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
  voiceInput: Schema.optional(AiChatVoiceInputSchema),
} as const
