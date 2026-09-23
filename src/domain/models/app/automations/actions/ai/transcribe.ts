/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Speech quality tier — shared by every surface that transcribes audio.
 *
 * The tier is the author's INTENT; the model behind it is the operator's
 * infrastructure. `fast` resolves to `STT_MODEL_FAST` and `accurate` to
 * `STT_MODEL_ACCURATE`, each falling back to `STT_MODEL` when unset — the same
 * "infra in env, intent in config" split the language-model surfaces follow
 * (a plain `model` string per surface, the provider in `AI_*`).
 *
 * Exported for reuse by the form `recordAudio` and chat `voiceInput` options,
 * which are not built yet. It carries no `identifier` on purpose: each
 * surface re-annotates it with its OWN default (`accurate` here, `fast` for
 * chat), and one identifier shared by nodes with different descriptions would
 * collapse into a single published `$defs` entry.
 */
export const SpeechQualitySchema = Schema.Literals(['fast', 'accurate']).pipe(
  Schema.annotate({
    title: 'Speech Quality',
    description:
      'Which speech-to-text tier to use: "fast" favours latency (live dictation), "accurate" favours fidelity (archived recordings). The operator maps each tier to a model with STT_MODEL_FAST and STT_MODEL_ACCURATE; an unset tier falls back to STT_MODEL.',
  })
)

/** @public */
export type SpeechQuality = Schema.Schema.Type<typeof SpeechQualitySchema>

/**
 * Spoken language hint — a two-letter ISO 639-1 code, lowercase.
 *
 * Deliberately carries NO `identifier`: a `Schema.check` on an identified node
 * either mints no `$defs` entry or drops its description, depending on order.
 * The description is annotated BEFORE the check so it survives in the
 * published JSON Schema.
 */
export const SpeechLanguageSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Speech Language',
    description:
      'Language spoken in the recording, as a two-letter lowercase ISO 639-1 code (e.g. "fr", "en", "de"). When omitted the speech engine detects the language itself.',
    examples: ['fr', 'en', 'de'],
  }),
  Schema.check(Schema.isPattern(/^[a-z]{2}$/))
)

/** @public */
export type SpeechLanguage = Schema.Schema.Type<typeof SpeechLanguageSchema>

/**
 * AI Transcribe Action (type: ai, operator: transcribe)
 *
 * Turns a stored audio file into text through the operator-run speech
 * endpoint configured by the `STT_*` environment variables. The step output is
 * `{ text, language, durationSeconds, model, segments? }`, so a following
 * `record/update` can write `{{steps.<name>.text}}` into a long-text field.
 *
 * There is no `provider` prop: the speech provider is infrastructure and is
 * resolved from `STT_PROVIDER` under `ECO_AI_PROVIDER_PRECEDENCE`, never chosen
 * per action.
 */
export const AiTranscribeActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai').pipe(
    Schema.annotate({
      description: "Constant value 'ai' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('transcribe').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'ai' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Audio to transcribe: a storage key or an attachment field value */
    source: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The audio file to transcribe: a storage key, or the value of an attachment field (e.g. "{{trigger.data.record.recording}}"). Supports template variables.',
      })
    ),

    /**
     * Bucket holding the audio file. The pattern repeats the bucket-name rule
     * rather than importing `BucketNameSchema`: the layer boundaries keep one
     * domain feature from reaching into another.
     */
    bucket: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Bucket holding the recording, when it is not in the bucket of the attachment field or the implicit "default" bucket (must name an app.buckets[] entry).',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/), Schema.isMaxLength(63))
      )
    ),

    /** Spoken language hint */
    language: Schema.optional(SpeechLanguageSchema),

    /** Speech quality tier */
    quality: Schema.optional(
      SpeechQualitySchema.pipe(
        Schema.annotate({
          defaultNote: 'accurate',
          description:
            'Speech-to-text tier for this step. Defaults to "accurate", because an automation transcribes a recording that is kept, where fidelity matters more than latency.',
        })
      )
    ),

    /** Exact model override */
    model: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Exact speech model to request, overriding the tier chosen by "quality" (e.g. "whisper-large-v3"). The endpoint set by STT_BASE_URL must serve it.',
        })
      )
    ),

    /** Vocabulary hint */
    prompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Vocabulary hint passed to the speech engine: names, acronyms and jargon it should expect (e.g. "Sovrium, SIRET, devis"). It guides spelling; it is not an instruction.',
        })
      )
    ),

    /** Segment timestamps */
    timestamps: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'false',
          description:
            'When true, the step output also carries "segments": a list of { start, end, text } entries, times in seconds from the start of the recording.',
        })
      )
    ),
  }).annotate({
    description:
      'The recording to transcribe, the language spoken in it, and the speech tier or model to use.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AiTranscribeAction',
    title: 'AI Transcribe Action',
    description:
      'Transcribe a stored audio recording into text with the speech-to-text endpoint the operator configures (STT_* environment variables)',
  })
)

/** @public */
export type AiTranscribeAction = Schema.Schema.Type<typeof AiTranscribeActionSchema>
