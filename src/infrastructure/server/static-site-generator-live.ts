/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { StaticSiteGenerator } from '@/application/ports/static-site-generator'
import { generateStaticSite } from '@/infrastructure/server/ssg-adapter'

/**
 * Live implementation of StaticSiteGenerator using Hono SSG
 *
 * This layer provides the production implementation of static site generation
 * using Hono's toSSG functionality.
 */
export const StaticSiteGeneratorLive = Layer.succeed(StaticSiteGenerator, {
  generate: generateStaticSite,
})
