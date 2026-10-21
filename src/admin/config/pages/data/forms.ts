/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Submissions — what your forms received, one inbox per form.
//
//   `/submissions`        the bare collection, which 302s to the first form.
//   `/submissions/:form`  that form's metrics, toolbar, inbox and detail drawer.
//
// ─── THE ONE THING THAT NEEDED SOLVING: LINKING OUT OF THE CONSOLE ─────────
//
// The toolbar carries an "Open form" link to the LIVE, submittable form — a page
// of the OPERATOR's app, not of the console. Every mount-local `href` a preset
// page writes is moved onto the mount's base when the console is first opened,
// which is exactly right for a console link and exactly wrong for this one:
// `/forms/contact` would become `/_admin/forms/contact`, the page the operator
// is already on.
//
// `$app.origin` resolves that without a new primitive. A value that does not
// begin with `/` is not a mount-local path, so the walk that moves the others
// leaves it alone; at render it becomes the scheme and host THIS request
// arrived on, which for a mounted console is the operator's own app. The result
// is an absolute URL out of the console and into the live form.
//
// ─── ONE BEHAVIOUR CHANGE, STATED ─────────────────────────────────────────
//
// The link now always targets the CANONICAL `/forms/{name}` route, where a form
// is reachable whether or not it declares a custom `path` (`FormPathSchema`).
// The retired builder preferred the custom path when one was declared. Config
// cannot read it — `$param.form` is the form's NAME, and the declared path is
// not on the route — so a form declaring `path: /contact` now opens at
// `/forms/contact` instead. Both serve the same form; only the address is less
// pretty.

import dashboardDataFormsForm from './dashboard-data-forms-form.page.json'
import dashboardDataForms from './dashboard-data-forms.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataForms as PageConfig,
  dashboardDataFormsForm as PageConfig,
] satisfies readonly PageConfig[]
