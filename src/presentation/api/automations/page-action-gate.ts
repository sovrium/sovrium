/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who may run an automation through `POST /api/automations/:name/form-action`
 * — the road a page button, an alert-dialog confirm and a data form with
 * `action: { type: automation }` post to.
 *
 * The road is mounted without a session gate, because a button on a public page
 * is its whole reason to exist. Finding an automation by name alone would run an
 * admin-only manual automation without its `requiredRole`, a schedule or a
 * record automation on demand, a webhook automation on a body its signature
 * check never saw. So it admits an automation only when all of these hold:
 *
 *   1. its trigger is `manual`, and some page component names it
 *      (`pressablePageAutomation`);
 *   2. one of the pages that names it admits the caller under its `access`
 *      rule, judged on the same session a visit to that page is judged on;
 *   3. a `requiredRole` the trigger DECLARES holds for the caller's stored
 *      role, as on the direct trigger route. The implicit `admin` default does
 *      not apply here: the page's `access` rule is the author's grant, and the
 *      default would refuse every public-page button.
 *
 * Every refusal is the caller's to answer exactly as an unknown name is
 * answered, so the road does not tell which names exist or what starts them.
 * What the gate admits still runs only while it is operationally on — the
 * `runPagePressedAutomation` use-case reads the pause and `enabled` flag.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import { mayRunManualAutomation } from '@/domain/models/app/automations/manual-trigger-role-service'
import {
  pressablePageAutomation,
  type ManualAutomation,
} from '@/domain/models/app/pages/page-automation-binding-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Context } from 'hono'

/** The router's own session reader — the one `checkPageAccess` is fed at render. */
export type PageSessionResolver = (headers: Headers) => Promise<SessionInfo | undefined>

/**
 * What the gate admitted: the automation, and the id of the caller it judged —
 * the same session the page's `access` rule was read on, so the presser the run
 * records is the person the page let through. `undefined` for a visitor.
 */
export interface PageActionAdmission {
  readonly automation: ManualAutomation
  readonly userId: string | undefined
}

/** The admission when a page press may run automation `name`, `undefined` otherwise. */
export const admitPageAction = async (
  c: Context,
  app: App,
  name: string,
  getSession: PageSessionResolver | undefined
): Promise<PageActionAdmission | undefined> => {
  const session = getSession === undefined ? undefined : await getSession(c.req.raw.headers)
  const automation = pressablePageAutomation(app, name, session)
  if (automation === undefined) return undefined
  const admission = { automation, userId: session?.userId }
  if (automation.trigger.requiredRole === undefined) return admission
  // The declared role is read for the same caller the page rule was judged on.
  const role =
    session === undefined ? undefined : await runDomainPromise(c, getUserRole(session.userId))
  return mayRunManualAutomation(automation, app, role) ? admission : undefined
}
