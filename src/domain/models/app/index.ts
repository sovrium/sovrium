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
import { validateAllAgentApprovalRules } from './agents/approval-validation'
import { validateAllKnowledgeReferences } from './agents/knowledge-validation'
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
import { LlmsSchema } from './llms'
import { NameSchema } from './name'
import { validateAllPageAccessGroups } from './page-access-validation'
import { PagesSchema } from './pages'
import { PaletteSchema } from './palette'
import { validateAllRoleReferences, validateTableRoleReferences } from './role-validation'
import { AppScriptsSchema } from './scripts'
import { validateAllSystemSourceReferences } from './system-source-validation'
import { SystemSourceCatalogSchema } from './systemSources'
import { validateAllTablePermissionGroups } from './table-permission-validation'
import { TablesSchema } from './tables'
import { ThemeSchema } from './theme'
import { VersionSchema } from './version'

export const AppSchema = Schema.Struct({
  name: NameSchema,

  version: Schema.optional(VersionSchema),

  description: Schema.optional(DescriptionSchema),

  tables: Schema.optional(TablesSchema),

  theme: Schema.optional(ThemeSchema),

  languages: Schema.optional(LanguagesSchema),

  auth: Schema.optional(AuthSchema),

  analytics: Schema.optional(BuiltInAnalyticsSchema),

  components: Schema.optional(ComponentsSchema),

  pages: Schema.optional(PagesSchema),

  forms: Schema.optional(FormsSchema),

  connections: Schema.optional(ConnectionsSchema),

  env: Schema.optional(EnvVarsSchema),

  actions: Schema.optional(ActionTemplatesSchema),

  automations: Schema.optional(AutomationsSchema),

  agents: Schema.optional(AgentsSchema),

  buckets: Schema.optional(BucketsSchema),

  scripts: Schema.optional(AppScriptsSchema),

  llms: Schema.optional(LlmsSchema),

  palette: Schema.optional(PaletteSchema),

  systemSources: Schema.optional(SystemSourceCatalogSchema),
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
    if (!app.auth) return true
    const tableError = validateTableRoleReferences(app)
    if (tableError !== true) return tableError
    return validateAllRoleReferences(app)
  }),
  Schema.filter((app) => {
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
  Schema.filter((app) => validateAllFormsReferences(app)),
  Schema.filter((app) => validateAllAiAccessRules(app)),
  Schema.filter((app) => validateAllAgentApprovalRules(app)),
  Schema.filter((app) => {
    const knowledgeError = validateAllKnowledgeReferences(app)
    if (knowledgeError !== true) return knowledgeError
    const pageAccessError = validateAllPageAccessGroups(app)
    if (pageAccessError !== true) return pageAccessError
    const systemSourceError = validateAllSystemSourceReferences(app)
    if (systemSourceError !== true) return systemSourceError
    return validateAllTablePermissionGroups(app)
  })
)

export type App = Schema.Schema.Type<typeof AppSchema>

export type AppEncoded = Schema.Schema.Encoded<typeof AppSchema>

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
export * from './llms'
export * from './name'
export * from './auth'
export * from './pages'
export * from './palette'
export * from './requires-email'
export * from '@/domain/models/shared'
export * from './systemSources'
export * from './tables'
export * from './theme'
export * from './version'
