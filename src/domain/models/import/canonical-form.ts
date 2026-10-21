/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `CanonicalForm` — the one shape every form source is parsed into.
 *
 * Typeform, Jotform, Google Forms, Tally, Fillout and Microsoft Forms each get
 * a pure adapter into this shape; an Airtable form view reaches it through the
 * Airtable adapter. ONE mapper then turns it into a `forms[]` entry, through
 * the committed question table (`form-question-mappings.ts`):
 *
 * - questions → form fields, bound to the columns of a generated
 *   `<form>_responses` table (an Airtable form view binds to its own table);
 * - pages and sections → `steps`;
 * - branching → `visibleWhen`, where the jump graph can be expressed;
 * - hidden fields → `prefill`;
 * - scores and formulas → `calculation`;
 * - the thank-you screen → `onSuccess`.
 *
 * Responses are not a form concern: they become ordinary seed records of the
 * responses table, through the same data path as any other table.
 */

import { Schema } from 'effect'
import { CanonicalValueSchema } from './canonical-base'
import { CanonicalConditionSchema } from './canonical-flow'
import { ImportSourceToolSchema } from './import-source'

/** One question of a source form. */
export const CanonicalQuestionSchema = Schema.Struct({
  sourceId: Schema.String.annotate({ description: "The question's id in the source" }).check(
    Schema.isMinLength(1)
  ),
  ref: Schema.optional(
    Schema.String.annotate({
      description: "The question's stable reference, when the source has one (Typeform's `ref`)",
    })
  ),
  title: Schema.String.annotate({ description: 'The question as the respondent read it' }),
  description: Schema.optional(
    Schema.String.annotate({ description: 'The help text under the question' })
  ),
  sourceType: Schema.String.annotate({
    description:
      "The question type in the source's own words, the key of the question table (`short_text`, `control_textbox`)",
  }).check(Schema.isMinLength(1)),
  required: Schema.Boolean.annotate({ description: 'Whether an answer was required' }),
  choices: Schema.optional(
    Schema.Array(
      Schema.Struct({
        sourceId: Schema.optional(Schema.String.annotate({ description: "The choice's id" })),
        label: Schema.String.annotate({ description: 'The choice as the respondent read it' }),
      })
    ).annotate({ description: 'The choices of a choice question, in order' })
  ),
  allowMultiple: Schema.optional(
    Schema.Boolean.annotate({ description: 'Whether more than one choice may be picked' })
  ),
  properties: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: "The question's other settings, verbatim: a scale's bounds, a file's types",
    })
  ),
  page: Schema.optional(
    Schema.String.annotate({ description: 'The source id of the page or section it sits on' })
  ),
  retired: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'True for a question no longer in the form that past responses still answer: it becomes a column, not a form field',
    })
  ),
}).annotate({
  identifier: 'CanonicalQuestion',
  description: 'One question of a source form, in the source’s own words.',
})

/** A page or a section of a source form. */
export const CanonicalFormPageSchema = Schema.Struct({
  sourceId: Schema.String.annotate({ description: "The page's id in the source" }),
  title: Schema.optional(Schema.String.annotate({ description: 'The page title' })),
  questions: Schema.Array(Schema.String).annotate({
    description: 'The source ids of the questions on the page, in order',
  }),
}).annotate({
  identifier: 'CanonicalFormPage',
  description: 'One page or section of a source form.',
})

/**
 * One step of a calculation: an arithmetic operator applied to the variable,
 * with a question's answer, a constant or another variable.
 */
export const CanonicalFormOperationSchema = Schema.Struct({
  operator: Schema.Literals(['add', 'subtract', 'multiply', 'divide', 'set']).annotate({
    description: 'What is done to the variable: an arithmetic operation, or replacing its value',
  }),
  operand: Schema.Union([
    Schema.Struct({ question: Schema.String }),
    Schema.Struct({ variable: Schema.String }),
    Schema.Struct({ constant: Schema.Finite }),
  ]).annotate({
    description: "The value applied: a question's answer, another variable, or a number",
  }),
}).annotate({
  identifier: 'CanonicalFormOperation',
  description: 'One arithmetic step of a score or price calculation.',
})

/**
 * One branching or calculation rule of a source form.
 *
 * A condition's rules name what they test as `{ question }`, `{ hidden }` or
 * `{ variable }` on the left, and a choice is compared by its label, so every
 * adapter speaks the same answer space; a nested group is a rule whose left is
 * itself a condition and whose operator is `group`. A jump's `target` is a
 * question or page source id, `end` for the default thank-you screen, or
 * `end:<screen>` for another one. A `branch` is evaluated when the respondent
 * leaves the page its `source` question sits on (Google Forms' go-to-section
 * per option), and its `target` is a page source id or `end`.
 */
