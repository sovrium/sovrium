/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { validateAllFormsReferences } from '../shared/forms-validation'
import { isResolvableColumnName } from '../shared/system-fields'
import { ActionTemplatesSchema } from './actions'
import { AgentsSchema } from './agents'
import { validateAllAgentApprovalRules } from './agents/approval-validation'
import { validateAllKnowledgeReferences } from './agents/knowledge-validation'
import { validateAllAiAccessRules } from './ai-access-validation'
import { BuiltInAnalyticsSchema } from './analytics'
import { AuthSchema } from './auth'
import { type Action, AutomationsSchema } from './automations'
import { BadgeSchema } from './badge'
import { BucketsSchema } from './buckets'
import { ComponentsSchema } from './components'
import { ConnectionsSchema } from './connections'
import { DescriptionSchema } from './description'
import { DesignSchema } from './design'
import { validateAllDesignReferences } from './design-validation'
import { EnvVarsSchema } from './env'
import { FormsSchema } from './forms'
import { LanguagesSchema } from './languages'
import { LinksSchema } from './links'
import { validateAllLinkRules } from './links-validation'
import { LlmsSchema } from './llms'
import { NameSchema } from './name'
import { validateAllPageAccessGroups } from './page-access-validation'
import { PagesSchema } from './pages'
import { PaletteSchema } from './palette'
import { validateAllQrCodePayloads } from './qr-code-validation'
import { RedirectsSchema } from './redirects'
import { validateAllRedirectRules } from './redirects-validation'
import { validateAllRoleReferences, validateTableRoleReferences } from './role-validation'
import { validateAllSelectOptionSources } from './select-option-source-validation'
import { validateAllShareRules } from './share-validation'
import { validateAllSystemSourceReferences } from './system-source-validation'
import { SystemSourceCatalogSchema } from './systemSources'
import { validateAllTablePermissionGroups } from './table-permission-validation'
import { TablesSchema } from './tables'
import { ThemeSchema } from './theme'
import { VersionSchema } from './version'

/**
 * Flatten an action list into every action it can reach, descending through the
 * two container actions that nest others: `path` (one branch per condition) and
 * `loop` (one body repeated per item).
 *
 * Module-scoped because the cross-validation refinements below each need the
 * same walk, and each had grown its own byte-identical copy. Per-refinement
 * copies are how one rule comes to check nested actions while its neighbour
 * silently checks only the top level — the drift that lets a typo inside a
 * `path` branch validate.
 */
const collectAllActions = (actions: ReadonlyArray<Action>): ReadonlyArray<Action> => {
  return actions.flatMap((action) => {
    const pathActions =
      action.type === 'path'
        ? action.props.paths.flatMap((p) => collectAllActions(p.actions as ReadonlyArray<Action>))
        : []
    const loopActions =
      action.type === 'loop' ? collectAllActions(action.props.actions as ReadonlyArray<Action>) : []
    return [action, ...pathActions, ...loopActions]
  })
}

/**
 * Whether a config value is resolved at RUN time, leaving no name to check
 * statically.
 *
 * The predicate is deliberately the runtime's own — `resolveTriggerInString`
 * fast-paths on `!input.includes('{{')`. A validator that decides "is this a
 * template?" differently from the engine that expands it is how the two come to
 * reach opposite verdicts on one config.
 */
const isRuntimeResolvedValue = (value: string): boolean =>
  value.includes('{{') || value.startsWith('$env.')

/**
 * How a record action's config named a column, phrased for the refusal message.
 *
 * The verb carries real information: an author who mistyped a column now has
 * THREE candidate surfaces to go and look at, and "'knid' does not exist" alone
 * does not say which. `filters on` is byte-identical to what shipped and must
 * stay so — two E2E criteria assert that sentence verbatim.
 */
type ColumnRefKind = 'filters on' | 'sorts on' | 'selects'

interface ColumnRef {
  readonly field: string
  readonly kind: ColumnRefKind
}

/**
 * Every prop on a record action that names a column: the condition fields of
 * `filter` (update / delete / upsert / batchDelete), the `sort` keys and
 * `fields` selection of `list`, and `batchUpsert`'s `matchField`.
 *
 * `sort` joined this set with [internal ref]'s `record/list`, and it is the WORSE of
 * the filter/sort pair. An unknown filter field returns a visibly wrong row set;
 * an unknown sort key returns the right rows in an arbitrary order and reports
 * success — on SQLite the quoted unknown name resolves to a string constant, so
 * every row sorts by the same value and no reordering happens at all. Combined
 * with a `limit` that is an arbitrary page, delivered as if it were the top N.
 *
 * `fields` is here for a DIFFERENT reason, and the distinction is worth stating
 * because it decides what this rule is for. Unlike the other three it does NOT
 * reach SQL: an automation's `fields` is a payload trim applied in memory to
 * rows already fetched, so no identifier is ever emitted and no dialect can
 * misread one. It earns the check by being the quietest of the four — a typo
 * yields rows without that key, every `{{…records.0.tittle}}` downstream
 * expands to nothing, and the run reports success with no error anywhere. This
 * rule is about names that do not exist, not solely about SQL injection
 * surfaces.
 *
 * `record/read` left this set in the same change: since [internal ref] it is
 * primary-key-only and has no author-supplied identifier left to adjudicate.
 *
 * `batchUpdate` is absent by nature, not by omission — its per-item filters
 * arrive inside a `{{...}}` template and do not exist at config time.
 */
