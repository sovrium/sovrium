/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Path-based secret redaction for the live `App` configuration object.
 *
 * Backs the two config-reflection surfaces authorised by [internal ref] amendment A1
 * (`GET /api/admin/config/schema`, and the console's configuration-as-booted
 * view at `/_admin/changelog?view=current`).
 *
 * ─── WHY PATH-BASED AND NOT VALUE-MATCHING ──────────────────────────────────
 *
 * `redactSecretsForApp` is a VALUE-matching redactor: it collects known secret
 * strings and substring-replaces them. That works for the four
 * `SECRET_PROP_KEYS_BY_TYPE` connection props and for resolved `$env` values —
 * and for nothing else, because a hardcoded literal at an uncovered path is a
 * string nobody collected.
 *
 * `$env.X` references are resolved at USE time, per call site (`run-automation`,
 * `action-handlers/auth-headers`, `connections/oauth-flow`,
 * `automations/webhook-handler`) and NEVER at boot, so the in-memory `App` holds
 * the literal token `'$env.STRIPE_KEY'` rather than a credential. A
 * value-matching redactor therefore finds nothing to scrub in the `App` object
 * itself; the only real exposure is a config author hardcoding a literal, which
 * is exactly the case value-matching cannot reach.
 *
 * So this module redacts BY PATH — the precedent already in the codebase at
 * `src/presentation/api/routes/automations/index.ts` — and leaves
 * `redactSecretsForApp` as a defence-in-depth second pass at the endpoint.
 *
 * ─── TWO RULES THAT KEEP IT HONEST ──────────────────────────────────────────
 *
 * 1. **`$env.X` tokens SURVIVE.** A variable NAME is not a credential, and it is
 *    what tells the operator which variable feeds the field — precisely the
 *    observability A1 authorises. Stripping it would be a regression, not a
 *    hardening.
 * 2. **Never redact by key NAME globally.** `key` is overwhelmingly non-secret
 *    elsewhere in the schema (`env[].key`, `pages/vars`, `systemSources`,
 *    `agents/knowledge`), so a name-matching sweep false-positives badly. Every
 *    key below is scoped to a declared parent path.
 *
 * Structure is preserved throughout: only string LEAVES are replaced, so array
 * lengths and object keys survive. The shell's read-through count badges and the
 * schema explorer's tree both depend on that.
 *
 * @see [internal ref] (A1)
 * @see src/application/use-cases/automations/redact-secrets.ts
 */

import { redactSecretsForApp } from '@/application/use-cases/automations/redact-secrets'
import { ENV_REFERENCE_PATTERN } from '@/application/use-cases/automations/resolve-env-vars'
import { REDACTION_PLACEHOLDER } from '@/domain/models/api/admin/config'
import type { App } from '@/domain/models/app'

/** An opaque config node. The `App` object is walked structurally, not by type. */
type ConfigNode = Readonly<Record<string, unknown>>

/**
 * `app.connections[].props` — every credential-bearing prop across the four
 * connection variants, plus the two free-form param records an OAuth2
 * connection may carry (`extraAuthParams` / `extraTokenParams`), which are
 * `Record<string, string>` and so have no declared property a per-key rule could
 * name.
 */
const CONNECTION_SECRET_PROP_KEYS: readonly string[] = [
  'clientSecret',
  'key',
  'password',
  'token',
  'extraAuthParams',
  'extraTokenParams',
]

/**
 * Credential props on a webhook `auth` block.
 *
 * Deliberately the UNION of the automation-trigger `WebhookAuth` and the
 * table-webhook `WebhookAuth` — two separate schema identifiers with a
 * deliberate split, so a redactor keyed on one silently misses the other.
 */
const WEBHOOK_AUTH_SECRET_KEYS: readonly string[] = ['token', 'key', 'secret', 'password']

/** The incoming-webhook trigger's own HMAC signing secret (a sibling of `auth`). */
const TRIGGER_SECRET_KEYS: readonly string[] = ['secret']

