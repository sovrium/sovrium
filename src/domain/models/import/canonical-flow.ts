/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `CanonicalFlow` — the one shape every automation source is parsed into.
 *
 * An n8n workflow, a Make scenario blueprint, a Zap from a Zapier export, a
 * Retool workflow and the automations of a Baserow workspace export all become
 * a trigger followed by a directed graph of steps. ONE mapper then turns the
 * graph into an `automations[]` entry, through the committed step registry
 * (`flow-step-mappings.ts`).
 *
 * ## Expressions are tokenised, never evaluated
 *
 * Each tool has its own template language — n8n `{{ $json.email }}` and
 * `$node["Lookup"].json.id`, Make `{{1.email}}`, Zapier `{{123__email}}`. An
 * adapter splits each into text, references, constants and calls of the
 * tool's own functions ({@link CanonicalExpressionSchema}); the mapper rewrites
 * a reference into Sovrium's `{{trigger.data.email}}` or `{{lookup.result.id}}`,
 * and a call into the template helper its tool's function table names. Anything
 * the tokenizer cannot read — a JavaScript method call, a ternary, an arrow
 * function — is kept verbatim as an `unsupported` token, and so is a call no
 * table row maps; the step holding it becomes a TODO.
 *
 * ## Nothing is guessed
 *
 * A step the registry does not hold stays an `unknown` step carrying the
 * source's raw definition. The automation holding it is imported disabled,
 * and the report quotes the definition so the operator, or their own AI, can
 * finish it.
 */

import { Schema } from 'effect'
import { ImportSourceToolSchema } from './import-source'

/** One token of a tokenised expression, in the source's own terms. */
export type CanonicalExpressionToken =
  | { readonly kind: 'text'; readonly value: string }
  | {
      readonly kind: 'ref'
      readonly root: 'trigger' | 'step'
      readonly step?: string | undefined
      readonly path: readonly string[]
    }
  | { readonly kind: 'literal'; readonly value: string | number | boolean }
  | {
      readonly kind: 'call'
      readonly name: string
      readonly args: readonly CanonicalExpressionToken[]
      readonly source: string
    }
  | { readonly kind: 'unsupported'; readonly source: string }

/** One token of a tokenised expression. */
export const CanonicalExpressionTokenSchema: Schema.Codec<CanonicalExpressionToken> = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('text').annotate({ description: 'Literal text' }),
    value: Schema.String.annotate({ description: 'The text, verbatim' }),
  }),
  Schema.Struct({
    kind: Schema.Literal('ref').annotate({ description: 'A reference to data of the run' }),
    root: Schema.Literals(['trigger', 'step']).annotate({
      description: "Whether it reads the trigger's data or an earlier step's result",
    }),
    step: Schema.optional(
      Schema.String.annotate({ description: 'The id of the step read, for a step reference' })
    ),
    path: Schema.Array(Schema.String).annotate({
      description: 'The property path read, one segment per key',
      examples: [['email'], ['contact', 'id']],
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal('literal').annotate({
      description: 'A constant argument of a function call',
    }),
    value: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description: 'The constant, as the source wrote it',
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal('call').annotate({
      description: "A call of one of the source's own functions",
    }),
    name: Schema.String.annotate({
      description: 'The function name, as the source spells it',
      examples: ['formatDate', 'lower', 'ifempty'],
    }),
    args: Schema.Array(
      Schema.suspend((): Schema.Codec<CanonicalExpressionToken> => CanonicalExpressionTokenSchema)
    ).annotate({ description: 'The arguments, in order' }),
    source: Schema.String.annotate({ description: 'The call, verbatim' }),
  }),
  Schema.Struct({
    kind: Schema.Literal('unsupported').annotate({
      description: 'A construct the tokenizer cannot translate',
    }),
    source: Schema.String.annotate({ description: 'The construct, verbatim' }),
  }),
]).annotate({
  identifier: 'CanonicalExpressionToken',
  description:
    'Text, a reference to run data, a constant, a call of a source function, or a construct kept verbatim because it does not translate.',
})

/** A value that carries the source's template language, tokenised. */
export const CanonicalExpressionSchema = Schema.Struct({
  kind: Schema.Literal('expression').annotate({ description: 'A tokenised expression' }),
  source: Schema.String.annotate({
    description: 'The expression exactly as the source wrote it',
    examples: ['={{ $json.email }}', '{{1.email}}', '{{123__email}}'],
  }),
  tokens: Schema.Array(CanonicalExpressionTokenSchema).annotate({
    description: 'The expression split into text, references and untranslatable constructs',
  }),
}).annotate({
  identifier: 'CanonicalExpression',
  description: 'A templated value of the source, kept verbatim and tokenised.',
})

export type CanonicalExpression = Schema.Schema.Type<typeof CanonicalExpressionSchema>