const recordActionColumnRefs = (props: Readonly<Record<string, unknown>>): readonly ColumnRef[] => {
  const { filter, matchField, sort, fields } = props as {
    readonly filter?: unknown
    readonly matchField?: unknown
    readonly sort?: unknown
    readonly fields?: unknown
  }
  const conditions =
    filter && typeof filter === 'object'
      ? (filter as { readonly conditions?: unknown }).conditions
      : undefined
  const conditionRefs: readonly ColumnRef[] = Array.isArray(conditions)
    ? conditions.flatMap((condition) => {
        if (!condition || typeof condition !== 'object') return []
        const { field } = condition as { readonly field?: unknown }
        return typeof field === 'string' ? [{ field, kind: 'filters on' as const }] : []
      })
    : []
  // `matchField` keeps the FILTER wording deliberately: it is `batchUpsert`'s
  // equivalent of a filter condition, and a third verb for it would say the
  // same thing in one more voice.
  const matchRefs: readonly ColumnRef[] =
    typeof matchField === 'string' ? [{ field: matchField, kind: 'filters on' as const }] : []
  const sortRefs: readonly ColumnRef[] = Array.isArray(sort)
    ? sort.flatMap((key) => {
        if (!key || typeof key !== 'object') return []
        const { field } = key as { readonly field?: unknown }
        return typeof field === 'string' ? [{ field, kind: 'sorts on' as const }] : []
      })
    : []
  // `record/create` and `record/update` also carry a `fields` prop, but theirs
  // is a WRITE PAYLOAD — an object keyed by column name — while `list`'s is an
  // array of names. Reading only the array shape is what keeps this from
  // adjudicating the wrong prop on the wrong operator without needing to switch
  // on `operator` here.
  const selectionRefs: readonly ColumnRef[] = Array.isArray(fields)
    ? fields.flatMap((name) =>
        typeof name === 'string' ? [{ field: name, kind: 'selects' as const }] : []
      )
    : []
  return [...conditionRefs, ...matchRefs, ...sortRefs, ...selectionRefs]
}

/**
 * AppSchema defines the structure of an application configuration.
 *
 * This schema represents the core metadata for any application built
 * with Sovrium, including its name, optional version, and optional description.
 *
 * @example
 * ```typescript
 * const myApp = {
 *   name: 'todo-app',
 *   version: '1.0.0',
 *   description: 'A simple todo list application',
 * }
 *
 * const validated = Schema.decodeUnknownSync(AppSchema)(myApp)
 * ```
 */
