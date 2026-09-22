/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  ContentDirReadError,
  ContentDirReader,
} from '@/application/ports/services/content-dir-reader'
import {
  computeContentDirCorpusChecksum,
  readContentDirBodyForSlug,
} from '@/infrastructure/markdown/content-dir-enumerator'
import type { ContentDir } from '@/domain/models/app/pages/content-dir'

/**
 * Filesystem implementation of the content-dir read port.
 *
 * A thin adapter over the existing enumerator: the directory walk, the
 * front-matter split, the ordering and the slug derivation are one contract
 * shared with the page renderer and the index route, and a second reader with
 * its own copy of the slug rule is how two surfaces start disagreeing about
 * which file a URL names. This layer moves the call across the layer boundary;
 * it does not own the walk.
 */
export const ContentDirReaderLive = Layer.succeed(ContentDirReader, {
  readBodyForSlug: (contentDir: Readonly<ContentDir>, slug: string) =>
    Effect.tryPromise({
      try: () => readContentDirBodyForSlug(contentDir, slug),
      catch: (cause) => new ContentDirReadError({ cause }),
    }),
  // Takes the whole `contentDir` where the enumerator takes a directory path,
  // so the port speaks one vocabulary. The narrowing to `.directory` is the
  // adapter's business, and keeping it here is what lets the scan gain an input
  // later without every caller learning about it.
  corpusChecksum: (contentDir: Readonly<ContentDir>) =>
    Effect.tryPromise({
      try: () => computeContentDirCorpusChecksum(contentDir.directory),
      catch: (cause) => new ContentDirReadError({ cause }),
    }),
})