export const CanonicalFormRuleSchema = Schema.Struct({
  kind: Schema.Literals([
    'jump',
    'branch',
    'show',
    'hide',
    'require',
    'calculate',
    'other',
  ]).annotate({
    description:
      'What the rule does: jump to a page or question, branch to a page when leaving the page its question sits on, show, hide or require a question, compute a score',
  }),
  source: Schema.optional(
    Schema.String.annotate({
      description:
        'For a jump, the source id of the question it is evaluated after; absent for a jump taken before the first question',
    })
  ),
  when: Schema.optional(CanonicalConditionSchema),
  target: Schema.optional(
    Schema.String.annotate({
      description: 'The source id of the page, question or variable acted on',
    })
  ),
  operation: Schema.optional(CanonicalFormOperationSchema),
  formula: Schema.optional(
    Schema.String.annotate({ description: 'For a calculation, the formula as the source wrote it' })
  ),
  raw: Schema.Unknown.annotate({
    description: 'The rule, verbatim, quoted in the report when it does not translate',
  }),
  reason: Schema.optional(
    Schema.String.annotate({
      description:
        'Why the rule is reported rather than converted, when the adapter already knows (a rule the source exposes but does not pin)',
    })
  ),
}).annotate({
  identifier: 'CanonicalFormRule',
  description: 'One logic rule of a source form, kept verbatim beside its reading.',
})

/** One response, keyed by question. */
export const CanonicalFormResponseSchema = Schema.Struct({
  sourceId: Schema.String.annotate({
    description: "The response's id in the source; its seed key and its `source_id` value",
  }).check(Schema.isMinLength(1)),
  submittedAt: Schema.String.annotate({
    description: 'When the response was submitted, ISO 8601',
  }),
  answers: Schema.Record(Schema.String, CanonicalValueSchema).annotate({
    description: 'The answers, keyed by question source id. An unanswered question is absent',
  }),
  hidden: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'The hidden-field values the response carried, by hidden-field name',
    })
  ),
  variables: Schema.optional(
    Schema.Record(Schema.String, CanonicalValueSchema).annotate({
      description: 'The values the source computed for its variables (a score), by variable name',
    })
  ),
}).annotate({
  identifier: 'CanonicalFormResponse',
  description: 'One submitted response of a source form.',
})

/** The decoded result of one form-source adapter, for one form. */
export const CanonicalFormSchema = Schema.Struct({
  tool: ImportSourceToolSchema,
  sourceId: Schema.String.annotate({ description: "The form's id in the source" }),
  title: Schema.String.annotate({ description: 'The form title the respondent read' }).check(
    Schema.isMinLength(1)
  ),
  description: Schema.optional(Schema.String.annotate({ description: 'The form introduction' })),
  questions: Schema.Array(CanonicalQuestionSchema).annotate({
    description: 'The questions, in the order a respondent meets them',
  }),
  pages: Schema.Array(CanonicalFormPageSchema).annotate({
    description: 'The pages or sections; a single-page form has one or none',
  }),
  rules: Schema.Array(CanonicalFormRuleSchema).annotate({
    description: 'The branching and calculation rules',
  }),
  hiddenFields: Schema.Array(Schema.String).annotate({
    description: 'The names of the hidden fields, filled from the form link',
  }),
  variables: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String.annotate({ description: 'The variable name (`score`, `price`)' }),
        initial: Schema.optional(
          Schema.Finite.annotate({ description: 'The value it starts from' })
        ),
        kind: Schema.optional(
          Schema.Literals(['number', 'text']).annotate({ description: 'What it holds' })
        ),
      })
    ).annotate({
      description:
        'The variables the form computes. Each becomes a column holding the computed values, and a calculation where the rules translate',
    })
  ),
  notExposed: Schema.optional(
    Schema.Array(Schema.String).annotate({
      description:
        "What the tool's API does not expose about the form (pages, logic, calculation formulas), each reported",
    })
  ),
  thankYou: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.String.annotate({ description: 'The thank-you heading' })),
      message: Schema.optional(Schema.String.annotate({ description: 'The thank-you text' })),
      redirectUrl: Schema.optional(
        Schema.String.annotate({ description: 'Where the respondent was sent after submitting' })
      ),
    }).annotate({ description: 'What the respondent saw after submitting' })
  ),
  definitionInferred: Schema.Boolean.annotate({
    description:
      'True when the tool exposes no form definition and the questions were inferred from the response columns (Microsoft Forms)',
  }),
  boundTable: Schema.optional(
    Schema.String.annotate({
      description:
        'For an Airtable form view, the source id of the table it writes to; the form binds to that imported table instead of a generated responses table',
    })
  ),
  responses: Schema.Array(CanonicalFormResponseSchema).annotate({
    description: 'The submitted responses, oldest first',
  }),
}).annotate({
  identifier: 'CanonicalForm',
  title: 'Canonical Form',
  description:
    'The intermediate model of a migrated form: its questions, pages, rules and responses, in the source’s own terms.',
})

export type CanonicalForm = Schema.Schema.Type<typeof CanonicalFormSchema>
