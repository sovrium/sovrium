/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The request id an operator quotes when the console reports a failure, read
 * by every island that offers one: a failed read (`failedReadCause`), a failed
 * write (`consoleRequestIdOf`), a report read's answer and the console 500
 * page's stamp. One shape check, so the client cannot admit an id the server
 * would not have answered with.
 */

/**
 * `value` when it is a request id this server could have answered with — the
 * shape `X-Request-Id` admits (word characters, `-` and `=`, at most 255) and
 * the report read's path parameter decodes (`domain/models/api/admin/reports/
 * report-address.ts`) — `undefined` for anything else.
 */
export const requestIdOf = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[\w=-]{1,255}$/.test(value) ? value : undefined

/**
 * Whether this document is the operator console's. Every console document
 * carries the base attribute and an app's own pages never do: a report of the
 * engine's own failure is the operator's, so an app's visitor is never shown an
 * id to quote. The attribute is `MOUNT_BASE_PATH_ATTRIBUTE`
 * (`domain/models/app/admin/mount-hrefs.ts`), spelled here so the island chunks
 * do not import that module.
 */
export const isConsoleDocument = (): boolean =>
  typeof document !== 'undefined' && document.querySelector('[data-admin-base-path]') !== null

/**
 * The request a failed WRITE's server error was answered under, read off its
 * 5xx envelope, on the operator console only — the write-side counterpart of
 * the grid's `consoleRequestIdOfRead` (`data-table/read-failure-request.ts`).
 */
export const consoleRequestIdOf = (status: number, body: unknown): string | undefined =>
  status >= 500 && isConsoleDocument()
    ? requestIdOf((body as { readonly requestId?: unknown } | null | undefined)?.requestId)
    : undefined
