/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A built web app, as the application layer sees it: something that answers a
 * request.
 *
 * Infrastructure builds a Hono app and hands it out through `ServerInstance`
 * and `ServerFactory.buildRenderApp`; the application never reaches into it —
 * it only hands it back to the `StaticSiteGenerator` that renders from it. So
 * the ports name this one member rather than the framework's whole type, and
 * the framework stays an infrastructure dependency.
 */
export interface HttpApp {
  readonly fetch: (request: Request) => Response | Promise<Response>
}