/**
 * Credential-bearing props on an automation action.
 *
 * `secret` is the highest-risk uncovered path in the audit: `crypto`/`hmac`
 * REQUIRES it and carries no `$env` obligation, so a config author has no prompt
 * to route it through a variable. `headers` is typed
 * `Record<string, TemplateString>` — the classic home of a literal
 * `Authorization: Bearer …` — so the whole record is treated as opaque and
 * secret-bearing rather than probed key by key.
 */
const ACTION_SECRET_PROP_KEYS: readonly string[] = ['secret', 'password', 'headers']

/**
 * `app.env[].default` — the declared fallback for a variable.
 *
 * Redacted by DEFAULT, because `default: '3000'` and `default: 'sk_live_…'`
 * are the same shape, and by `buildEnvLookup` a default is a RESOLVED value
 * whenever it wins — the precise case an echo would expose.
 *
 * The polarity is safe-by-omission: a config written before the marker existed
 * keeps redacting. `EnvVarSchema` now carries the `secret` marker the earlier
 * note asked for, so an author who knows a default is harmless — a port, a
 * region, a base URL — opts it OUT with an explicit `secret: false` and reads
 * it verbatim on the configuration-as-booted view at
 * `/_admin/changelog?view=current` (see {@link redactEnvVar}).
 *
 * Where the value stays hidden the diagnostic still survives:
 * `GET /api/admin/env` reports `hasDefault` (is there a fallback at all?)
 * alongside `source: 'default'` (is it currently in force?).
 */
const ENV_SECRET_KEYS: readonly string[] = ['default']

const isRecord = (value: unknown): value is ConfigNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Whether a string carries a `$env.VAR_NAME` reference.
 *
 * Built fresh per call: `ENV_REFERENCE_PATTERN` is a shared `/g` regex and
 * `.test` would advance its `lastIndex` across calls.
 */
const containsEnvReference = (value: string): boolean =>
  new RegExp(ENV_REFERENCE_PATTERN.source).test(value)

/**
 * Replace one leaf, unless it is an `$env.` reference (a variable name, kept
 * visible by design). Non-strings pass through so a numeric or boolean sibling
 * inside a redacted record keeps its type.
 */
const redactLeaf = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  return containsEnvReference(value) ? value : REDACTION_PLACEHOLDER
}

/** Redact every string leaf beneath a node, preserving arrays and object keys. */
const redactDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => redactDeep(item))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactDeep(nested)])
    )
  }
  return redactLeaf(value)
}

/** Redact the named keys of a record when present, leaving every sibling intact. */
const redactKeys = (source: unknown, keys: readonly string[]): unknown => {
  if (!isRecord(source)) return source
  const patch = Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, redactDeep(source[key])])
  )
  return { ...source, ...patch }
}

/** Map over an array-valued property, leaving a non-array (or absent) value alone. */
const mapArrayProp = (
  node: ConfigNode,
  prop: string,
  fn: (item: unknown) => unknown
): Readonly<Record<string, unknown>> => {
  const value = node[prop]
  return Array.isArray(value) ? { [prop]: value.map((item) => fn(item)) } : {}
}

/**
 * Redact one automation action, recursing into the two composite action shapes.
 *
 * `path` actions nest their branches under `props.paths[].actions[]` and `loop`
 * actions under `props.actions[]` — the same two shapes `AppSchema`'s own
 * `collectAllActions` cross-validator walks. A redactor that skipped them would
 * cover the top-level HMAC key and leak the identical key one branch down.
 */
const redactAction = (action: unknown): unknown => {
  if (!isRecord(action)) return action
  const { props } = action
  if (!isRecord(props)) return action
  const withSecrets = redactKeys(props, ACTION_SECRET_PROP_KEYS) as ConfigNode
  return {
    ...action,
    props: {
      ...withSecrets,
      ...mapArrayProp(withSecrets, 'actions', redactAction),
      ...mapArrayProp(withSecrets, 'paths', redactPathBranch),
    },
  }
}

/** One `path`-action branch: a condition plus its own nested action list. */
const redactPathBranch = (branch: unknown): unknown => {
  if (!isRecord(branch)) return branch
  return { ...branch, ...mapArrayProp(branch, 'actions', redactAction) }
}

