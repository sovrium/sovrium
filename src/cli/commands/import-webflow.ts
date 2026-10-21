/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import` — reading a Webflow site snapshot: its CMS collections as
 * tables, its forms with their submissions, and its form webhooks as
 * automations, each part only when the fetch read it.
 *
 * A webhook whose form is in the snapshot sends that form's answers under the
 * column names its responses table gets, so the request it makes once switched
 * on carries what the submission held.
 */

import { planFormColumns } from '@/domain/models/import/form-columns-service'
import { adaptWebflowSnapshot } from '@/domain/models/import/webflow-cms-adapter-service'
import { adaptWebflowFlows } from '@/domain/models/import/webflow-flow-adapter-service'
import { adaptWebflowForms } from '@/domain/models/import/webflow-form-adapter-service'
import type { SourceRead } from './import-sources'
import type { ImportDomain } from '@/domain/models/import/import-source'

/** A Webflow site snapshot, its parts narrowed to the domains the fetch read. */
export const readWebflowSite = (
  siteId: string,
  files: ReadonlyMap<string, unknown>,
  domains: readonly ImportDomain[]
): SourceRead => {
  const tables =
    domains.includes('tables') || domains.includes('data')
      ? { tables: adaptWebflowSnapshot({ siteId, files }) }
      : {}
  const forms = domains.includes('forms') ? adaptWebflowForms(files) : []
  const withForms = forms.length === 0 ? tables : { ...tables, forms }
  if (!domains.includes('automations')) return withForms
  const columns = new Map(forms.map((form) => [form.sourceId, planFormColumns(form)] as const))
  const flows = adaptWebflowFlows({
    siteId,
    files,
    columnOf: (formId, field) =>
      columns.get(formId)?.find((column) => column.label === field)?.name,
  })
  return {
    ...withForms,
    flows: flows.flows,
    flowNotes: flows.notes,
    neverImportable: flows.neverImportable,
  }
}
