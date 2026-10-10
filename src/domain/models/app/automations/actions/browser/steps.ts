/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { FileRefSchema } from '../document/shared'
import { BrowserStepLocatorSchema } from './step-locator'

/**
 * The steps of a `browser/run` action, played in order in one browser session.
 *
 * Every step is `{ do: <verb>, … }`. The verb set is closed and small on
 * purpose: these are the gestures a person makes on a form — open a page, fill
 * a field, pick an option, tick a box, attach a file, press a key, click — plus
 * the three a person makes with their eyes: wait for something, check it is
 * there, read it. There is no "evaluate JavaScript" verb: a step that needs one
 * is a site that needs an API, or a `code` action.
 *
 * Every value is a template string. The run's generic template pass does NOT
 * render `steps`: each value is rendered when its step is reached, inside the
 * driver, so a `$env` secret is typed into the page without ever being written
 * to the run's stored input, its trace or an error message.
 */

// ─── Fields every step takes ────────────────────────────────────────────────

const StepBaseFields = {
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'A short name for the step, shown in the run trace and in error messages instead of its position.',
      })
    )
  ),
  optional: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Skip the step, instead of failing the run, when its element does not appear in time. For something that only sometimes shows: a login form when a stored session is still signed in, a notice shown once.',
      })
    )
  ),
  timeoutMs: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '`timeouts.stepMs`, else `BROWSER_STEP_TIMEOUT_MS` (15000)',
        description:
          'How long this step waits for its element or its page, in milliseconds (100–120000).',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 120_000 }))
    )
  ),
}

/**
 * The per-step self-healing switch, on the six steps that act on or read one
 * element: `fill`, `click`, `select`, `check`, `upload`, `extract`.
 *
 * The checks (`assert`, `waitFor`) never heal — a suggestion standing in for a
 * failed check would turn the check into a formality — and neither does
 * `dismiss`, whose element is expected to be absent.
 */
const HealField = {
  heal: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: "the run's `selfHeal` (on when it is set)",
        description:
          'Whether a model may suggest another way of finding this element when it is not found. `false` keeps this step out of the run-wide `selfHeal`; `true` turns it on for this step alone. Refused on an `optional` step and on a click marked `irreversible`.',
      })
    )
  ),
}

/** The two steps a suggestion may never stand in for, whatever the run says. */
const healAllowed = (step: {
  readonly heal?: boolean | undefined
  readonly optional?: boolean | undefined
  readonly irreversible?: boolean | undefined
}): boolean => step.heal !== true || (step.optional !== true && step.irreversible !== true)

/** The message of {@link healAllowed}, the same on every step it guards. */
export const HEAL_REFUSED_MESSAGE =
  '`heal: true` is refused on an `optional` step (its element being absent is expected) and on a click marked `irreversible` (a suggestion never stands in for a submission)'

/** A field that takes the step's element. */
const target = BrowserStepLocatorSchema.pipe(
  Schema.annotate({ description: 'The element the step acts on.' })
)

/** A field that takes the step's element when the step may also watch the URL instead. */
const optionalTarget = Schema.optional(
  BrowserStepLocatorSchema.pipe(
    Schema.annotate({ description: 'The element to watch. Exactly one of `target` and `url`.' })
  )
)

/** A substring the current URL must contain. */
const optionalUrl = Schema.optional(
  TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'Text the address of the current page must contain (e.g. "/confirmation"). Exactly one of `target` and `url`.',
    }),
    Schema.check(Schema.isMinLength(1))
  )
)

const doLiteral = <V extends string>(verb: V, description: string) =>
  Schema.Literal(verb).pipe(Schema.annotate({ description }))

/** Exactly one of `target` and `url`. */
const exactlyTargetOrUrl = <T extends { readonly target?: unknown; readonly url?: unknown }>(
  step: T
): boolean => (step.target === undefined) !== (step.url === undefined)

// ─── The verbs ──────────────────────────────────────────────────────────────

export const BrowserGotoStepSchema = Schema.Struct({
  do: doLiteral('goto', 'Open a page.'),
  url: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'Address to open. Its host must be in `allowedHosts`; a fixed address on another host fails validation when the app starts, a templated one fails the step. It may read `$env.NAME` only for a variable the app declares with `secret: false` (the address is shown in the trace and the run output); a secret or undeclared variable refuses the app when it starts.',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  ...StepBaseFields,
}).annotate({ description: 'Open a page and wait for it to load.' })