/** A condition of a branch, a filter or a trigger, in the source's operators. */
export const CanonicalConditionSchema = Schema.Struct({
  combinator: Schema.Literals(['and', 'or']).annotate({
    description: 'Whether every rule must hold, or one',
  }),
  rules: Schema.Array(
    Schema.Struct({
      left: Schema.Unknown.annotate({
        description: 'The value tested, usually a `CanonicalExpression`',
      }),
      operator: Schema.String.annotate({
        description:
          "The comparison in the source's own words (`equals`, `contains`, `text:equal`)",
      }),
      right: Schema.optional(Schema.Unknown.annotate({ description: 'The operand, if any' })),
    })
  ).annotate({ description: 'The rules' }),
}).annotate({
  identifier: 'CanonicalCondition',
  description: 'A boolean condition in the source’s own operators.',
})

export type CanonicalCondition = Schema.Schema.Type<typeof CanonicalConditionSchema>

/** What starts a flow. */
export const CanonicalTriggerSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('schedule').annotate({ description: 'A schedule' }),
    cron: Schema.optional(
      Schema.String.annotate({ description: 'A cron expression, when the source states one' })
    ),
    interval: Schema.optional(
      Schema.String.annotate({
        description: "An interval in the source's own words, when it has no cron",
        examples: ['every 15 minutes', 'daily at 08:00'],
      })
    ),
    timezone: Schema.optional(Schema.String.annotate({ description: 'An IANA time zone' })),
  }),
  Schema.Struct({
    kind: Schema.Literal('webhook').annotate({ description: 'An inbound HTTP request' }),
    method: Schema.optional(Schema.String.annotate({ description: 'The HTTP method' })),
    todo: Schema.optional(
      Schema.String.annotate({
        description:
          'Why the automation is a TODO although its trigger maps: the source event it stands in for',
      })
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal('record').annotate({
      description: 'A record event on a table that is migrated with the flow',
    }),
    table: Schema.String.annotate({ description: "The table's source id or name" }),
    events: Schema.Array(Schema.Literals(['create', 'update', 'delete'])).annotate({
      description: 'The record events that start the flow',
    }),
  }),
  Schema.Struct({
    kind: Schema.Literal('form').annotate({ description: 'A form submission' }),
    form: Schema.String.annotate({ description: "The form's source id or name" }),
    fallback: Schema.optional(
      Schema.Literal('webhook').annotate({
        description:
          'What starts the flow when the form is not imported with it: the source tool can post its submissions to a webhook instead',
      })
    ),
    registration: Schema.optional(
      Schema.Struct({
        connection: Schema.String,
        operation: Schema.String,
        credential: Schema.optional(Schema.String),
      }).annotate({
        description:
          "The form app's connection operation that points the form at the fallback webhook, on the trigger's source credential",
      })
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal('manual').annotate({ description: 'Started by hand' }),
    todo: Schema.optional(
      Schema.String.annotate({
        description:
          'Why the automation is a TODO although its trigger maps: the source event it stands in for',
      })
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal('app-event').annotate({
      description: 'An event of a third-party app (a new email, a paid invoice)',
    }),
    app: Schema.String.annotate({ description: "The app in the source's own words" }),
    event: Schema.String.annotate({ description: "The event in the source's own words" }),
    inputs: Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: "The trigger's settings, verbatim",
    }),
    credential: Schema.optional(
      Schema.String.annotate({
        description:
          'The source credential the trigger runs with, as an opaque label unique within the export (an n8n credential id, a Zapier auth_id, a Make __IMTCONN__ id, prefixed by its kind). It is never a secret; a trigger and steps sharing it share one Sovrium connection, and two labels for one app become two connections',
        examples: ['n8n:gmailOAuth2:7', 'zapier:4410982', 'make:5531'],
      })
    ),
  }),
]).annotate({
  identifier: 'CanonicalTrigger',
  description: 'What starts a flow, in the source’s own terms.',
})

const stepBase = {
  id: Schema.String.annotate({
    description: "The step's id in the source (an n8n node name, a Make module id)",
  }).check(Schema.isMinLength(1)),
  name: Schema.String.annotate({ description: 'The label the source showed for the step' }),
}