export const AppSchema = Schema.Struct({
  /**
   * The name of the application.
   *
   * Must follow npm package naming conventions:
   * - Lowercase only
   * - Maximum 214 characters (including scope for scoped packages)
   * - Cannot start with a dot or underscore
   * - Cannot contain leading/trailing spaces
   * - Cannot contain non-URL-safe characters
   * - Scoped packages: @scope/package-name format allowed
   * - Can include hyphens and underscores (but not at the start)
   */
  name: NameSchema,

  /**
   * The version of the application (optional).
   *
   * Must follow Semantic Versioning (SemVer) 2.0.0 specification:
   * - Format: MAJOR.MINOR.PATCH (e.g., 1.0.0)
   * - No leading zeros in version components
   * - Optional pre-release identifiers (e.g., 1.0.0-alpha)
   * - Optional build metadata (e.g., 1.0.0+build.123)
   */
  version: Schema.optional(VersionSchema),

  /**
   * A description of the application (optional).
   *
   * Must be a single-line string:
   * - No line breaks allowed (\n, \r, or \r\n)
   * - No maximum length restriction
   * - Can contain any characters except line breaks
   * - Unicode characters and emojis are supported
   */
  description: Schema.optional(DescriptionSchema),

  /**
   * "Built with Sovrium" badge (optional).
   *
   * Controls the small badge pill rendered bottom-right by default on all
   * pages (positive polarity: omitted or `true` = shown, `false` = hidden).
   * Removal is free forever — one config line, never license-gated. The badge
   * is a static SSR link with zero telemetry; its label follows the page's
   * active locale (en/fr, English fallback) and is hard-coded OFF on the
   * `/_admin` operator console.
   */
  badge: Schema.optional(BadgeSchema),

  /**
   * Data tables that define the data structure (optional).
   *
   * Collection of database tables that define the data structure of your application.
   * Each table represents an entity (e.g., users, products, orders) with fields that
   * define the schema. Tables support relationships, indexes, constraints, and various
   * field types.
   */
  tables: Schema.optional(TablesSchema),

  /**
   * Design tokens (optional). **Deprecated alias for `design.theme`.**
   *
   * Unified design tokens for colors, typography, spacing, animations, breakpoints,
   * shadows, and border radius. Theme applies globally to all pages via className
   * utilities and CSS variables.
   *
   * `design.theme` is the canonical position. This top-level key still decodes
   * and is normalized into `design.theme` at the config-decode boundary, because
   * it is shipped public contract — v0.22.2, `@sovrium/types`, the published
   * JSON Schema, 18 templates, both production apps, every customer config — and
   * a hard removal would strand all of them for a rename. Declaring BOTH is a
   * decode-time error, never a silent merge. The alias is removed at the next
   * major.
   */
  theme: Schema.optional(ThemeSchema),

  /**
   * The app's design system (optional).
   *
   * One key holding what a design system must carry: the tokens (`design.theme`,
   * canonical position for what top-level `theme` also accepts), the principles
   * behind them, the app's voice and its tone per situation, and the usage rules
   * that say what a colour and a component are FOR.
   *
   * The last four had no home in the schema at all. Together they are what lets
   * an author — or an agent building on their behalf — be HANDED the app's
   * design rules instead of inferring them from the tokens.
   */
  design: Schema.optional(DesignSchema),

  /**
   * Multi-language support configuration (optional).
   *
   * Defines supported languages, default language, translations, and i18n behavior
   * (browser detection, persistence). Pages reference translations using $t: syntax.
   */
  languages: Schema.optional(LanguagesSchema),

  /**
   * Authentication configuration (optional).
   *
   * Enables authentication features including email/password authentication,
   * user management, and organization support. Configure authentication providers
   * and optional plugins (admin, organization) based on application requirements.
   */
  auth: Schema.optional(AuthSchema),

  /**
   * Built-in analytics configuration (optional).
   *
   * Enables first-party, privacy-friendly analytics tracking without cookies
   * or external dependencies. Configure data retention, excluded paths,
   * session timeout, and Do Not Track behavior.
   */
  analytics: Schema.optional(BuiltInAnalyticsSchema),

  /**
   * Reusable UI components (optional).
   *
   * Array of reusable component templates with variable substitution. Components are
   * defined once at app level and referenced across pages using $ref syntax with
   * $vars for dynamic content.
   */
  components: Schema.optional(ComponentsSchema),

  /**
   * Marketing and content pages (optional).
   *
   * Array of page configurations with server-side rendering support. Pages use a
   * component-based system with comprehensive metadata, theming, and i18n support.
   * Minimum of 1 page required when pages property is present.
   */
  pages: Schema.optional(PagesSchema),

  /**
   * Retired URLs and their replacements (optional).
   *
   * Each rule answers a path with an HTTP redirect (default 301) so
   * restructuring an app never breaks an indexed link, a bookmark or a backlink.
   * Without this, a retired path can only 404 — `access.redirectTo` covers auth
   * denial and `forms.onSuccess` covers post-submit, but neither retires a URL.
   *
   * A `from` authored without a language prefix matches the bare path AND every
   * language-prefixed variant the page router serves, and a path `to` inherits
   * the request's language prefix. Rules are evaluated AFTER static assets (a
   * real public-directory file always wins) and BEFORE page resolution.
   * When present, must declare at least one rule.
   */
  redirects: Schema.optional(RedirectsSchema),

  /** Tracked short links served at /l/{slug}. */
  links: Schema.optional(LinksSchema),

  /**
   * Standalone forms (optional).
   *
   * Top-level form definitions addressable by name. Forms can be rendered as
   * public routes (`path`), embedded in pages via the `type: 'form'` component
   * with `formRef`, or referenced by automation form triggers via `form: <name>`.
   *
   * Forms are independent of `pages` — an app can ship with ONLY forms and no
   * pages. When present, must contain at least one form definition.
   */
  forms: Schema.optional(FormsSchema),

  /**
   * External service connections (optional).
   *
   * Defines authenticated connections to external services for use in
   * automation HTTP actions. Supports OAuth2, API key, basic auth, and
   * bearer token. Referenced in actions as $connection.NAME.
   */
  connections: Schema.optional(ConnectionsSchema),

  /**
   * Environment variables for automations (optional).
   *
   * Defines expected environment variables used by automation actions.
   * Values are resolved at runtime and NEVER logged in execution history.
   * Referenced in action params as $env.VAR_NAME.
   */
  env: Schema.optional(EnvVarsSchema),

  /**
   * Reusable action templates (optional).
   *
   * Preconfigured action templates that can be referenced across automations
   * using the $ref pattern with $vars for customization. Similar to how
   * components work for pages.
   */
  actions: Schema.optional(ActionTemplatesSchema),

  /**
   * Workflow automations (optional).
   *
   * Define event-driven workflows with triggers and sequential actions.
   * Automations can reference table data, send HTTP requests, execute code,
   * and more. Use template variables ({{stepName.property}}) for data flow.
   */
  automations: Schema.optional(AutomationsSchema),

  /**
   * AI agent configurations (optional).
   *
   * Array of autonomous AI agents that can perform actions on behalf of users.
   * Each agent operates under an auth role with configurable approval workflows,
   * tool access, rate limits, and scheduling. Requires auth and AI_PROVIDER env var.
   */
  agents: Schema.optional(AgentsSchema),

  /**
   * Named storage buckets (optional).
   *
   * Array of named storage containers with per-bucket permissions, file constraints,
   * and public/private toggle. Infrastructure credentials (S3 keys, local path) are
   * configured via env vars. Buckets define application-level file organization.
   *
   * When omitted, an implicit 'default' bucket is used at runtime.
   */
  buckets: Schema.optional(BucketsSchema),

  /**
   * LLMs.txt configuration (optional).
   *
   * Controls the auto-generated `/llms.txt` and `/llms-full.txt` routes
   * (llmstxt.org). When omitted, the routes are auto-derived from any
   * content-directory pages. Use `enabled: false` to disable, or
   * `title`/`description` to override the generated heading and blockquote.
   */
  llms: Schema.optional(LlmsSchema),

  /**
   * Command-palette configuration (optional).
   *
   * Controls the platform-synthesized Cmd+K command palette that Sovrium
   * appends to every page. Enabled by default. Use `palette: { enabled: false }`
   * to opt out when the app ships its own Cmd+K search overlay (prevents two
   * overlays opening on the same keystroke).
   */
  palette: Schema.optional(PaletteSchema),

  /**
   * Named system-source catalog (optional).
   *
   * Declares reusable system read-endpoint sources ONCE, addressable by name.
   * A data component then binds to one by reference with the
   * `dataSource: { systemSource: <name> }` shorthand instead of inlining a raw
   * `{ system: { endpoint } }` path — decoupling the config from REST paths and
   * letting `sovrium validate` check (offline) that every reference resolves.
   * When present, must declare at least one source with unique names.
   */
  systemSources: Schema.optional(SystemSourceCatalogSchema),
}).pipe(
  Schema.annotate({
    identifier: 'App',
    title: 'Application Configuration',
    description:
      'Complete application configuration including name, version, description, and data tables. This is the root schema for Sovrium applications.',
    examples: [
      {
        name: 'todo-app',
        version: '1.0.0',
        description: 'A simple todo list application',
        tables: [
          {
            id: 1,
            name: 'tasks',
            fields: [
              {
                id: 1,
                name: 'title',
                type: 'single-line-text' as const,
                required: true,
              },
              { id: 2, name: 'completed', type: 'checkbox' as const, required: true },
            ],
          },
        ],
      },
      {
        name: '@myorg/dashboard',
        version: '2.0.0-beta.1',
        description: 'Admin dashboard for analytics and reporting',
      },
      {
        name: 'blog-system',
      },
    ],
  }),
  Schema.check(
    Schema.makeFilter((app) => {
      const userFieldTypes = new Set(['user', 'created-by', 'updated-by'])
      const hasUserFields =
        app.tables?.some((table) => table.fields.some((field) => userFieldTypes.has(field.type))) ??
        false

      if (hasUserFields && !app.auth) {
        return 'User fields (user, created-by, updated-by) require auth configuration'
      }
      return true
    })
  ),
  Schema.check(
    Schema.makeFilter((app) => {
      // Only validate role references in permissions when auth is explicitly configured.
      if (!app.auth) return true
      // Table permissions are validated as soon as auth exists (built-in + custom
      // roles); bucket/trigger permissions stay format-only unless `auth.roles`
      // is declared (handled inside validateAllRoleReferences).
      const tableError = validateTableRoleReferences(app)
      if (tableError !== true) return tableError
      return validateAllRoleReferences(app)
    })
  ),
  // Bucket reference cross-validation: attachment field bucket references must exist in app.buckets
  Schema.check(
    Schema.makeFilter((app) => {
      // Only validate when both buckets and tables are configured
      if (!app.buckets || !app.tables) return true

      const bucketNames = new Set(app.buckets.map((b) => b.name))
      const errors = app.tables.flatMap((table) =>
        table.fields
          .filter(
            (field): field is typeof field & { bucket: string } =>
              (field.type === 'single-attachment' || field.type === 'multiple-attachments') &&
              'bucket' in field &&
              typeof (field as Record<string, unknown>).bucket === 'string'
          )
          .filter((field) => !bucketNames.has(field.bucket))
          .map(
            (field) =>
              `Table '${table.name}' field '${field.name}' references undefined bucket '${field.bucket}'. Valid buckets: ${Array.from(bucketNames).join(', ')}`
          )
      )

      return errors.length > 0 ? errors[0] : true
    })
  ),
  // Automation cross-validation: record triggers/actions must reference existing tables
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations || !app.tables) return true

      const tableNames = new Set(app.tables.map((t) => t.name))

      const triggerError = app.automations.find(
        (a) => a.trigger.type === 'record' && !tableNames.has(a.trigger.table)
      )
      if (triggerError) {
        const trigger = triggerError.trigger as { readonly table: string }
        return `Automation '${triggerError.name}' record trigger references table '${trigger.table}' which does not exist`
      }

      const actionError = app.automations
        .flatMap((a) =>
          collectAllActions(a.actions as ReadonlyArray<Action>)
            .filter(
              (
                action
              ): action is Action & {
                readonly type: 'record'
                readonly props: { readonly table: string }
              } => action.type === 'record' && !tableNames.has(action.props.table)
            )
            .map((action) => ({ automation: a.name, action }))
        )
        .at(0)
      if (actionError) {
        return `Automation '${actionError.automation}' record action '${actionError.action.name}' references table '${actionError.action.props.table}' which does not exist`
      }

      return true
    })
  ),
  // Automation cross-validation: auth triggers/actions require auth config
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const hasAuthTrigger = app.automations.some((a) => a.trigger.type === 'auth')
      if (hasAuthTrigger && !app.auth) {
        return 'Auth triggers require auth configuration to be enabled'
      }

      const hasAuthAction = app.automations.some((a) =>
        a.actions.some((action) => action.type === 'auth')
      )
      if (hasAuthAction && !app.auth) {
        return 'Auth actions require auth configuration to be enabled'
      }
      return true
    })
  ),
  // Automation cross-validation: analytics actions require analytics config
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const hasAnalyticsAction = app.automations.some((a) =>
        a.actions.some((action) => action.type === 'analytics')
      )
      if (hasAnalyticsAction && !app.analytics) {
        return 'Analytics actions require analytics configuration to be enabled'
      }
      return true
    })
  ),
  // Automation cross-validation: record trigger watchFields must reference existing fields
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations || !app.tables) return true

      const tableFieldMap = new Map(
        app.tables.map((t) => [t.name, new Set(t.fields.map((f) => f.name))])
      )

      const watchFieldError = app.automations
        .filter(
          (a): a is typeof a & { readonly trigger: { readonly type: 'record' } } =>
            a.trigger.type === 'record'
        )
        .flatMap((a) => {
          const trigger = a.trigger as {
            readonly table: string
            readonly watchFields?: readonly string[]
          }
          const tableFields = tableFieldMap.get(trigger.table)
          if (!trigger.watchFields || !tableFields) return []
          return trigger.watchFields
            .filter((field) => !tableFields.has(field))
            .map((field) => ({ automation: a.name, field, table: trigger.table }))
        })
        .at(0)

      if (watchFieldError) {
        return `Automation '${watchFieldError.automation}' watchField '${watchFieldError.field}' does not exist in table '${watchFieldError.table}'`
      }
      return true
    })
  ),
  // Automation cross-validation: record trigger condition fields must reference
  // existing fields.
  //
  // A record trigger has TWO field-name surfaces and only `watchFields` was
  // checked. `trigger.condition[].field` never becomes a SQL identifier —
  // `evaluateRecordTriggerCondition` resolves it in memory against the event's
  // record — so there is no mass-deletion path and no dialect asymmetry here.
  // The silence is worse instead, because it runs in BOTH directions and
  // neither leaves a trace: `isEmpty`/`isNull` answer on the VALUE alone, so a
  // name resolving to `undefined` reads as "empty" and the automation OVER-fires
  // on every event as though no condition had been written, while
  // `isNotEmpty`/`isNotNull` invert that and the automation NEVER fires. The
  // second direction produces no failed run, no error and no log line at all —
  // boot is the last place it is still observable.
  //
  // The two exemptions are the record-action rule's, for the same reasons: a
  // `{{...}}` field is only knowable at run time, and system columns exist
  // without appearing in `fields[]`.
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations || !app.tables) return true

      const tableFieldMap = new Map(
        app.tables.map((t) => [t.name, new Set(t.fields.map((f) => f.name))])
      )

      const conditionFieldError = app.automations
        .filter(
          (a): a is typeof a & { readonly trigger: { readonly type: 'record' } } =>
            a.trigger.type === 'record'
        )
        .flatMap((a) => {
          const trigger = a.trigger as {
            readonly table: string
            readonly condition?: { readonly conditions?: readonly { readonly field?: unknown }[] }
          }
          const tableFields = tableFieldMap.get(trigger.table)
          // An unknown table is the TABLE rule's verdict, not this one's.
          if (!tableFields) return []
          return (trigger.condition?.conditions ?? [])
            .flatMap((condition) => (typeof condition.field === 'string' ? [condition.field] : []))
            .filter((field) => !isRuntimeResolvedValue(field))
            .filter((field) => !isResolvableColumnName(tableFields, field))
            .map((field) => ({ automation: a.name, field, table: trigger.table }))
        })
        .at(0)

      if (conditionFieldError) {
        return `Automation '${conditionFieldError.automation}' trigger condition field '${conditionFieldError.field}' does not exist in table '${conditionFieldError.table}'`
      }
      return true
    })
  ),
  // Automation cross-validation: record-action column references must name real
  // columns.
  //
  // A record action's `filter.conditions[].field`, `batchUpsert.matchField` and
  // `list.sort[].field` become SQL IDENTIFIERS, and the two dialects disagree
  // about an unknown one in the worst possible direction. Postgres raises 42703
  // and the action fails closed. SQLite — the zero-config DEFAULT engine —
  // resolves a double-quoted name that matches no column to a string LITERAL,
  // so `"knid" <> 'zzz'` compares the constant 'knid' against 'zzz' on every
  // row and the predicate matches the WHOLE TABLE. Whether that happens turns
  // on the OPERAND, not the operator: `equals 'knid'` and `contains 'ni'` are
  // tautologies while `equals 'alpha'` fails closed, so no subset of operators
  // is safe to exempt. On a `record/delete` that is a silent mass-deletion
  // reported as success.
  //
  // A `sort` key degrades differently and no less quietly: `ORDER BY "knid"`
  // orders every row by that same string constant, so the rows come back in an
  // arbitrary order with a SUCCESSFUL run and nothing saying the ordering was
  // never applied — and under a `limit` that arbitrary order picks the page.
  //
  // Catching the typo here means it never reaches SQL, and `sovrium validate`
  // reports it without booting. It cannot cover every case — see the two
  // deliberate skips below and `batchUpdate`, whose per-item filters arrive
  // inside a `{{...}}` template and do not exist at config time at all.
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations || !app.tables) return true

      const tableFieldMap = new Map(
        app.tables.map((t) => [t.name, new Set(t.fields.map((f) => f.name))])
      )

      const filterFieldError = app.automations
        .flatMap((a) =>
          collectAllActions(a.actions as ReadonlyArray<Action>)
            .filter((action) => action.type === 'record')
            .flatMap((action) => {
              const props = action.props as Record<string, unknown>
              const { table } = props as { readonly table?: unknown }
              if (typeof table !== 'string') return []
              const tableFields = tableFieldMap.get(table)
              // An unknown table is the TABLE rule's verdict. Reporting it here
              // too would say the same thing twice in two voices.
              if (!tableFields) return []
              return (
                recordActionColumnRefs(props)
                  .filter((ref) => !isRuntimeResolvedValue(ref.field))
                  // System columns (`id`, the timestamps, the authorship columns)
                  // exist without appearing in `fields[]`. Every record filter in
                  // `apps/partner` targets `field: 'id'`, so omitting this exemption
                  // would refuse to boot three shipped automations. The predicate is
                  // SHARED with the runtime check in `record-filters.ts` so the two
                  // halves cannot reach opposite verdicts on the same name.
                  .filter((ref) => !isResolvableColumnName(tableFields, ref.field))
                  .map((ref) => ({
                    automation: a.name,
                    action: action.name,
                    field: ref.field,
                    kind: ref.kind,
                    table,
                    declared: [...tableFields],
                  }))
              )
            })
        )
        .at(0)

      if (filterFieldError) {
        return `Automation '${filterFieldError.automation}' record action '${filterFieldError.action}' ${filterFieldError.kind} field '${filterFieldError.field}' which does not exist in table '${filterFieldError.table}'. Available: ${filterFieldError.declared.join(', ')}`
      }
      return true
    })
  ),
  // Automation cross-validation: $ref action templates must reference existing templates
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const templateNames = new Set(app.actions?.map((t) => t.name) ?? [])

      const refError = app.automations
        .flatMap((a) =>
          collectAllActions(a.actions as ReadonlyArray<Action>)
            .filter(
              (action): action is Action & { readonly type: 'ref'; readonly $ref: string } =>
                action.type === 'ref'
            )
            .filter((action) => !templateNames.has(action.$ref))
            .map((action) => ({ automation: a.name, action }))
        )
        .at(0)

      if (refError) {
        const available =
          templateNames.size > 0
            ? `. Available templates: ${Array.from(templateNames).toSorted().join(', ')}`
            : '. No action templates are defined in app.actions[]'
        return `Automation '${refError.automation}' action '${refError.action.name}' references template '${refError.action.$ref}' which does not exist${available}`
      }

      return true
    })
  ),
  // NOTE: `automation:call` references are validated at RUNTIME (not at
  // decode time) — a missing target surfaces as a failed run (HTTP 500) so
  // operators can ship a caller before its callee lands, and so the failure
  // is observable in run-history rather than blocking server startup.
  // Automation cross-validation: action connection must reference existing connections
  // Action-type-agnostic: checks ANY action with a `connection` prop (ai, http, webhook, etc.)
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const connectionNames = new Set(app.connections?.map((c) => c.name) ?? [])

      const connectionError = app.automations
        .flatMap((a) =>
          collectAllActions(a.actions as ReadonlyArray<Action>)
            .filter(
              (action): action is Action & { readonly props: { readonly connection?: string } } =>
                'props' in action &&
                action.props !== undefined &&
                typeof action.props === 'object' &&
                'connection' in (action.props as Record<string, unknown>) &&
                (action.props as Record<string, unknown>).connection !== undefined &&
                !connectionNames.has((action.props as Record<string, unknown>).connection as string)
            )
            .map((action) => ({ automation: a.name, action }))
        )
        .at(0)

      if (connectionError) {
        return `Automation '${connectionError.automation}' action '${connectionError.action.name}' references connection '${(connectionError.action.props as { readonly connection: string }).connection}' which does not exist`
      }

      return true
    })
  ),
  // Automation cross-validation: approval actions require auth config
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const hasApprovalAction = app.automations.some((a) =>
        a.actions.some((action) => action.type === 'approval')
      )
      if (hasApprovalAction && !app.auth) {
        return 'Approval actions require auth configuration to be enabled'
      }
      return true
    })
  ),
  // AI Agent cross-validation: ai:agent actions require app.agents config
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const agentNames = new Set(app.agents?.map((a) => a.name) ?? [])

      const agentError = app.automations
        .flatMap((a) =>
          collectAllActions(a.actions as ReadonlyArray<Action>)
            .filter(
              (
                action
              ): action is Action & {
                readonly type: 'ai'
                readonly operator: 'agent'
                readonly props: { readonly agent: string }
              } => action.type === 'ai' && action.operator === 'agent'
            )
            .filter((action) => !agentNames.has(action.props.agent))
            .map((action) => ({ automation: a.name, action }))
        )
        .at(0)

      if (agentError) {
        if (!app.agents) {
          return `Automation '${agentError.automation}' uses ai:agent action but app.agents is not configured`
        }
        const available = Array.from(agentNames).toSorted().join(', ')
        return `Automation '${agentError.automation}' action '${agentError.action.name}' references agent '${agentError.action.props.agent}' which does not exist. Available agents: ${available}`
      }

      return true
    })
  ),
  // Form trigger cross-validation: referenced form must exist in app.forms[]
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const formTriggers = app.automations.filter(
        (
          a
        ): a is typeof a & { readonly trigger: { readonly type: 'form'; readonly form: string } } =>
          a.trigger.type === 'form'
      )
      if (formTriggers.length === 0) return true

      const formNames = new Set((app.forms ?? []).map((f) => f.name))

      const missing = formTriggers.find((a) => {
        const trigger = a.trigger as { readonly form: string }
        return !formNames.has(trigger.form)
      })

      if (missing) {
        const trigger = missing.trigger as { readonly form: string }
        return `Automation '${missing.name}' form trigger references form '${trigger.form}' which does not exist in app.forms[]`
      }
      return true
    })
  ),
  // Automation-failure trigger cross-validation: referenced automations must exist
  Schema.check(
    Schema.makeFilter((app) => {
      if (!app.automations) return true

      const automationNames = new Set(app.automations.map((a) => a.name))

      const missingError = app.automations
        .filter(
          (
            a
          ): a is typeof a & {
            readonly trigger: {
              readonly type: 'automation-failure'
              readonly automations?: ReadonlyArray<string>
            }
          } => a.trigger.type === 'automation-failure'
        )
        .flatMap((automation) => {
          const trigger = automation.trigger as { readonly automations?: ReadonlyArray<string> }
          const watched = trigger.automations
          if (!watched) return []
          return watched
            .filter((name) => !automationNames.has(name))
            .map((missing) => ({ automation: automation.name, missing }))
        })
        .at(0)

      if (missingError) {
        return `Automation '${missingError.automation}' automation-failure trigger references automation '${missingError.missing}' which does not exist`
      }
      return true
    })
  ),
  // Forms cross-validation (bundled): name uniqueness, id uniqueness,
  // path uniqueness + page-path collision, submitTo.table existence,
  // submitTo.automation existence, page form-component formRef existence
  // AND mutual exclusion with inline dataSource/fields/fieldGroups.
  Schema.check(Schema.makeFilter((app) => validateAllFormsReferences(app))),
  // AI/MCP cross-validation (bundled): manual-trigger-only aiAccess,
  // whitelist consistency, reserved 'auth_'/'system_' table prefixes.
  // Bundled into a single helper to stay under TypeScript's deep-instantiation
  // depth limit (same reason validateAllFormsReferences is bundled).
  Schema.check(Schema.makeFilter((app) => validateAllAiAccessRules(app))),
  // Agent-approval cross-validation (bundled): selective-mode requires a
  // `required` list, `required` must be a subset of tools.actions,
  // escalation.to must reference an auth role, escalation.after < timeout.
  Schema.check(Schema.makeFilter((app) => validateAllAgentApprovalRules(app))),
  // Agent table-knowledge cross-validation:
  // every `knowledge.tables[]` entry must reference a declared table + real
  // columns, and only text-like field types may be
  // embedded as a knowledge source.
  // Final bundled filter: agent table-knowledge references
  // AND page-access group references
  //. Two unrelated checks are bundled into one
  // `Schema.filter` call because each additional filter in the chain pushes
  // TypeScript's deep-instantiation depth over the limit and collapses the
  // derived `App` type to `never`.
  Schema.check(
    Schema.makeFilter((app) => {
      const knowledgeError = validateAllKnowledgeReferences(app)
      if (knowledgeError !== true) return knowledgeError
      const pageAccessError = validateAllPageAccessGroups(app)
      if (pageAccessError !== true) return pageAccessError
      // System-source reference cross-validation (CAP-4): every
      // `dataSource: { systemSource: <name> }` must resolve to a declared
      // `app.systemSources[]` entry — the offline `sovrium validate` win.
      const systemSourceError = validateAllSystemSourceReferences(app)
      if (systemSourceError !== true) return systemSourceError
      // Redirect cross-validation: no `redirects[].from` may shadow a declared
      // static page path — the redirect is evaluated first, so the page would be
      // silently unreachable. Bundled here (not a new `Schema.filter`) for the
      // deep-instantiation reason documented above.
      const redirectError = validateAllRedirectRules(app)
      if (redirectError !== true) return redirectError
      // Link-namespace cross-validation: no page, form or redirect may claim a
      // path under the reserved `/l` short-link namespace, which is matched
      // before all three. Bundled here (not a new `Schema.filter`) for the
      // deep-instantiation reason documented above.
      const linkError = validateAllLinkRules(app)
      if (linkError !== true) return linkError
      // Share-namespace cross-validation ([internal ref] A3 Part 2): no page, form or
      // redirect may claim a path under the reserved `/s` design-system share
      // namespace, which is matched before all three. Bundled here (not a new
      // `Schema.filter`) for the deep-instantiation reason documented above.
      const shareError = validateAllShareRules(app)
      if (shareError !== true) return shareError
      // Select dynamic-option-source cross-validation: `options` and `dataSource`
      // are mutually exclusive, and `dataSource.{table,displayField,valueField}`
      // must name a declared table and real fields on it. Bundled here (not a new
      // `Schema.filter`) for the deep-instantiation reason documented above.
      const selectOptionSourceError = validateAllSelectOptionSources(app)
      if (selectOptionSourceError !== true) return selectOptionSourceError
      // Design cross-validation: `theme` and `design.theme` are
      // mutually exclusive, every `design.colorRoles` key names a declared
      // colour token, and every `design.components` key names a declared
      // `components[].name`. Bundled here rather than added as three new
      // `Schema.check` calls for the deep-instantiation reason documented
      // above — three more links in this chain is the fastest way to collapse
      // `App` to `never`, which fails silently at every consumer.
      const designError = validateAllDesignReferences(app)
      if (designError !== true) return designError
      // QR payload cross-validation: a
      // `qr-code` component encodes exactly one of `link` or `value`. Neither
      // half can be stated at the field level, and the per-branch struct has no
      // refinement hook. Bundled here (not a new `Schema.filter`) for the
      // deep-instantiation reason documented above.
      const qrCodeError = validateAllQrCodePayloads(app)
      if (qrCodeError !== true) return qrCodeError
      return validateAllTablePermissionGroups(app)
    })
  )
)

/**
 * TypeScript type inferred from AppSchema.
 *
 * Use this type for type-safe access to validated application data.
 *
 * @example
 * ```typescript
 * const app: App = {
 *   name: 'my-app',
 * }
 * ```
 */
export type App = Schema.Schema.Type<typeof AppSchema>

/**
 * Encoded type of AppSchema (what goes in).
 *
 * In this case, it's the same as App since we don't use transformations.
 */
export type AppEncoded = Schema.Codec.Encoded<typeof AppSchema>

// Re-export all domain model schemas and types for convenient imports
export * from './actions'
export * from './agents'
export * from './analytics'
export * from './automations'
export * from './buckets'
export * from './components'
export * from './connections'
export * from './description'
export * from './design'
export * from './env'
export * from './languages'
export * from './llms'
export * from './name'
export * from './auth'
export * from './pages'
export * from './palette'
export * from './links'
export * from './redirects'
export * from './requires-email'
export * from '@/domain/models/shared'
export * from './systemSources'
export * from './tables'
export * from './theme'
export * from './version'
