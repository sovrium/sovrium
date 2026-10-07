/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import {
  CLIENT_CHUNK_DIR,
  getClientBundle,
  serveClientChunk,
} from '@/infrastructure/assets/client-entries'
import { logError } from '@/infrastructure/logging/logger'

/**
 * Serve the client runtime's chunks at `/assets/client-chunks/<name>`: only a
 * name the current build emitted, else 404, so no request path is ever joined
 * onto a directory. The current names are ALSO literal routes, because static
 * generation (`sovrium build`) writes literal routes only. Reading them builds
 * the runtime at boot in a source checkout (milliseconds); a failed build
 * leaves the pattern route alone, failing the request rather than the boot.
 *
 * @param cacheControl - the `Cache-Control` a chunk name is answered with
 */
export async function setupClientChunkRoutes(
  honoApp: Readonly<Hono>,
  cacheControl: (name: string) => string
): Promise<Readonly<Hono>> {
  const handle = (fixedName?: string) => async (c: Readonly<Context>) => {
    const name = fixedName ?? c.req.param('file') ?? ''
    try {
      return (await serveClientChunk(name, cacheControl(name))) ?? c.notFound()
    } catch (error) {
      logError('[assets] failed to serve client runtime chunk', error, { chunk: name })
      return c.text('/* client runtime chunk failed to load */', 500, {
        'Content-Type': 'application/javascript',
      })
    }
  }
  const current = await getClientBundle()
    .then((bundle) => bundle.chunkNames)
    .catch((error: unknown) => {
      logError('[assets] client runtime build failed at boot', error)
      return [] as readonly string[]
    })
  const withLiterals = current.reduce<Readonly<Hono>>(
    (app, name) => app.get(`/assets/${CLIENT_CHUNK_DIR}/${name}`, handle(name)),
    honoApp
  )
  return withLiterals.get(`/assets/${CLIENT_CHUNK_DIR}/:file{[^/]+\\.js}`, handle())
}
