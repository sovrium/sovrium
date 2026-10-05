/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'

/**
 * The island props of an app page's navigation: swap the page's main landmark,
 * in the `app` scope (replace the region node, serve the app's own pages).
 * Serialized once — every page that mounts the island carries the same props.
 */
const SPA_NAV_PROPS = JSON.stringify({ regionId: 'main-content', scope: 'app' })

/**
 * The `spa-nav` island host of a page whose sidebar opts into client-side
 * navigation (`sidebar.clientSideNavigation`).
 *
 * Rendered OUTSIDE `<main id="main-content">`, beside the presence mount: the
 * island owns the document-level click and history listeners, and a host inside
 * the swapped region would be unmounted by the very swap it drives. It renders
 * nothing visible; the links stay real `<a href>`, so a page without
 * JavaScript navigates exactly as before.
 */
export function PageSpaNavMount(): Readonly<ReactElement> {
  return (
    <span
      hidden={true}
      data-island="spa-nav"
      data-island-props={SPA_NAV_PROPS}
    />
  )
}