/** An automation trigger: its own `secret`, plus the credential in its `auth` block. */
const redactTrigger = (trigger: unknown): unknown => {
  if (!isRecord(trigger)) return trigger
  const base = redactKeys(trigger, TRIGGER_SECRET_KEYS) as ConfigNode
  if (base['auth'] === undefined) return base
  return { ...base, auth: redactKeys(base['auth'], WEBHOOK_AUTH_SECRET_KEYS) }
}

const redactAutomation = (automation: unknown): unknown => {
  if (!isRecord(automation)) return automation
  return {
    ...automation,
    ...(automation['trigger'] === undefined
      ? {}
      : { trigger: redactTrigger(automation['trigger']) }),
    ...mapArrayProp(automation, 'actions', redactAction),
  }
}

const redactWebhook = (webhook: unknown): unknown => {
  if (!isRecord(webhook) || webhook['auth'] === undefined) return webhook
  return { ...webhook, auth: redactKeys(webhook['auth'], WEBHOOK_AUTH_SECRET_KEYS) }
}

const redactTable = (table: unknown): unknown => {
  if (!isRecord(table)) return table
  return { ...table, ...mapArrayProp(table, 'webhooks', redactWebhook) }
}

const redactConnection = (connection: unknown): unknown => {
  if (!isRecord(connection) || connection['props'] === undefined) return connection
  return { ...connection, props: redactKeys(connection['props'], CONNECTION_SECRET_PROP_KEYS) }
}

/**
 * One declared env variable: its `default` redacted unless the author declared
 * `secret: false`, its `key` and `description` left verbatim.
 *
 * The identifiers are deliberately untouched. They are authored by the
 * operator, they are never values, and scrubbing them would make the very page
 * that reads them unreadable — an instance with `TIER=PROD` would see
 * `PROD_API_BASE` rewritten to `***_API_BASE`.
 *
 * Only the LITERAL `false` opts out. Anything else — `true`, an absent marker,
 * or a value that is not a boolean at all — redacts, so the safe polarity holds
 * for every config written before the marker existed and for one that mistypes
 * it. A base URL an operator needs in order to tell which upstream this
 * instance points at is the case the opt-out exists for; printing `***` there
 * says "a credential lives here", which is both unhelpful and untrue.
 */
const redactEnvVar = (envVar: unknown): unknown =>
  isRecord(envVar) && envVar['secret'] === false ? envVar : redactKeys(envVar, ENV_SECRET_KEYS)

/** A reusable `app.actions[]` template wraps a single action under `action`. */
const redactActionTemplate = (template: unknown): unknown => {
  if (!isRecord(template) || template['action'] === undefined) return template
  return { ...template, action: redactAction(template['action']) }
}

/**
 * Redact every known secret-bearing PATH of an `App`-shaped object.
 *
 * Pure and structure-preserving: array lengths, object keys and non-string
 * leaves all survive, so anything reading the result for its SHAPE (the shell's
 * count badges, the schema explorer's tree) is unaffected.
 *
 * @public
 */
export function redactAppConfigPaths(app: ConfigNode): ConfigNode {
  return {
    ...app,
    ...mapArrayProp(app, 'connections', redactConnection),
    ...mapArrayProp(app, 'automations', redactAutomation),
    ...mapArrayProp(app, 'tables', redactTable),
    ...mapArrayProp(app, 'actions', redactActionTemplate),
    ...mapArrayProp(app, 'env', redactEnvVar),
  }
}

/**
 * The full reflection redactor: the path pass above, then `redactSecretsForApp`
 * as a value-matching second pass.
 *
 * The second pass is defence in depth, not the mechanism — it catches a
 * connection literal that was COPIED to some path this module does not know
 * about, and any resolved `$env` value that reached the object. It is applied at
 * the endpoint only: a blanket substring scrub can rewrite an unrelated
 * identifier that happens to equal an env value, so a caller that renders
 * identifiers takes the path pass alone.
 *
 * @public
 */
export function redactAppConfigForReflection(
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): ConfigNode {
  const byPath = redactAppConfigPaths(app as unknown as ConfigNode)
  return redactSecretsForApp(
    byPath,
    app.env,
    processEnv,
    app.connections as unknown as ReadonlyArray<ConfigNode> | undefined
  ) as ConfigNode
}