/** One step of a flow. */
export const CanonicalStepSchema = Schema.Union([
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('app-action').annotate({
      description: 'An operation of a third-party app',
    }),
    app: Schema.String.annotate({ description: "The app in the source's own words" }),
    operation: Schema.String.annotate({ description: "The operation in the source's own words" }),
    inputs: Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'The mapped inputs, with templated values as `CanonicalExpression`s',
    }),
    credential: Schema.optional(
      Schema.String.annotate({
        description:
          'The source credential the step runs with, as an opaque label unique within the export (an n8n credential id, a Zapier auth_id, a Make __IMTCONN__ id, prefixed by its kind). It is never a secret; steps sharing it share one Sovrium connection, and two labels for one app become two connections',
        examples: ['n8n:gmailOAuth2:7', 'zapier:4410982', 'make:5531'],
      })
    ),
    withoutInputs: Schema.optional(
      Schema.Literal(true).annotate({
        description:
          'The export names the step but carries none of its inputs (an API dump); the step maps to its target and its inputs are a TODO',
      })
    ),
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('http').annotate({ description: 'A generic HTTP request' }),
    method: Schema.String.annotate({ description: 'The HTTP method' }),
    url: Schema.Unknown.annotate({ description: 'The URL, a string or a `CanonicalExpression`' }),
    urlEnv: Schema.optional(
      Schema.String.annotate({
        description:
          'The env variable the URL is read from, when the adapter knows the URL is a credential (a webhook address); the URL is then never written to the config',
        examples: ['WEBFLOW_WEBHOOK_CONTACT_URL'],
      })
    ),
    headers: Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'The request headers. A credential header is never copied, only named',
    }),
    body: Schema.optional(Schema.Unknown.annotate({ description: 'The request body' })),
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('code').annotate({ description: 'A block of user code' }),
    lang: Schema.Literals(['javascript', 'typescript', 'python', 'other']).annotate({
      description: 'The language of the code',
    }),
    source: Schema.String.annotate({
      description: 'The code, verbatim; kept as a comment of the TypeScript stub it becomes',
    }),
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('branch').annotate({ description: 'A router or an if/else' }),
    mode: Schema.optional(
      Schema.Literals(['first-match', 'all-matching']).annotate({
        description:
          "Whether only the first matching branch runs, or every matching one in order; absent, the source tool's own default applies",
      })
    ),
    branches: Schema.Array(
      Schema.Struct({
        name: Schema.String.annotate({ description: 'The branch label' }),
        condition: Schema.optional(CanonicalConditionSchema),
      })
    ).annotate({
      description: 'The branches, in order; a branch with no condition is the fallback',
    }),
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('filter').annotate({
      description: 'A gate: the flow continues only when the condition holds',
    }),
    condition: CanonicalConditionSchema,
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('loop').annotate({ description: 'An iterator over a list' }),
    over: Schema.Unknown.annotate({
      description: 'The list iterated, usually a `CanonicalExpression`',
    }),
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('delay').annotate({ description: 'A pause' }),
    duration: Schema.optional(
      Schema.String.annotate({ description: 'An ISO 8601 duration', examples: ['PT15M', 'P1D'] })
    ),
    until: Schema.optional(Schema.Unknown.annotate({ description: 'An instant to wait for' })),
  }),
  Schema.Struct({
    ...stepBase,
    kind: Schema.Literal('unknown').annotate({
      description: 'A step no registry entry maps; it becomes a TODO',
    }),
    sourceType: Schema.String.annotate({
      description: "The step's type in the source's own words",
    }),
    raw: Schema.Unknown.annotate({ description: "The step's definition, verbatim" }),
  }),
]).annotate({
  identifier: 'CanonicalStep',
  description: 'One step of a flow, in the source’s own terms.',
})

export type CanonicalStep = Schema.Schema.Type<typeof CanonicalStepSchema>

/** An edge of the step graph. */
export const CanonicalEdgeSchema = Schema.Struct({
  from: Schema.String.annotate({ description: 'The id of the step the edge leaves, or `trigger`' }),
  to: Schema.String.annotate({ description: 'The id of the step the edge reaches' }),
  branch: Schema.optional(
    Schema.String.annotate({
      description: 'For an edge leaving a branch, the branch label; for a loop, `body` or `done`',
    })
  ),
}).annotate({
  identifier: 'CanonicalEdge',
  description: 'A directed edge from one step to the next.',
})

/** The decoded result of one automation-source adapter, for one flow. */
export const CanonicalFlowSchema = Schema.Struct({
  tool: ImportSourceToolSchema,
  sourceId: Schema.String.annotate({ description: "The flow's id in the source" }),
  name: Schema.String.annotate({ description: 'The flow name the source showed' }).check(
    Schema.isMinLength(1)
  ),
  active: Schema.Boolean.annotate({
    description: 'Whether the flow was switched on in the source',
  }),
  trigger: Schema.Union([
    CanonicalTriggerSchema,
    Schema.Struct({
      kind: Schema.Literal('unknown').annotate({
        description: 'A trigger no registry entry maps; it becomes a TODO',
      }),
      sourceType: Schema.String.annotate({
        description: "The trigger's type in the source's own words",
      }),
      raw: Schema.Unknown.annotate({ description: "The trigger's definition, verbatim" }),
    }),
  ]).annotate({ description: 'What starts the flow' }),
  steps: Schema.Array(CanonicalStepSchema).annotate({ description: 'The steps, in source order' }),
  edges: Schema.Array(CanonicalEdgeSchema).annotate({ description: 'The step graph' }),
}).annotate({
  identifier: 'CanonicalFlow',
  title: 'Canonical Flow',
  description:
    'The intermediate model of a migrated automation: a trigger and a graph of steps, in the source’s own terms, with expressions tokenised.',
})

export type CanonicalFlow = Schema.Schema.Type<typeof CanonicalFlowSchema>
