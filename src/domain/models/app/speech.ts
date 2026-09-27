/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Speech-to-text vocabulary shared by every surface that transcribes audio:
 * the `ai/transcribe` automation action, and the `ai-chat` component's
 * `voiceInput` option.
 *
 * It lives at the app root, not inside either feature, because the domain
 * boundaries let a feature import its own slug and the app root but not a
 * sibling slug (`[internal ref]`, DOMAIN_CROSS_FEATURE_EDGES):
 * `pages` may not reach into `automations`. It is deliberately NOT re-exported
 * by the app barrel — like `requires-ai`, it describes no `AppSchema` property
 * of its own, and a barrel entry named `speech` would assert an `app.speech`
 * key that does not and must not exist (speech infrastructure is env-only,
 * `STT_*`). Import it by its deep path.
 */

/**
 * Speech quality tier.
 *
 * The tier is the author's INTENT; the model behind it is the operator's
 * infrastructure. `fast` resolves to `STT_MODEL_FAST` and `accurate` to
 * `STT_MODEL_ACCURATE`, each falling back to `STT_MODEL` when unset — the same
 * "infra in env, intent in config" split the language-model surfaces follow.
 *
 * It carries no `identifier` on purpose: each surface re-annotates it with its
 * OWN default (`accurate` for the automation action, `fast` for chat), and one
 * identifier shared by nodes with different descriptions would collapse into a
 * single published `$defs` entry.
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
