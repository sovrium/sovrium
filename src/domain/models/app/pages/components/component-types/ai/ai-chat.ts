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

/**
 * Uploads for the chat composer: the bucket the files land in, the media types
 * the chat takes, and the largest file. The type is read from each file's
 * content when it is uploaded, never from its name or declared type.
 */
const AiChatAttachmentsSchema = Schema.Struct({
  bucket: Schema.String.annotate({
    description:
      'Name of a bucket declared in `buckets` that stores the files. Files are readable only by the person who uploaded them, never from a public address.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  accept: Schema.optional(
    Schema.Array(
      Schema.String.annotate({
        description: 'A media type such as `text/csv`, or a family such as `image/*`.',
      }).pipe(Schema.check(Schema.isMinLength(1)))
    ).annotate({
      defaultNote: 'PDF, Word (.docx), CSV, Markdown and plain text',
      description:
        "The media types the chat accepts, judged from each file's content. A file of any other type is refused with the reason shown on its chip.",
    })
  ),
  maxSizeMb: Schema.optional(
    Schema.Finite.annotate({
      defaultNote: '10',
      description: 'Largest file accepted, in megabytes. A larger file is refused.',
    }).pipe(Schema.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)))
  ),
}).annotate({
  title: 'Chat Attachments',
  description:
    'Uploads picked files to the named bucket and sends them with the question. Files are kept until the conversation is deleted or the account erased, and appear in the account data export.',
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
  conversations: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        'Adds a Conversations button to the chat: it lists the past conversations of the signed-in person with this chat agent, newest first, opens one to carry it on, and starts a new one.',
    })
  ),
  id: Schema.optional(
    Schema.String.annotate({
      description:
        'Identifier of this chat, unique among the chats of the app. Required with `attachments`: uploads are addressed to the chat by it.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  allowAttachments: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Superseded by `attachments`. Shows an attach button whose files stay in the browser: they are drawn with the message and never sent to the agent.',
    })
  ),
  attachments: Schema.optional(AiChatAttachmentsSchema),
  voiceInput: Schema.optional(AiChatVoiceInputSchema),
  showUsage: Schema.optional(
    Schema.Boolean.annotate({
      defaultNote: 'false',
      description:
        'Ends each answer with the number of tokens its turn used, as reported by the AI provider; hovering it splits the count into input and output tokens. Nothing is shown for an answer whose provider reports no usage.',
    })
  ),
  /**
   * The URL query parameter a link may carry the opening words in.
   *
   * A page arrived at with `?<draftParam>=<words>` opens the chat with those
   * words in its message box and the box focused. Nothing is sent: a link must
   * never make a reader send a message they did not write, so the words wait
   * for the reader exactly as a clicked suggestion does. The parameter is read
   * in the browser, once, when the chat mounts.
   *
   * It is a named parameter rather than a `page.query` property because
   * `page.query` admits a closed list of values, and the words a reader typed
   * are free text by definition.
   */
  draftParam: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Name of the URL query parameter whose value opens the chat with those words in its message box, focused and not sent. A page reached with `?q=Which runs failed` and `draftParam: q` shows "Which runs failed" ready to send.',
        examples: ['q'],
      }),
      Schema.check(
        Schema.isPattern(/^[a-z][a-z0-9_-]*$/, {
          message:
            'draftParam must be a lowercase query parameter name (letters, digits, - and _), such as q',
        })
      )
    )
  ),
} as const