export const BrowserFillStepSchema = Schema.Struct({
  do: doLiteral('fill', 'Type a value into a field.'),
  target,
  value: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'What to type. A `$env.NAME` value or `{{totp $env.NAME}}` code is typed without being recorded anywhere; any other value is recorded in the trace unless `sensitive` is set.',
    })
  ),
  sensitive: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'true when the value reads `$env`, else false',
        description:
          'Keep the typed value out of the trace and mask the field in screenshots. Always on for a value read from `$env`.',
      })
    )
  ),
  ...HealField,
  ...StepBaseFields,
})
  .annotate({
    description: 'Click into a field, clear it, and type a value, as a person typing would.',
  })
  .pipe(Schema.check(Schema.makeFilter(healAllowed, { message: HEAL_REFUSED_MESSAGE })))

/** Who may approve an irreversible click, and how long the filled form is held. */
export const BrowserConfirmSchema = Schema.Struct({
  message: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'The question shown to approvers, next to a screenshot of the filled form (e.g. "Submit the declaration for {{trigger.data.period}}?").',
    })
  ),
  approvers: Schema.optional(
    Schema.Union([
      Schema.Literal('all-admins'),
      Schema.Array(TemplateStringSchema).pipe(Schema.check(Schema.isMinLength(1))),
    ]).pipe(
      Schema.annotate({
        defaultNote: "'all-admins'",
        description:
          'Who may answer: "all-admins", or a list of email addresses and role names, as for an approval request.',
      })
    )
  ),
  timeout: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: '`BROWSER_HOLD_MAX_MS` (10 minutes)',
        description:
          'How long the browser is held open on the filled form waiting for an answer (e.g. "5m"). It cannot exceed `BROWSER_HOLD_MAX_MS`. With no answer by then the run is abandoned and nothing is submitted.',
      }),
      Schema.check(Schema.isPattern(/^\d+\s*(s|m|h)$/))
    )
  ),
}).annotate({
  description:
    'Ask a person before the click: the run waits with the browser open on the filled form, clicks after an approval in the same session, and submits nothing after a rejection or a timeout.',
})

export const BrowserClickStepSchema = Schema.Struct({
  do: doLiteral('click', 'Click an element.'),
  target,
  irreversible: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'This click commits something that cannot be taken back: it submits, pays, sends or deletes. It is never retried, a failure after it is reported as an unknown outcome rather than replayed, and with `idempotencyKey` it happens at most once per key.',
      })
    )
  ),
  confirm: Schema.optional(BrowserConfirmSchema),
  ...HealField,
  ...StepBaseFields,
})
  .annotate({ description: 'Click an element where it is drawn, as a pointer click.' })
  .pipe(
    Schema.check(
      Schema.makeFilter((step) => step.confirm === undefined || step.irreversible === true, {
        message: '`confirm` is only allowed on a click marked `irreversible: true`',
      }),
      Schema.makeFilter(healAllowed, { message: HEAL_REFUSED_MESSAGE })
    )
  )

export const BrowserSelectStepSchema = Schema.Struct({
  do: doLiteral('select', 'Choose an option in a list.'),
  target,
  option: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'The option to choose: its visible text, or else its value. An option that does not exist fails the step and names the options that do.',
    })
  ),
  ...HealField,
  ...StepBaseFields,
})
  .annotate({ description: 'Choose one option of a drop-down list.' })
  .pipe(Schema.check(Schema.makeFilter(healAllowed, { message: HEAL_REFUSED_MESSAGE })))

export const BrowserCheckStepSchema = Schema.Struct({
  do: doLiteral('check', 'Tick or untick a box.'),
  target,
  checked: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'true',
        description:
          'The state to leave the box in. A box already in that state is left alone, so the step can be replayed.',
      })
    )
  ),
  ...HealField,
  ...StepBaseFields,
})
  .annotate({ description: 'Set a checkbox, switch or radio button to a given state.' })
  .pipe(Schema.check(Schema.makeFilter(healAllowed, { message: HEAL_REFUSED_MESSAGE })))

export const BrowserUploadStepSchema = Schema.Struct({
  do: doLiteral('upload', 'Attach files to a file field.'),
  target,
  files: Schema.Array(FileRefSchema).pipe(
    Schema.annotate({
      description:
        'Files to attach, read like any file input of an action: a storage key, { key, bucket }, { step }, { asset }, { record } or { url }. Not every browser backend can attach files; one that cannot fails the step and says so.',
    }),
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(10))
  ),
  ...HealField,
  ...StepBaseFields,
})
  .annotate({ description: 'Attach one or more files to a file field.' })
  .pipe(Schema.check(Schema.makeFilter(healAllowed, { message: HEAL_REFUSED_MESSAGE })))

export const BrowserPressStepSchema = Schema.Struct({
  do: doLiteral('press', 'Press a key.'),
  key: Schema.String.pipe(
    Schema.annotate({
      description:
        'The key, by name: "Enter", "Tab", "Escape", "ArrowDown", a character, or a combination such as "Control+A".',
    }),
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(40))
  ),
  target: Schema.optional(
    BrowserStepLocatorSchema.pipe(
      Schema.annotate({
        description: 'Element to focus first. Without it the key goes to whatever has the focus.',
      })
    )
  ),
  ...StepBaseFields,
}).annotate({ description: 'Press a key or a key combination.' })

