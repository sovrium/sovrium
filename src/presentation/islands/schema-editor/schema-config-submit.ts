/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared submit helper for the schema config-editor islands (platform B10).
 *
 * Every editor island — CodeMirror JSON/YAML, the structured form builder, and
 * the AI-agent chat — persists its authored config the same way: a POST to the
 * records API for `submitToTable`, writing
 * `{ [configField]: <serialized config>, [formatField]: <format discriminant> }`.
 * Centralizing it keeps the per-island wrappers thin and under the eco
 * `max-lines: 250` island cap.
 *
 * GAP-I2: `submitContext` carries the resolved `inlinePrefill` record-context
 * (e.g. the host page's `app` FK). It is merged into the POST body so an editor
 * on a record-detail page satisfies a required relationship FK on its submit
 * table without overloading an unrelated column. The context is spread LAST so
 * a server-bound (`lockPrefill`) FK cannot be clobbered by the editor fields.
 */
export async function submitSchemaConfig(params: {
  readonly submitToTable: string
  readonly configField: string
  readonly formatField: string
  readonly content: string
  readonly format: string
  readonly submitContext?: Readonly<Record<string, unknown>>
}): Promise<string | undefined> {
  const { submitToTable, configField, formatField, content, format, submitContext } = params
  const response = await fetch(`/api/tables/${encodeURIComponent(submitToTable)}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [configField]: content,
      [formatField]: format,
      ...(submitContext ?? {}),
    }),
  })
  return response.ok ? undefined : `Submit failed with status ${response.status}`
}
