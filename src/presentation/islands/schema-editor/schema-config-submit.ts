/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
