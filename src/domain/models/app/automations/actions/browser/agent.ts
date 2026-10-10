/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { BrowserAllowedHostSchema, BrowserRunActionSchema } from './run'

/**
 * Browser Agent Action (type: browser, operator: agent)
 *
 * Gives a model a goal and a starting page; the model looks at the page and
 * proposes one action at a time — the same gestures a `browser/run` step
 * makes — until it reports the goal done or runs out of steps.
 *
 * The model proposes; the driver decides. Every limit is held by the driver,
 * never by asking the model to respect it:
 *
 * - **Hosts**: the same `allowedHosts` guard as `browser/run`, on every
 *   request the page makes. A page that tells the model to go elsewhere
 *   reaches nothing.
 * - **Secrets**: the model is told the NAMES in `credentials`, never their
 *   values; the driver types the value, and masks it wherever the page shows
 *   it back.
 * - **Page text is data**: what a page says is handed to the model as the
 *   content of the page, never as instructions.
 * - **Sends** — any request but GET or HEAD an action made the page send — are
 *   held in the browser for a person (`approveSubmit`, on by default), the
 *   browser held open for at most `BROWSER_HOLD_MAX_MS`.
 * - **Model**: reached the way every AI call is, local first unless the
 *   operator says otherwise. A local model that cannot call tools fails the
 *   step with `agent_unavailable` rather than falling back somewhere else.
 */

/** A logical credential name: what the model is told, in place of the secret. */
const CREDENTIAL_NAME_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/

/** `$env.NAME`, or `{{totp $env.NAME}}` for a one-time code. */
const CREDENTIAL_VALUE_PATTERN =
  /^(\$env\.[A-Z][A-Z0-9_]*|\{\{\s*totp\s+\$env\.[A-Z][A-Z0-9_]*\s*\}\})$/

/** A field name of the agent's result. */
const OUTPUT_FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

const keysMatch =
  (accepts: (key: string) => boolean, max: number) =>
  (record: Readonly<Record<string, unknown>>): boolean => {
    const keys = Object.keys(record)
    return keys.length >= 1 && keys.length <= max && keys.every(accepts)
  }

const isCredentialName = (key: string): boolean => CREDENTIAL_NAME_PATTERN.test(key)
const isOutputField = (key: string): boolean => OUTPUT_FIELD_PATTERN.test(key)

const runProps = BrowserRunActionSchema.fields.props.fields

/** Whether a written string reads an environment variable. */
const READS_ENV = /\$env\./

/**
 * `true` when the agent reads `$env` only through `credentials`, else the
 * message naming each field that does not. The goal and the start address are
 * sent to the model and recorded in the trace; `credentials` is the one carrier
 * the driver types without the model, the trace or the output ever seeing the
 * value.
 */
const refuseEnvOutsideCredentials = (props: {
  readonly goal: string
  readonly startUrl: string
}): true | string => {
  const fields = (['goal', 'startUrl'] as const).filter((field) => READS_ENV.test(props[field]))
  return fields.length === 0
    ? true
    : `browser agent reads $env in ${fields.map((f) => `\`${f}\``).join(', ')}. The goal and the start address are sent to the model and recorded in the trace: name a secret in \`credentials\` instead, which the agent types without ever seeing it.`
}