export const BrowserWaitForStepSchema = Schema.Struct({
  do: doLiteral('waitFor', 'Wait for an element or a page.'),
  target: optionalTarget,
  url: optionalUrl,
  state: Schema.optional(
    Schema.Literals(['visible', 'hidden']).pipe(
      Schema.annotate({
        defaultNote: "'visible'",
        description: 'With `target`: wait for the element to show, or to go away (a spinner).',
      })
    )
  ),
  ...StepBaseFields,
})
  .annotate({
    description:
      'Wait until an element shows (or goes away), or until the address contains some text. Fails the step when the wait times out.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter(
        (step) =>
          exactlyTargetOrUrl(step) && (step.state === undefined || step.target !== undefined),
        { message: '`waitFor` takes exactly one of `target` and `url`; `state` requires `target`' }
      )
    )
  )

export const BrowserAssertStepSchema = Schema.Struct({
  do: doLiteral('assert', 'Check the page says what it should.'),
  target: optionalTarget,
  url: optionalUrl,
  text: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'With `target`: text the element must contain.',
      })
    )
  ),
  ...StepBaseFields,
})
  .annotate({
    description:
      'Check that an element is there (and contains some text), or that the address contains some text. A failed check fails the run, so an automation never reports success for a form the site did not accept.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter(
        (step) =>
          exactlyTargetOrUrl(step) && (step.text === undefined || step.target !== undefined),
        { message: '`assert` takes exactly one of `target` and `url`; `text` requires `target`' }
      )
    )
  )

/** A key under which `extract` stores what it read. */
const OutputKeySchema = Schema.String.pipe(
  Schema.annotate({
    description:
      'Name the value is stored under in the step output (`{{steps.<step>.extracted.<as>}}`).',
  }),
  Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_]*$/))
)

/**
 * A regular expression that compiles.
 *
 * The pattern IS the feature: `extract.pattern` lets the config author keep
 * part of what a page shows, so escaping it would turn it into a literal. This
 * only compiles it, at decode time, and never matches anything here; the
 * driver applies it to page text later. Accepted for the reason the
 * `matchesRegex` condition is: config is authored by the operator, who already
 * controls the process.
 */
const isRegex = (source: string): boolean => {
  try {
    // eslint-disable-next-line sovrium/no-dynamic-regexp -- operator-supplied pattern is the documented feature; compiled to validate it, never run here
    return new RegExp(source) instanceof RegExp
  } catch {
    return false
  }
}

export const BrowserExtractStepSchema = Schema.Struct({
  do: doLiteral('extract', 'Read text from the page into the step output.'),
  target,
  as: OutputKeySchema,
  attribute: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Read this attribute (e.g. "href") instead of the visible text. Never `value` of a password field.',
      }),
      Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_:-]*$/))
    )
  ),
  pattern: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'A regular expression applied to what was read: its first group, or else the whole match, is kept (e.g. "REF-\\d+"). No match fails the step.',
      }),
      Schema.check(
        Schema.makeFilter(isRegex, { message: '`pattern` is not a valid regular expression' })
      )
    )
  ),
  all: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Read every matching element, as a list, instead of exactly one. For the rows of a table or the items of a list.',
      })
    )
  ),
  fields: Schema.optional(
    Schema.Record(Schema.String, BrowserStepLocatorSchema).pipe(
      Schema.annotate({
        description:
          'Read several values inside each matched element, each found by its own locator relative to it: the result is an object (a list of objects with `all`) keyed by these names.',
      })
    )
  ),
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '100',
        description:
          'With `all`: the most elements read (1–1000). The rest are ignored and the output says so.',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1000 }))
    )
  ),
  ...HealField,
  ...StepBaseFields,
})
  .annotate({
    description:
      'Read what the page shows — a confirmation number, a status, the rows of a table — into the step output, for later steps.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((step) => step.limit === undefined || step.all === true, {
        message: '`limit` requires `all: true`',
      }),
      Schema.makeFilter(healAllowed, { message: HEAL_REFUSED_MESSAGE })
    )
  )

export const BrowserScreenshotStepSchema = Schema.Struct({
  do: doLiteral('screenshot', 'Take a screenshot.'),
  name: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'File name for the picture, without extension. Defaults to the step position.',
      }),
      Schema.check(Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/))
    )
  ),
  fullPage: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description: 'Capture the whole page rather than the visible part.',
      })
    )
  ),
  ...StepBaseFields,
}).annotate({
  description:
    'Store a picture of the page with the run artifacts, whatever `artifacts.screenshots` says. Fields holding a sensitive value are masked.',
})

