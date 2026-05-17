/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { validateAllFormsReferences } from '../shared/forms-validation'
import { ActionTemplatesSchema } from './actions'
import { AgentsSchema } from './agents'
import { validateAllAiAccessRules } from './ai-access-validation'
import { BuiltInAnalyticsSchema } from './analytics'
import { AuthSchema } from './auth'
import { type Action, AutomationsSchema } from './automations'
import { BucketsSchema } from './buckets'
import { ComponentsSchema } from './components'
import { ConnectionsSchema } from './connections'
import { DescriptionSchema } from './description'
import { EnvVarsSchema } from './env'
import { FormsSchema } from './forms'
import { LanguagesSchema } from './languages'
import { NameSchema } from './name'
import { NotificationSchema } from './notifications'
import { PagesSchema } from './pages'
import { validateAllRoleReferences } from './role-validation'
import { AppScriptsSchema } from './scripts'
import { TablesSchema } from './tables'
import { ThemeSchema } from './theme'
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
   * Data tables that define the data structure (optional).
   *
   * Collection of database tables that define the data structure of your application.
   * Each table represents an entity (e.g., users, products, orders) with fields that
   * define the schema. Tables support relationships, indexes, constraints, and various
   * field types.
   */
  tables: Schema.optional(TablesSchema),

  /**
   * Design system configuration (optional).
   *
   * Unified design tokens for colors, typography, spacing, animations, breakpoints,
   * shadows, and border radius. Theme applies globally to all pages via className
   * utilities and CSS variables.
   */
  theme: Schema.optional(ThemeSchema),

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
   * configured via env vars (DEC-007). Buckets define application-level file organization.
   *
   * When omitted, an implicit 'default' bucket is used at runtime.
   */
  buckets: Schema.optional(BucketsSchema),

  /**
   * Notification system configuration (optional).
   *
   * Enables in-app and email notifications with templates, record subscriptions,
   * and per-user preferences. Disabled when omitted.
   */
  notifications: Schema.optional(NotificationSchema),

  /**
   * App-level scripts configuration (optional).
   *
   * Global scripts that load on all pages before page-level scripts.
   * Used for analytics, tracking, feature flags, and global configuration.
   */
  scripts: Schema.optional(AppScriptsSchema),
}).pipe(
  Schema.annotations({
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
  Schema.filter((app) => {
    const userFieldTypes = new Set(['user', 'created-by', 'updated-by'])
    const hasUserFields =
      app.tables?.some((table) => table.fields.some((field) => userFieldTypes.has(field.type))) ??
      false

    if (hasUserFields && !app.auth) {
      return 'User fields (user, created-by, updated-by) require auth configuration'
    }
    return true
  }),
  Schema.filter((app) => {
    // Only validate role references in permissions when auth is explicitly configured.
    if (!app.auth) return true
    return validateAllRoleReferences(app)
  }),
  // Bucket reference cross-validation: attachment field bucket references must exist in app.buckets
  Schema.filter((app) => {
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
  }),
  // Automation cross-validation: record triggers/actions must reference existing tables
  Schema.filter((app) => {
    if (!app.automations || !app.tables) return true

    const tableNames = new Set(app.tables.map((t) => t.name))

    const collectAllActions = (actions: ReadonlyArray<Action>): ReadonlyArray<Action> => {
      return actions.flatMap((action) => {
        const pathActions =
          action.type === 'path'
            ? action.props.paths.flatMap((p) =>
                collectAllActions(p.actions as ReadonlyArray<Action>)
              )
            : []
        const loopActions =
          action.type === 'loop'
            ? collectAllActions(action.props.actions as ReadonlyArray<Action>)
            : []
        return [action, ...pathActions, ...loopActions]
      })
    }

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
  }),
  // Automation cross-validation: auth triggers/actions require auth config
  Schema.filter((app) => {
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
  }),
  // Automation cross-validation: analytics actions require analytics config
  Schema.filter((app) => {
    if (!app.automations) return true

    const hasAnalyticsAction = app.automations.some((a) =>
      a.actions.some((action) => action.type === 'analytics')
    )
    if (hasAnalyticsAction && !app.analytics) {
      return 'Analytics actions require analytics configuration to be enabled'
    }
    return true
  }),
  // Automation cross-validation: record trigger watchFields must reference existing fields
  Schema.filter((app) => {
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
  }),
  // Automation cross-validation: $ref action templates must reference existing templates
  Schema.filter((app) => {
    if (!app.automations) return true

    const templateNames = new Set(app.actions?.map((t) => t.name) ?? [])

    const collectAllActions = (actions: ReadonlyArray<Action>): ReadonlyArray<Action> => {
      return actions.flatMap((action) => {
        const pathActions =
          action.type === 'path'
            ? action.props.paths.flatMap((p) =>
                collectAllActions(p.actions as ReadonlyArray<Action>)
              )
            : []
        const loopActions =
          action.type === 'loop'
            ? collectAllActions(action.props.actions as ReadonlyArray<Action>)
            : []
        return [action, ...pathActions, ...loopActions]
      })
    }

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
  }),
  // NOTE: `automation:call` references are validated at RUNTIME (not at
  // decode time) — a missing target surfaces as a failed run (HTTP 500) so
  // operators can ship a caller before its callee lands, and so the failure
  // is observable in run-history rather than blocking server startup.
  // Automation cross-validation: action connection must reference existing connections
  // Action-type-agnostic: checks ANY action with a `connection` prop (ai, http, webhook, etc.)
  Schema.filter((app) => {
    if (!app.automations) return true

    const connectionNames = new Set(app.connections?.map((c) => c.name) ?? [])

    const collectAllActions = (actions: ReadonlyArray<Action>): ReadonlyArray<Action> => {
      return actions.flatMap((action) => {
        const pathActions =
          action.type === 'path'
            ? action.props.paths.flatMap((p) =>
                collectAllActions(p.actions as ReadonlyArray<Action>)
              )
            : []
        const loopActions =
          action.type === 'loop'
            ? collectAllActions(action.props.actions as ReadonlyArray<Action>)
            : []
        return [action, ...pathActions, ...loopActions]
      })
    }

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
  }),
  // Automation cross-validation: approval actions require auth config
  Schema.filter((app) => {
    if (!app.automations) return true

    const hasApprovalAction = app.automations.some((a) =>
      a.actions.some((action) => action.type === 'approval')
    )
    if (hasApprovalAction && !app.auth) {
      return 'Approval actions require auth configuration to be enabled'
    }
    return true
  }),
  // Notification cross-validation: recordSubscriptions must reference existing tables
  Schema.filter((app) => {
    if (!app.notifications?.recordSubscriptions || !app.tables) return true

    const tableNames = new Set(app.tables.map((t) => t.name))
    const invalid = app.notifications.recordSubscriptions.find((sub) => !tableNames.has(sub.table))
    return invalid
      ? `Notification recordSubscription references table '${invalid.table}' which does not exist`
      : true
  }),
  // AI Agent cross-validation: ai:agent actions require app.agents config
  Schema.filter((app) => {
    if (!app.automations) return true

    const collectAllActions = (actions: ReadonlyArray<Action>): ReadonlyArray<Action> => {
      return actions.flatMap((action) => {
        const pathActions =
          action.type === 'path'
            ? action.props.paths.flatMap((p) =>
                collectAllActions(p.actions as ReadonlyArray<Action>)
              )
            : []
        const loopActions =
          action.type === 'loop'
            ? collectAllActions(action.props.actions as ReadonlyArray<Action>)
            : []
        return [action, ...pathActions, ...loopActions]
      })
    }

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
  }),
  // Notification cross-validation: sendNotification actions require notifications config
  Schema.filter((app) => {
    if (!app.automations) return true

    const hasNotificationAction = app.automations.some((a) =>
      a.actions.some((action) => action.type === 'notification')
    )
    if (hasNotificationAction && !app.notifications) {
      return 'Notification actions require notifications configuration to be enabled'
    }
    return true
  }),
  // Form trigger cross-validation: referenced form must exist in app.forms[]
  Schema.filter((app) => {
    if (!app.automations) return true

    const formTriggers = app.automations.filter(
      (a): a is typeof a & { readonly trigger: { readonly type: 'form'; readonly form: string } } =>
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
  }),
  // Automation-failure trigger cross-validation: referenced automations must exist
  Schema.filter((app) => {
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
  }),
  // Forms cross-validation (bundled): name uniqueness, id uniqueness,
  // path uniqueness + page-path collision, submitTo.table existence,
  // submitTo.automation existence, page form-component formRef existence
  // AND mutual exclusion with inline dataSource/fields/fieldGroups.
  Schema.filter((app) => validateAllFormsReferences(app)),
  // AI/MCP cross-validation (bundled): manual-trigger-only aiAccess,
  // whitelist consistency, reserved 'auth_'/'system_' table prefixes.
  // Bundled into a single helper to stay under TypeScript's deep-instantiation
  // depth limit (same reason validateAllFormsReferences is bundled).
  Schema.filter((app) => validateAllAiAccessRules(app))
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
export type AppEncoded = Schema.Schema.Encoded<typeof AppSchema>

// Re-export all domain model schemas and types for convenient imports
export * from './actions'
export * from './agents'
export * from './analytics'
export * from './automations'
export * from './buckets'
export * from './components'
export * from './connections'
export * from './description'
export * from './env'
export * from './languages'
export * from './name'
export * from './notifications'
export * from './auth'
export * from './pages'
export * from '@/domain/models/shared'
export * from './tables'
export * from './theme'
export * from './version'
