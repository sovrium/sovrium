/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_FAULT_INJECTION` — make Sovrium fail on purpose, outside production.
 *
 * A failure Sovrium has no specific handling for is the one case that offers a
 * bug report, and it has no ordinary trigger that is guaranteed to stay a
 * failure: a bug, once found, is fixed. This seam raises one on demand:
 *
 * - `start` — `sovrium start` fails inside its startup, after the configuration
 *   validated;
 * - `crash` — the CLI dispatcher throws before the named command runs;
 * - `action:<automation>` — the first action of that automation dies (throws
 *   instead of failing), so its run is closed as stopped on an internal error;
 * - `page:<path>` — the render of a request to that URL path throws, as a bug
 *   in a page's render would, so the server answers it with its `500` page.
 *
 * `SOVRIUM_FAULT_INJECTION_DETAIL` is appended to the error's message, which is
 * how a test puts a value into an error text and proves the report removes it.
 *
 * Ignored entirely when `NODE_ENV=production`, the posture of the
 * `GET /test/error` page route: a deployed instance never fails on request.
 * Pure: the environment is a parameter.
 */

type Env = Readonly<Record<string, string | undefined>>

/** The variable that names the fault. */
export const SOVRIUM_FAULT_INJECTION_VAR = 'SOVRIUM_FAULT_INJECTION'

/** The variable whose value the injected error's message ends with. */
export const SOVRIUM_FAULT_INJECTION_DETAIL_VAR = 'SOVRIUM_FAULT_INJECTION_DETAIL'

/** A fault the seam can raise. */
export type FaultInjection =
  | { readonly kind: 'start' | 'crash'; readonly value: string; readonly detail?: string }
  | {
      readonly kind: 'action'
      readonly value: string
      readonly automation: string
      readonly detail?: string
    }
  | {
      readonly kind: 'page'
      readonly value: string
      readonly path: string
      readonly detail?: string
    }

const ACTION_PREFIX = 'action:'
const PAGE_PREFIX = 'page:/'

/** The fault a prefixed value names (`action:<automation>`, `page:/<path>`), if any. */
const parsePrefixedFault = (
  value: string,
  detail: { readonly detail?: string }
): FaultInjection | undefined => {
  if (value.startsWith(ACTION_PREFIX) && value.length > ACTION_PREFIX.length) {
    return { kind: 'action', value, automation: value.slice(ACTION_PREFIX.length), ...detail }
  }
  if (value.startsWith(PAGE_PREFIX)) {
    return { kind: 'page', value, path: value.slice('page:'.length), ...detail }
  }
  return undefined
}

/**
 * The fault the environment asks for, or `undefined` when none is asked for,
 * the value names no fault, or the process runs in production.
 */
export const parseFaultInjection = (env: Env): FaultInjection | undefined => {
  if (env['NODE_ENV'] === 'production') return undefined
  const value = env[SOVRIUM_FAULT_INJECTION_VAR]?.trim() ?? ''
  const rawDetail = env[SOVRIUM_FAULT_INJECTION_DETAIL_VAR] ?? ''
  const detail = rawDetail === '' ? {} : { detail: rawDetail }
  if (value === 'start' || value === 'crash') return { kind: value, value, ...detail }
  return parsePrefixedFault(value, detail)
}

/** Whether the environment asks the first action of `automation` to die. */
export const isActionFaultInjected = (env: Env, automation: string): boolean => {
  const fault = parseFaultInjection(env)
  return fault?.kind === 'action' && fault.automation === automation
}

/** Whether the environment asks the render of a request to URL `path` to throw. */
export const isPageFaultInjected = (env: Env, path: string): boolean => {
  const fault = parseFaultInjection(env)
  return fault?.kind === 'page' && fault.path === path
}
