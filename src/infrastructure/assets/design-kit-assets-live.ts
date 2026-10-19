/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpath } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { Effect, Layer, Option } from 'effect'
import {
  DesignKitAssetReadError,
  DesignKitAssets,
} from '@/application/ports/services/design-kit-assets'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { webFontFileName } from '@/infrastructure/css/theme/fonts/web-font-files'
import { readEmbeddedSample } from './embedded-static-assets'
import { EMBEDDED_WEB_FONTS } from './web-fonts'
import type { DesignKitAssetFile } from '@/application/ports/services/design-kit-assets'

/** The family each embedded face declares in its `@font-face` rule (`theme/fonts/*.ts`). */
const FONT_FAMILIES: Readonly<Record<string, string>> = {
  geist: 'Geist Variable',
  'geist-mono': 'Geist Mono Variable',
}

/** Where the component manual's fragments sit in the documentation payload. */
const COMPONENT_MANUAL_PREFIX = 'src/domain/models/app/pages/components/'

const readFailure = (cause: unknown) => new DesignKitAssetReadError({ cause })

/** Whether `target` is `root` or lies beneath it. */
const isWithin = (root: string, target: string): boolean =>
  target === root || target.startsWith(`${root}${sep}`)

/**
 * The file a root-relative path names inside the public directory, or
 * `undefined` when it is missing or leaves the directory — through `..` or
 * through a symbolic link, since both sides are resolved first.
 */
const publicFileAt = async (
  publicDir: string,
  path: string
): Promise<DesignKitAssetFile | undefined> => {
  if (!path.startsWith('/') || path.startsWith('//')) return undefined
  const root = await realpath(publicDir).catch(() => undefined)
  if (root === undefined) return undefined
  const target = await realpath(resolve(root, `.${path}`)).catch(() => undefined)
  if (target === undefined || target === root || !isWithin(root, target)) return undefined
  const file = Bun.file(target)
  if (!(await file.exists())) return undefined
  return {
    fileName: target.slice(target.lastIndexOf(sep) + 1),
    mediaType: inferMimeFromKey(target),
    bytes: await file.bytes(),
  }
}

/** The component manual's fragments, read from the documentation payload. */
const componentManual = Effect.tryPromise({
  try: async () => {
    // Imported here, not at the top: this layer is on every server's boot
    // path, and the manual's payload stays off it until a bundle is built.
    const { embeddedDocPaths, readEmbeddedDoc } = await import('./embedded-docs')
    return Promise.all(
      embeddedDocPaths()
        .filter((path) => path.startsWith(COMPONENT_MANUAL_PREFIX))
        .map(async (path) => ({ path, text: await readEmbeddedDoc(path) }))
    )
  },
  catch: readFailure,
}).pipe(Effect.withSpan('design-kit-assets.component-manual'))

/**
 * The bundle's files, read from the binary's own payload — fonts and samples
 * under the names they are served with — and from the app's public directory
 * when the caller names one.
 *
 * @param publicDir - the directory the app serves its public files from;
 *   `undefined` when it serves none, and then no public file is ever found.
 */
export const makeDesignKitAssetsLive = (publicDir: string | undefined) =>
  Layer.succeed(DesignKitAssets, {
    webFonts: Effect.tryPromise({
      try: () =>
        Promise.all(
          EMBEDDED_WEB_FONTS.map(async (font) => ({
            fileName: webFontFileName(font),
            mediaType: 'font/woff2',
            bytes: await Bun.file(font.path).bytes(),
            family: FONT_FAMILIES[font.name] ?? font.name,
            weight: '100 900',
            style: 'normal' as const,
          }))
        ),
      catch: readFailure,
    }).pipe(Effect.withSpan('design-kit-assets.web-fonts')),
    sampleMedia: (name) =>
      Effect.tryPromise({
        try: () => readEmbeddedSample(name),
        catch: readFailure,
      }).pipe(
        Effect.map((sample) =>
          Option.map(Option.fromUndefinedOr(sample), (asset) => ({
            fileName: name,
            mediaType: asset.contentType,
            bytes: asset.bytes,
          }))
        ),
        Effect.withSpan('design-kit-assets.sample-media')
      ),
    publicFile: (path) =>
      publicDir === undefined
        ? Effect.succeedNone
        : Effect.tryPromise({
            try: () => publicFileAt(publicDir, path),
            catch: readFailure,
          }).pipe(
            Effect.map(Option.fromUndefinedOr),
            Effect.withSpan('design-kit-assets.public-file')
          ),
    componentManual,
  })

/** The bundle's files for a caller that serves no public directory. */
export const DesignKitAssetsLive = makeDesignKitAssetsLive(undefined)