export const BrowserAgentActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('browser').pipe(
    Schema.annotate({
      description: "Constant value 'browser' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('agent').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'browser' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    goal: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'What the agent should achieve, in plain words (e.g. "Download the September statement and report its total"). Rendered from the trigger and earlier steps, then sent to the model: it may not read `$env` — name a secret in `credentials`.',
      }),
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(4000))
    ),
    startUrl: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'The page the agent starts from. Its host must be in `allowedHosts`: a written-out address on another host fails validation when the app starts, a templated one fails the step. It may not read `$env`: the address is sent to the model and recorded in the trace.',
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    allowedHosts: Schema.Array(BrowserAllowedHostSchema).pipe(
      Schema.annotate({
        description:
          'Every host the browser may reach while the agent drives it. Held by the browser driver on every request the page makes, whatever the model asks for or a page tells it: a request to any other host is blocked, and a private-network address is refused unless the operator allows private outbound calls.',
      }),
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(50))
    ),
    session: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Name of a stored browser session to start from and save back to, shared with every `browser/run` naming it. Saved only when the agent reports the goal done.',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,63}$/))
      )
    ),
    maxSteps: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: '20',
          description:
            'The most actions the agent may take (1–100). Reaching it ends the step with `max_steps_reached`, the browser closed and nothing more done.',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))
      )
    ),
    credentials: Schema.optional(
      Schema.Record(Schema.String, Schema.String).pipe(
        Schema.annotate({
          description:
            'Secrets the agent may type without seeing them, by name (e.g. { portalPassword: "$env.PORTAL_PASSWORD", portalCode: "{{totp $env.PORTAL_TOTP_SECRET}}" }). The model is told only the names; the driver types the value, and masks it in what the model is shown afterwards, in the trace, in screenshots and in errors. Names are lowercase camelCase (up to 40 characters, at most 20 of them); each value is a `$env` reference or a `{{totp $env.NAME}}` one-time code.',
        }),
        Schema.check(
          Schema.makeFilter(keysMatch(isCredentialName, 20), {
            message:
              '`credentials` names are lowercase camelCase (e.g. portalPassword), 1 to 20 of them',
          }),
          Schema.makeFilter(
            (record: Readonly<Record<string, string>>) =>
              Object.values(record).every((value) => CREDENTIAL_VALUE_PATTERN.test(value)),
            {
              message:
                'each `credentials` value is `$env.NAME` or `{{totp $env.NAME}}`: a secret is never written into the config',
            }
          )
        )
      )
    ),
    output: Schema.optional(
      Schema.Record(Schema.String, Schema.Literals(['string', 'number', 'boolean'])).pipe(
        Schema.annotate({
          description:
            'The fields the agent must return when it reports the goal done, by name and type (e.g. { total: number, reference: string }). Up to 30. An answer missing a field, or with one of the wrong type, fails the step naming the field. Without it the agent returns a one-sentence summary only.',
        }),
        Schema.check(
          Schema.makeFilter(keysMatch(isOutputField, 30), {
            message:
              '`output` names 1 to 30 fields, each starting with a letter (letters, digits and underscores)',
          })
        )
      )
    ),
    approveSubmit: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          defaultNote: 'true',
          description:
            "Hold every send for a person's approval: a request with a method other than GET or HEAD that one of the agent's actions made the page send (a form posting data, a script's fetch or XHR POST) is held in the browser, and the run pauses with a screenshot and the method and address of each held request, the browser held open for at most `BROWSER_HOLD_MAX_MS`. Approved, each held request is let go once; rejected or unanswered, none leaves. A send the page makes on its own, and every beacon, are refused. `false` lets the agent send on its own.",
        })
      )
    ),
    timeouts: runProps.timeouts,
    artifacts: runProps.artifacts,
  })
    .annotate({
      description:
        'The goal, where the agent starts and may go, the session and secrets it may use, how many actions it may take, what it must return, and whether its submissions wait for approval. A `$env` value is read only through `credentials`.',
    })
    .pipe(Schema.check(Schema.makeFilter(refuseEnvOutsideCredentials))),
}).pipe(
  Schema.annotate({
    identifier: 'BrowserAgentAction',
    title: 'Browser Agent Action',
    description:
      'Let an AI agent drive a browser towards a goal on a site with no API, within listed hosts, typing secrets it never sees, its submissions held for approval. Needs the operator to enable a browser (`BROWSER_PROVIDER`) and an AI provider.',
  })
)

/** @public */
export type BrowserAgentAction = Schema.Schema.Type<typeof BrowserAgentActionSchema>
