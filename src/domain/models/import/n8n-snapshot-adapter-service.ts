/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An n8n snapshot — what `sovrium import fetch n8n:<instance URL>` wrote — as
 * the workflows the n8n adapter reads, so the API and the export file take one
 * path.
 *
 * - `raw/workflows/page-NNNN.json`: the list pages, `{ data: [workflow…] }`,
 *   read in order;
 * - `raw/workflows/<id>.json`: one workflow in full, written only when the
 *   list served it without its nodes; it replaces the list's entry.
 *
 * A workflow archived in n8n is imported like the others, disabled like every
 * imported automation, and noted, so the report tells it from a live one; an
 * export file carrying `isArchived` is noted the same way.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { adaptN8nExport } from './n8n-adapter-service'
import type { CanonicalFlow } from './canonical-flow'
import type { ImportReport } from './import-report'

const LIST_PAGE = /^raw\/workflows\/page-\d+\.json$/
const ONE_WORKFLOW = /^raw\/workflows\/(?!page-\d+\.json$)[^/]+\.json$/

type Json = Readonly<Record<string, unknown>>
type Unmapped = ImportReport['unmapped'][number]

/** The workflows of a snapshot, in list order, each replaced by its full read when there is one. */
const workflowsOf = (files: ReadonlyMap<string, unknown>): readonly Json[] => {
  const paths = [...files.keys()].toSorted()
  const full = new Map(
    paths
      .filter((path) => ONE_WORKFLOW.test(path))
      .flatMap((path) => {
        const workflow = files.get(path)
        return isRecord(workflow) && typeof workflow['id'] === 'string'
          ? [[workflow['id'], workflow] as const]
          : []
      })
  )
  const listed = paths
    .filter((path) => LIST_PAGE.test(path))
    .flatMap((path) => {
      const page = files.get(path)
      return (isRecord(page) && Array.isArray(page['data']) ? page['data'] : []).filter(isRecord)
    })
  const seen = new Set(listed.map((workflow) => workflow['id']))
  return [
    ...listed.map((workflow) =>
      typeof workflow['id'] === 'string' ? (full.get(workflow['id']) ?? workflow) : workflow
    ),
    ...[...full.values()].filter((workflow) => !seen.has(workflow['id'])),
  ]
}

/**
 * Workflows as flows, and a note for each one archived in n8n. Both the
 * snapshot and an export file go through here; n8n's own editor export never
 * carries `isArchived`, so a note only appears where the workflow says so.
 */
export const adaptN8nWorkflows = (
  documents: readonly unknown[]
): { readonly flows: readonly CanonicalFlow[]; readonly notes: readonly Unmapped[] } => {
  const workflows = documents
    .flatMap((document) => (Array.isArray(document) ? document : [document]))
    .filter(isRecord)
  const flows = adaptN8nExport(workflows)
  const notes = workflows.flatMap((workflow, index): readonly Unmapped[] => {
    const flow = flows[index]
    return workflow['isArchived'] === true && flow !== undefined
      ? [
          {
            domain: 'automations',
            source: flow.name,
            kind: 'other',
            reason:
              'Archived in n8n. It is imported all the same, disabled like every imported automation: delete it if it is no longer wanted.',
          },
        ]
      : []
  })
  return { flows, notes }
}

/** The flows of an n8n snapshot, and a note for each workflow archived in n8n. */
export const adaptN8nSnapshot = (
  files: ReadonlyMap<string, unknown>
): { readonly flows: readonly CanonicalFlow[]; readonly notes: readonly Unmapped[] } =>
  adaptN8nWorkflows(workflowsOf(files))
