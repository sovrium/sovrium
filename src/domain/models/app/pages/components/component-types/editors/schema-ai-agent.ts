/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { InlinePrefillSchema } from '../data/form'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

/**
 * `schema-ai-agent` component type — an AI-assisted app-config authoring surface.
 *
 * A conversational agent that proposes / edits a tenant app config from natural
 * language ("add a contacts table with name and email"), emitting the same
 * config-submission contract the JSON/YAML/form editors use. `agent` names an
 * entry from `app.agents[]`; the agent is driven through the platform AI provider
 * precedence resolver (env-controlled, eco-by-default), never a hard-coded cloud
 * provider.
 *
 * Island deferred (red): the agentic editing island is a substantial later
 * `src/presentation/islands/` build. Until it ships the dispatcher renders a
 * safe `<div>` placeholder, so the type validates against AppSchema and renders
 * without crashing (component-type-dispatcher fallback).
 */
export const SchemaAiAgentTypeLiteral = Schema.Literal('schema-ai-agent')

export const schemaAiAgentFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  agent: Schema.optional(
    Schema.String.annotations({
      description: 'Agent name from app.agents[] that drives the config authoring conversation',
    })
  ),
  submitToTable: Schema.optional(
    Schema.String.annotations({
      description:
        'Table slug the agent-proposed config is submitted to (e.g. "config_submissions")',
    })
  ),
  configField: Schema.optional(
    Schema.String.annotations({
      description: 'Column on the submit table that stores the agent-authored config',
    })
  ),
  formatField: Schema.optional(
    Schema.String.annotations({
      description:
        'Column on the submit table that stores the editor format discriminant ("agent")',
    })
  ),
  placeholder: Schema.optional(
    Schema.String.annotations({ description: 'Placeholder text for the agent chat input' })
  ),
  initialValue: Schema.optional(
    Schema.String.annotations({
      description: 'Initial config the agent reasons from (e.g. "$record.config")',
    })
  ),
  chatHeight: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Agent conversation container height in pixels' })
    )
  ),
  /**
   * Record-context submit fields (GAP-I2). Reuses the `InlinePrefillSchema`
   * (`$record.<field>` token + `lockPrefill`). On a record-detail / collection
   * page the editor SSR dispatcher resolves the tokens against the host record
   * into a literal `submitContext` merged into the submit body — so an editor
   * whose submit table has a required relationship FK carries the page record
   * FK without overloading the format column.
   */
  inlinePrefill: Schema.optional(InlinePrefillSchema),
} as const
