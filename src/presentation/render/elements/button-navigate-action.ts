/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The navigate action of a button: its type guard and the click it performs.
 * A sibling of `button-action-builders.ts`, which holds the attribute builders
 * of the actions the client runtime runs.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { mapStringsDeep } from '@/domain/models/app/languages/translation-resolver'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'

/** A navigation action: moves the reader to `path` (`$record.*` filled server-side). */
export type NavigateButtonAction = {
  readonly type: 'navigate'
  readonly path: string
  readonly openInNewTab?: boolean
  /**
   * Resolver-to-renderer marker: `path` as the config wrote it, before a bound
   * record's `$record.*` values were filled into `path`. Set by
   * {@link fillNavigateActionPath}; absent when no record was filled in.
   */
  readonly _configuredPath?: string
}

/** Returns true if the given action is a navigate action. */
export function isNavigateAction(action: unknown): action is NavigateButtonAction {
  const candidate = action as { type?: string; path?: unknown }
  return candidate?.type === 'navigate' && typeof candidate.path === 'string'
}

/**
 * A navigate action with `$record.*` filled into its `path` by `fill`, keeping
 * the path the config wrote in `_configuredPath` (the first one, when a second
 * record pass runs), or `undefined` for any value that is not a navigate
 * action. The page resolver's record pass fills a component's typed fields
 * long before the button is drawn; without the configured path,
 * {@link buildNavigateClick} would read a record value as if the config had
 * written it, and a record holding `https://elsewhere/…` would choose the site.
 */
function fillNavigateActionPath(
  action: unknown,
  fill: (value: string) => string
): NavigateButtonAction | undefined {
  if (!isNavigateAction(action)) return undefined
  // Returned whole, never walked: a blind walk would fill `_configuredPath`.
  if (!action.path.includes('$record.')) return action
  return {
    ...action,
    path: fill(action.path),
    _configuredPath: action._configuredPath ?? action.path,
  }
}

/**
 * One typed field of a component with `$record.*` filled into every string leaf
 * by `fill` — except a navigate `action`, which keeps the path its config wrote
 * beside the filled one ({@link fillNavigateActionPath}): the site it may leave
 * for is decided on that, never on a value.
 */
export function fillRecordIntoTypedField(
  key: string,
  value: unknown,
  fill: (value: string) => string
): unknown {
  return (key === 'action' && fillNavigateActionPath(value, fill)) || mapStringsDeep(value, fill)
}

/**
 * An absolute `http(s)` address whose scheme and host are written in the config
 * itself: the authority holds no `$` token (nor a `\`), and ends at a `/`, `?`,
 * `#` or the end of the text. Whatever a `$record.*` value later fills in lands
 * after that authority, so it can never choose the site the reader is sent to.
 */
const CONFIG_OWNED_ABSOLUTE = /^https?:\/\/[^/?#\\$]+(?:[/?#]|$)/i

/**
 * The click a navigate button performs, in the shape the always-shipped click
 * enhancer reads (`data-click-navigate` / `data-click-open-url`), or `undefined`
 * when the destination is not one a page may send its reader to.
 *
 * `$record.*` is filled from the record the button is drawn for — here, or
 * already by the page resolver, which leaves the configured path in
 * `_configuredPath`. The site is decided by the CONFIG, never by the record: an
 * absolute `http(s)` address is followed only when the configured `path` names
 * its host itself; anything else — a `$record.*` value that turns out to be
 * `https://…`, `//host` or `javascript:` included — must be a same-origin path,
 * rebuilt by the URL parser, as a card or row navigate's is. A new tab is opened through
 * `openUrl`, the only branch of the enhancer that honours `openInNewTab`.
 */
export function buildNavigateClick(
  action: NavigateButtonAction,
  record: Readonly<Record<string, unknown>> | undefined
):
  | { readonly navigate?: string; readonly openUrl?: string; readonly openInNewTab?: boolean }
  | undefined {
  const path = record === undefined ? action.path : substituteRecordVars(action.path, record)
  const configured = action._configuredPath ?? action.path
  const target = CONFIG_OWNED_ABSOLUTE.test(configured) ? path : toSafeRedirectPath(path)
  if (target === undefined) return undefined
  return action.openInNewTab === true
    ? { openUrl: target, openInNewTab: true }
    : { navigate: target }
}
