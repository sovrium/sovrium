/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  StaticSiteGenerator,
  type SSGGenerationError,
} from '@/application/ports/services/static-site-generator'
import { readPageSearchRuntime } from '@/infrastructure/assets/page-search-runtime'
import { copyDirectory } from '@/infrastructure/filesystem/copy-directory'
import { StaticOutputWriterLive } from '@/infrastructure/filesystem/static-output-writer-live'
import { generateStaticSite } from '@/infrastructure/server/ssg-adapter'

/**
 * Live implementation of StaticSiteGenerator using Hono SSG
 *
 * This layer provides the production implementation of static site generation
 * using Hono's toSSG functionality.
 */
const StaticSiteGeneratorOnly = Layer.succeed(StaticSiteGenerator, {
  generate: generateStaticSite,
  readPageSearchRuntime,
  copyDirectory: (source, destination) =>
    copyDirectory(source, destination).pipe(
      Effect.mapError((error): SSGGenerationError => ({
        _tag: 'SSGGenerationError',
        message: error.message,
        cause: error,
      }))
    ),
})

/**
 * The static build's file services: the generator above, and the
 * `StaticOutputWriter` every build step and the boot's page-search pass write
 * through. Provided together because every composition that renders a static
 * site also writes its supporting files, so naming one without the other could
 * only produce a build that compiles and cannot write.
 */
export const StaticSiteGeneratorLive = Layer.mergeAll(
  StaticSiteGeneratorOnly,
  StaticOutputWriterLive
)
