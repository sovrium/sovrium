/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A non-empty guidance line.
 *
 * Every string in this file is a sentence a human or an agent READS, so the
 * only universal constraint is that it says something. An empty `prefer` entry
 * is a blank bullet in the generated export — worse than an absent one, because
 * it looks like guidance that was lost rather than guidance never written.
 */
const GuidanceLineSchema = Schema.String.pipe(
  Schema.annotate({
    description: 'One writing rule, stated as an instruction a writer can obey',
  }),
  Schema.check(Schema.isMinLength(1, { message: 'A voice guidance line must not be empty' }))
)

/**
 * How the system addresses the reader.
 *
 * A free string rather than a literal union, and the reason is i18n: the
 * pronoun contract is per-language and language-specific. Sovrium's own house
 * rule is `tu` in French; `apps/partner` splits `vous` in its public marketing
 * zone from the portal register behind auth; an English app says `you` and has
 * no choice to make at all. A `Literals(['tu','vous','you'])` would be a French
 * and English union masquerading as a universal one, and it would reject the
 * first app authored in a language whose register it never enumerated.
 */
export const VoicePronounSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Address Pronoun',
    description:
      "How the system addresses the reader (e.g. 'tu', 'vous', 'you'). Free-form, because the register contract is per-language.",
    examples: ['tu', 'vous', 'you'],
  }),
  Schema.check(Schema.isMinLength(1, { message: 'Voice pronoun must not be empty' }))
)

/**
 * Tone per situation — the situational half of the Mailchimp voice/tone model.
 *
 * Voice is constant; tone moves with the moment. The five keys are NOT an
 * arbitrary selection: the first four are exactly the "four moments where the
 * system speaks" already named by
 * `[internal ref]`, and `destructive` is
 * added because a confirmation that names a consequence is the one remaining
 * moment where getting the words wrong costs the reader data rather than
 * comfort.
 *
 * Each value is ONE instruction, not a template. It tells the author (or the
 * agent) how to write the moment — `'State the constraint, then offer two ways
 * forward. Never accuse.'` — rather than supplying the literal string, which
 * belongs to `languages.translations` and is per-locale.
 *
 * Every key is optional. A design system that has thought about its empty
 * states and not yet about its destructive ones should be able to say so by
 * omission, rather than being forced to invent four sentences to declare one.
 */
export const VoiceToneSchema = Schema.Struct({
  /** Moment 1 — a table with zero rows, a feature never used. */
  empty: Schema.optional(
    GuidanceLineSchema.annotate({
      description:
        'How to write the moment there is nothing to show: a table with no rows, a feature never used.',
    })
  ),
  /** Moment 2 — a long-running task the operator is waiting on. */
  loading: Schema.optional(
    GuidanceLineSchema.annotate({
      description: 'How to write the moment the reader is waiting on something to finish.',
    })
  ),
  /** Moment 3 — anything that stops the reader: validation, network, refusal. */
  error: Schema.optional(
    GuidanceLineSchema.annotate({
      description:
        'How to write the moment something stops the reader: a refused value, a failed request, a permission denied.',
    })
  ),
  /** Moment 4 — a save confirmed, a deploy finished. */
  success: Schema.optional(
    GuidanceLineSchema.annotate({
      description: 'How to write the moment something the reader asked for has completed.',
    })
  ),
  /** The fifth moment — a confirmation that must name the consequence. */
  destructive: Schema.optional(
    GuidanceLineSchema.annotate({
      description:
        'How to write the confirmation before something irreversible: it has to name what is lost and how much.',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'VoiceTone',
    title: 'Tone by Situation',
    description:
      "How the tone shifts per moment. The first four keys mirror the 'four moments where the system speaks'; `destructive` covers the confirmation that must name its consequence.",
    examples: [
      {
        empty: 'Say what this is, then the one next action. Never a bare "no results".',
        error: 'State the constraint, then offer two ways forward. Never accuse.',
        destructive: 'Name what is deleted, how many, and whether it is reversible.',
      },
    ],
  })
)

/**
 * The app's brand voice — the constant half of the voice/tone pair.
 *
 * This is the key with no prior home anywhere in AppSchema, and it is the whole
 * reason an AI cannot currently write on-brand copy for a Sovrium app: the
 * config declares what a page CONTAINS and nothing about how it SOUNDS. Today
 * that knowledge lives as prose in `BRAND.md` §6 and §8, which the running
 * instance cannot read and no customer outside this repo has at all.
 *
 * It governs more surfaces than page copy: `auth.emailTemplates` carries
 * subject and body strings, form validation messages carry refusals, and every
 * empty state in an admin list is a sentence somebody had to write.
 *
 * ## `prefer` / `avoid`, not `do` / `dont`
 *
 * `do` is a reserved word. It is legal as a property name, but
 * `const { do } = voice` is a syntax error, so every consumer of this key —
 * including the design-system generator that will project it into the markdown
 * export — has to reach it by bracket access or rename it at the seam. That is
 * a footgun bought for nothing. The pair also matches what the source documents
 * actually contain: the `BRAND.md` tables are headed *"Use this / Not this"*,
 * which is prefer/avoid, and the vocabulary palette in
 * `voice-and-microcopy.md` is the same shape.
 */
export const VoiceSchema = Schema.Struct({
  /**
   * Adjectives that hold across every surface: `['warm', 'direct', 'never
   * condescending']`. The constant half — it does not move with the moment.
   */
  personality: Schema.optional(
    Schema.Array(GuidanceLineSchema).annotate({
      title: 'Voice Personality',
      description: 'Traits that hold across every surface, regardless of situation',
      examples: [['warm', 'direct', 'never condescending']],
    })
  ),

  /** How the system addresses the reader in this app's default language. */
  pronoun: Schema.optional(VoicePronounSchema),

  /**
   * Patterns to reach for. The `Use this` column of a `BRAND.md` §8 table.
   */
  prefer: Schema.optional(
    Schema.Array(GuidanceLineSchema).annotate({
      title: 'Preferred Patterns',
      description: 'Copy patterns to reach for, stated as instructions',
      examples: [
        [
          'Lead a CTA with its verb: Deploy, Save, Delete.',
          'Every empty state carries a guidance line naming the next action.',
        ],
      ],
    })
  ),

  /**
   * Patterns to refuse. The `Not this` column — and the more load-bearing half,
   * because a design system's refusals are what stop an agent inventing
   * plausible-looking off-brand copy.
   */
  avoid: Schema.optional(
    Schema.Array(GuidanceLineSchema).annotate({
      title: 'Refused Patterns',
      description: 'Copy patterns to refuse, stated as instructions',
      examples: [
        ['No exclamation marks in product chrome.', 'No emoji.', 'No unverifiable percentages.'],
      ],
    })
  ),

  /** How the tone shifts across the five moments where the system speaks. */
  tone: Schema.optional(VoiceToneSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Voice',
    title: 'Brand Voice',
    description:
      "The app's voice: constant personality and address, the patterns it reaches for and refuses, and how its tone shifts per situation.",
    examples: [
      {
        personality: ['warm', 'direct', 'never condescending'],
        pronoun: 'tu',
        prefer: ['Lead a CTA with its verb.'],
        avoid: ['No exclamation marks in product chrome.'],
        tone: { error: 'State the constraint, then offer two ways forward.' },
      },
    ],
  })
)

/** @public */
export type VoiceTone = Schema.Schema.Type<typeof VoiceToneSchema>
/** @public */
export type Voice = Schema.Schema.Type<typeof VoiceSchema>
