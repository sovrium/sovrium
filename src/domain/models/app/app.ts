/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionTemplatesSchema } from './actions'
import { AdminConfigSchema } from './admin'
import { AgentsSchema } from './agents'
import { validateAllAgentApprovalRules } from './agents/approval-validation'
import { BuiltInAnalyticsSchema } from './analytics'
import {
  validateRecordActionColumnReferences,
  validateRecordTriggerConditionFields,
  validateRecordTriggerWatchFields,
} from './app-automation-field-validation'
import {
  validateActionConnectionReferences,
  validateActionTemplateReferences,
  validateAgentActionReferences,
  validateAutomationFailureReferences,
  validateAutomationTableReferences,
  validateFormTriggerReferences,
} from './app-automation-reference-validation'
import { validateAppDeclarations } from './app-declaration-validation'
import {
  validateAnalyticsActionRequirement,
  validateApprovalActionRequirement,
  validateAppRoleReferences,
  validateAutomationAuthRequirements,
  validateUserFieldsRequireAuth,
} from './app-requirement-validation'
import { AssetsSchema } from './assets'
import { AuthSchema } from './auth'
import { validateAllAiAccessRules } from './auth/ai-access-validation'
import { AutomationsSchema } from './automations'
import { BadgeSchema } from './badge'
import { BucketsSchema } from './buckets'
import { validateFieldBucketReferences } from './buckets/field-bucket-reference-validation'
import { ComponentsSchema } from './components'
import { ConnectionsSchema } from './connections'
import { ConsentSchema } from './consent'
import { DecisionsSchema } from './decisions'
import { DescriptionSchema } from './description'
import { DesignSchema } from './design'
import { DisplayNameSchema } from './display-name'
import { EnvVarsSchema } from './env'
import { FormsSchema } from './forms'
import { validateAllFormsReferences } from './forms/forms-validation'
import { InstallSchema } from './install'
import { LanguagesSchema } from './languages'
import { LinksSchema } from './links'
import { LlmsSchema } from './llms'
import { NameSchema } from './name'
import { NotificationsSchema } from './notifications'
import { PagesSchema } from './pages'
import { PaletteSchema } from './palette'
import { RedirectsSchema } from './redirects'
import { SignaturesSchema } from './signatures'
import { SystemSourceCatalogSchema } from './system-sources'
import { TablesSchema } from './tables'
import { VersionSchema } from './version'

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
   * The name of the application, on npm's package-name rules (`NameSchema`):
   * lowercase, URL-safe, at most 214 characters including an `@scope/`, with no
   * leading dot, underscore or space; hyphens and underscores allowed after.
   */
  name: NameSchema,

  /**
   * The name people read (optional): `Acme CRM` where `name` says `acme-crm`.
   *
   * Printed by the app's chrome — the operator console, the sign-in card, the
   * default page title — where `name` stays the identifier. Absent, those
   * surfaces print `name` as they always have (`displayNameOf`).
   */
  displayName: Schema.optional(DisplayNameSchema),

  /**
   * The version of the application (optional), in SemVer 2.0.0: MAJOR.MINOR.PATCH
   * without leading zeros, with optional pre-release (`1.0.0-alpha`) and build
   * metadata (`1.0.0+build.123`).
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
   * The app's design system (optional).
   *
   * One key holding everything a design system must carry: the colour palette,
   * ramps and roles; the type, space, shape, elevation, motion and layout
   * foundations; density, baseline and per-engine-type component styling; the
   * zone map; and the charter — logo, imagery, principles and voice.
   *
   * The charter half had no home in the schema at all. Together they are what
   * lets an author — or an agent building on their behalf — be HANDED the app's
   * design rules instead of inferring them from the tokens.
   *
   * There is no top-level `theme` key and no `design.theme` block: the single-design-schema rule
   * flattened every token category onto `design` under the name of the decision
   * it makes rather than the CSS property that renders it. A config using a
   * removed spelling is refused by name, with its destination in the message.
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
   * Enables first-party, analytics tracking without cookies
   * or external dependencies. Configure data retention, excluded paths,
   * session timeout, and Do Not Track behavior.
   */
  analytics: Schema.optional(BuiltInAnalyticsSchema),

  /**
   * Visitor consent (optional): the purposes a visitor accepts or refuses
   * before the page scripts, analytics providers and built-in analytics they
   * gate run, the page explaining them, and how long a choice is kept.
   */
  consent: Schema.optional(ConsentSchema),

  /**
   * Reusable UI components (optional).
   *
   * Array of reusable component templates with variable substitution. Components are
   * defined once at app level and referenced across pages using $ref syntax with
   * $vars for dynamic content.
   */
  components: Schema.optional(ComponentsSchema),

  /** Server-rendered, component-based pages (optional); at least one when present. */
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

  /** Private files beside the config, read by actions through `{ asset }` and never served. */
  assets: Schema.optional(AssetsSchema),

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

  /** In-app notifications (optional): the kinds the app sends, their channels and retention. */
  notifications: Schema.optional(NotificationsSchema),

  /**
   * Signing flows (optional): ask people to sign the PDF a record holds, each
   * through a link of her own, and keep an evidence file of every step.
   *
   * A `signature/send` step starts a request for one record; the engine writes
   * each signature, the signed document, the proof file and the status back
   * into the fields the flow names, and no client may write them.
   */
  signatures: Schema.optional(SignaturesSchema),

  /**
   * AI agent configurations (optional).
   *
   * Array of autonomous AI agents that can perform actions on behalf of users.
   * Each agent operates under an auth role with configurable approval workflows,
   * tool access, rate limits, and scheduling. Requires auth and AI_PROVIDER env var.
   */
  agents: Schema.optional(AgentsSchema),

  /**
   * Architecture decision records (optional).
   *
   * The reasoning behind the configuration, declared beside the configuration
   * it decided. Each record carries Nygard's four parts — context, decision,
   * consequences and a status — plus who took it, when, and what it was about.
   *
   * `touches` is free display text and is deliberately never resolved against
   * this config: a superseded decision names config that is gone by definition.
   * The supersession links ARE resolved, in both directions, because the
   * console paints them as a link a reader follows.
   */
  decisions: Schema.optional(DecisionsSchema),

  /**
   * Named storage buckets (optional).
   *
   * Array of named storage containers with per-bucket permissions, file constraints,
   * and public/private toggle. Infrastructure credentials (S3 keys, local path) are
   * configured via env vars. Buckets define application-level file organization.
   *
   * Every app also carries the built-in `system` bucket (a reserved name), which
   * holds the files of any attachment field that names no bucket.
   */
  buckets: Schema.optional(BucketsSchema),

  /**
   * LLMs.txt (optional): the generated `/llms.txt` and `/llms-full.txt` routes (llmstxt.org),
   * derived from content-directory pages when omitted; `enabled: false` turns them off.
   */
  llms: Schema.optional(LlmsSchema),

  /** Installable app (optional): a generated web app manifest and, opt-in, an offline shell. */
  install: Schema.optional(InstallSchema),

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

  /**
   * Whether Sovrium's built-in operator console is served (optional).
   *
   * Omit the key or set `true` to serve it at `/_admin`; set `false` to serve
   * it nowhere. The base path is fixed and the console itself is NOT
   * configurable — it ships inside the binary, version-locked to the release —
   * so this key decides one thing and nothing else (founder decision D4). The
   * `SOVRIUM_ADMIN=off` environment variable switches it off whatever is
   * declared here, and never fails boot for disagreeing.
   */
  admin: Schema.optional(AdminConfigSchema),
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
  // Each check below is one named cross-property rule, run in this order; the first
  // refusal is the decode error a refused config prints. Each named rule documents its
  // own rationale beside its body. The chain stays one `Schema.check` per rule because
  // each additional filter pushes TypeScript's deep-instantiation depth toward the
  // limit at which the derived `App` type collapses to `never` — so new rules join an
  // existing bundle (`validateAppDeclarations`) rather than a new link here.
  Schema.check(Schema.makeFilter(validateUserFieldsRequireAuth)),
  Schema.check(Schema.makeFilter(validateAppRoleReferences)),
  Schema.check(Schema.makeFilter(validateFieldBucketReferences)),
  Schema.check(Schema.makeFilter(validateAutomationTableReferences)),
  Schema.check(Schema.makeFilter(validateAutomationAuthRequirements)),
  Schema.check(Schema.makeFilter(validateAnalyticsActionRequirement)),
  Schema.check(Schema.makeFilter(validateRecordTriggerWatchFields)),
  Schema.check(Schema.makeFilter(validateRecordTriggerConditionFields)),
  Schema.check(Schema.makeFilter(validateRecordActionColumnReferences)),
  Schema.check(Schema.makeFilter(validateActionTemplateReferences)),
  // `automation:call` targets are resolved at RUN time, not here: a missing callee
  // surfaces as a failed run, so a caller can ship before its callee lands.
  Schema.check(Schema.makeFilter(validateActionConnectionReferences)),
  Schema.check(Schema.makeFilter(validateApprovalActionRequirement)),
  Schema.check(Schema.makeFilter(validateAgentActionReferences)),
  Schema.check(Schema.makeFilter(validateFormTriggerReferences)),
  Schema.check(Schema.makeFilter(validateAutomationFailureReferences)),
  Schema.check(Schema.makeFilter((app) => validateAllFormsReferences(app))),
  Schema.check(Schema.makeFilter((app) => validateAllAiAccessRules(app))),
  Schema.check(Schema.makeFilter((app) => validateAllAgentApprovalRules(app))),
  Schema.check(Schema.makeFilter(validateAppDeclarations))
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
