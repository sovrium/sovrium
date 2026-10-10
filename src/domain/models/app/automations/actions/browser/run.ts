/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { BrowserStepSchema, refuseEnvWhereRecorded } from './steps'

/**
 * Browser Run Action (type: browser, operator: run)
 *
 * Drives a real browser through a fixed list of steps, for a website or a
 * service that has no API: sign in, fill a form, read a confirmation.
 *
 * What it will not do, by design and not by omission: solve CAPTCHAs, disguise
 * itself from a site's bot detection, or let a page reach a host the action
 * did not list. Whether a browser is available at all is the operator's
 * decision (`BROWSER_PROVIDER`, off on a server unless set), and so is which
 * one; the config only says what to do with it. A backend that cannot perform
 * a step (attaching a file, say) fails that step with a typed refusal at run
 * time — the config stays the same whatever the machine.
 */

/** A host a run may reach: `example.com`, `*.example.com`, optionally with a port. */
export const BROWSER_HOST_PATTERN =
  /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/i

export const BrowserAllowedHostSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      'A host name, optionally with a port: "app.example.com", "*.example.com" (any sub-domain, not the domain itself), "login.example.com:8443". Written out, never a template.',
  }),
  Schema.check(Schema.isPattern(BROWSER_HOST_PATTERN))
)

/** Lowercase slug naming a declared AI agent (`agents[].name`). */
const AGENT_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Self-healing that only suggests: after a locator miss, a model proposes
 * another way of finding the element from what the page shows, the run uses
 * that suggestion for this run only, and reports it. The config is never
 * written — on the desktop app, the user's own AI may apply a suggestion to
 * the config file through the config tools, like any other edit.
 */
export const BrowserSelfHealSchema = Schema.Union([
  Schema.Literal(true),
  Schema.Struct({
    agent: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          defaultNote: "the app's AI provider and model",
          description:
            'Name of a declared AI agent (`agents[].name`) whose model answers instead of the default one. Only its model is used: its tools, memory and approvals play no part.',
        }),
        Schema.check(Schema.isPattern(AGENT_NAME_PATTERN))
      )
    ),
  }).annotate({ description: 'Self-healing with a chosen model.' }),
]).pipe(
  Schema.annotate({
    description:
      'When an element is not found, ask a model for another way of finding it from what the page shows. The step is retried once with the suggestion — only when it matches exactly one visible element of the right kind — and the run output lists it under `healed`. The config is never changed. Never applies to a click marked `irreversible`, to an `optional` step, to `assert`, `waitFor` or `dismiss`; a step opts out with `heal: false`. The model is reached the way every AI call is, local first unless the operator says otherwise; page text is sent to it as data, never as instructions, and no value typed from `$env` is ever sent.',
  })
)

export const BrowserRunActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('browser').pipe(
    Schema.annotate({
      description: "Constant value 'browser' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('run').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'browser' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    allowedHosts: Schema.Array(BrowserAllowedHostSchema).pipe(
      Schema.annotate({
        description:
          'Every host the browser may reach during the run: the site, its sign-in provider, the hosts its pages load files from. A request to any other host is blocked, and a private-network address is refused unless the operator allows private outbound calls.',
      }),
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(50))
    ),
    session: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Name of a stored browser session to start from and save back to, so a run starts signed in when the last one left it signed in. Stored encrypted; saved only when the run succeeds. Two actions naming the same session share it.',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,63}$/))
      )
    ),
    idempotencyKey: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'A value naming the thing this run submits (e.g. "declaration-{{trigger.data.period}}"). A later run with a key that already went through skips its irreversible click and returns the reference stored the first time; a key whose earlier run stopped after that click without confirming it reports an unknown outcome for a person to check, and is never replayed.',
        }),
        Schema.check(Schema.isMinLength(1))
      )
    ),
    timeouts: Schema.optional(
      Schema.Struct({
        stepMs: Schema.optional(
          Schema.Finite.pipe(
            Schema.annotate({
              defaultNote: '`BROWSER_STEP_TIMEOUT_MS` (15000)',
              description:
                'How long each step waits for its element or page, in milliseconds (100–120000). A step can set its own `timeoutMs`.',
            }),
            Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 120_000 }))
          )
        ),
        runMs: Schema.optional(
          Schema.Finite.pipe(
            Schema.annotate({
              defaultNote: '`BROWSER_RUN_TIMEOUT_MS` (300000)',
              description:
                'How long the whole run may take, in milliseconds (1000–900000). Time spent waiting for a `confirm` answer does not count. When it runs out the browser is closed and the step fails.',
            }),
            Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1000, maximum: 900_000 }))
          )
        ),
      }).annotate({ description: 'Time limits for each step and for the whole run.' })
    ),
    artifacts: Schema.optional(
      Schema.Struct({
        bucket: Schema.optional(
          Schema.String.pipe(
            Schema.annotate({
              defaultNote: 'the system bucket',
              description:
                'Declared bucket the screenshots are written to. They are deleted after `BROWSER_ARTIFACT_RETENTION_DAYS` (30 days by default).',
            }),
            Schema.check(Schema.isMinLength(1))
          )
        ),
        screenshots: Schema.optional(
          Schema.Literals(['failure', 'steps', 'off']).pipe(
            Schema.annotate({
              defaultNote: "'failure'",
              description:
                "When pictures of the page are kept: 'failure' (one when the run fails), 'steps' (one after every step), 'off' (none; a `screenshot` step still takes its own). Fields holding a sensitive value are masked.",
            })
          )
        ),
      }).annotate({ description: 'Where the run keeps its screenshots, and when it takes them.' })
    ),
    selfHeal: Schema.optional(BrowserSelfHealSchema),
    steps: Schema.Array(BrowserStepSchema).pipe(
      Schema.annotate({
        description:
          'What to do, in order, in one browser session. Each step is { do: <verb>, … } and finds its element with a `target` locator. A `$env` value may only be read by the `value` of a `fill` step, or by the `url` of a `goto` step when the variable is declared `secret: false`.',
      }),
      Schema.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(200),
        Schema.makeFilter((steps) => refuseEnvWhereRecorded(steps))
      )
    ),
  }).annotate({
    description:
      'The hosts the browser may reach, the session it starts from, how a submission is kept from happening twice, time limits, screenshots, self-healing, and the steps.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'BrowserRunAction',
    title: 'Browser Run Action',
    description:
      'Drive a browser through fixed steps on a site with no API: sign in, fill a form, read the result. Needs the operator to enable a browser (`BROWSER_PROVIDER`).',
  })
)

/** @public */
export type BrowserRunAction = Schema.Schema.Type<typeof BrowserRunActionSchema>