export const BrowserDismissStepSchema = Schema.Struct({
  do: doLiteral('dismiss', 'Close an overlay if it shows.'),
  target,
  ...StepBaseFields,
}).annotate({
  description:
    'Click the element if it appears within the step timeout — a cookie-consent button, a "what\'s new" notice — and carry on either way. Never fails the run for its absence.',
})

// ─── The union ──────────────────────────────────────────────────────────────

export const BrowserStepSchema = Schema.Union([
  BrowserGotoStepSchema,
  BrowserFillStepSchema,
  BrowserClickStepSchema,
  BrowserSelectStepSchema,
  BrowserCheckStepSchema,
  BrowserUploadStepSchema,
  BrowserPressStepSchema,
  BrowserWaitForStepSchema,
  BrowserAssertStepSchema,
  BrowserExtractStepSchema,
  BrowserScreenshotStepSchema,
  BrowserDismissStepSchema,
]).pipe(
  Schema.annotate({
    title: 'Browser Step',
    description:
      'One step of a browser run, selected by `do`: goto, fill, click, select, check, upload, press, waitFor, assert, extract, screenshot or dismiss.',
  })
)

/** @public */
export type BrowserStep = Schema.Schema.Type<typeof BrowserStepSchema>

/** The verbs a step may take, in the order the manual lists them. */
export const BROWSER_STEP_VERBS = [
  'goto',
  'fill',
  'click',
  'select',
  'check',
  'upload',
  'press',
  'waitFor',
  'assert',
  'extract',
  'screenshot',
  'dismiss',
] as const satisfies readonly BrowserStep['do'][]

// ─── Where `$env` may be read ───────────────────────────────────────────────

/** Whether a written string reads an environment variable (`$env.NAME`, `{{totp $env.NAME}}`). */
const READS_ENV = /\$env\./

/** Every string leaf of a value, with its dotted path. */
const stringLeaves = (value: unknown, path: string): readonly (readonly [string, string])[] => {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value))
    return value.flatMap((item, i) => stringLeaves(item, `${path}[${String(i)}]`))
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, item]) =>
    stringLeaves(item, path === '' ? key : `${path}.${key}`)
  )
}

/** A one-time code read from the environment (`{{totp $env.NAME}}`): always a secret. */
const READS_TOTP = /\{\{\s*totp\s+\$env\./

/**
 * Whether a field may read `$env` at all. Two fields may:
 *
 * - a `fill` step's `value`, the one place a `$env` value — or a
 *   `{{totp $env.NAME}}` code — is typed without being recorded;
 * - a `goto` step's `url`, for a variable the app declares `secret: false`
 *   (a base address that changes between environments). The schema cannot see
 *   the `env` declarations, so this only lets the reference through: the check
 *   that the variable is declared, and declared `secret: false`, runs when the
 *   app starts. A one-time code is never an address and stays refused here.
 *
 * Every other field is echoed somewhere a reader sees it: an option, a check's
 * text or a locator in the trace and in error messages, a confirmation message
 * to approvers. Masking by value is no defence there: a value a template
 * helper transformed matches nothing.
 */
const mayReadEnv = (step: Readonly<Record<string, unknown>>, path: string, text: string): boolean =>
  (step['do'] === 'fill' && path === 'value') ||
  (step['do'] === 'goto' && path === 'url' && !READS_TOTP.test(text))

/** The fields of a step that read `$env` where they may not, by dotted path. */
export const envReadsWhereRecorded = (step: Readonly<Record<string, unknown>>): readonly string[] =>
  stringLeaves(step, '')
    .filter(([path, text]) => READS_ENV.test(text) && !mayReadEnv(step, path, text))
    .map(([path]) => path)

/**
 * `true` when no step reads `$env` where it would be recorded, else the
 * message naming each step and field that does.
 */
export const refuseEnvWhereRecorded = (
  steps: readonly Readonly<Record<string, unknown>>[]
): true | string => {
  const refused = steps.flatMap((step, index) => {
    const fields = envReadsWhereRecorded(step)
    if (fields.length === 0) return []
    const label = typeof step['label'] === 'string' ? ` "${step['label']}"` : ''
    return [
      `browser step ${String(index + 1)}${label} (${String(step['do'])}) reads $env in ${fields.map((f) => `\`${f}\``).join(', ')}`,
    ]
  })
  return refused.length === 0
    ? true
    : `${refused.join('; ')}. A $env value can only be typed by a fill step's \`value\`, the one field that is never recorded, or read by a goto step's \`url\` when the variable is declared \`secret: false\`: an option, a checked text, a locator and a confirmation message are all shown in the run trace, its output or its error messages, and a one-time code is never part of an address.`
}
