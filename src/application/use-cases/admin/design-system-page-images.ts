/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The images the exported pages draw from the app's public directory, carried
 * into the bundle so a drawing shows them away from the server.
 *
 * The renderer draws an image the config names as `/brand/mark.svg` at that
 * root-relative address, which resolves to nothing inside a directory handed
 * to a design tool. Each such file found in the public directory is copied
 * under the page drawings (`pages/assets/…`), under the Claude Design canvas
 * (`adapters/claude-design/canvas/assets/…`, so the canvas uploads whole),
 * beside the Figma page documents, and into the Penpot file, and the drawings
 * point at their copies. The public path is kept below `assets/`, so two files
 * sharing a basename never collide, and each colour-mode variant keeps its own
 * file.
 *
 * An `https://` address is left as written, and nothing is fetched. A path
 * naming no file of the public directory is named in a notice by page and
 * node; every other page and image is still carried.
 */

import { posix } from 'node:path'
import { Effect, Option } from 'effect'
import { DesignKitAssets } from '@/application/ports/services/design-kit-assets'
import { penpotUuidOf } from '@/domain/models/app/design/adapters/pages/penpot-pages-format'
import type { DesignSystemBundleEntry } from './design-system-bundle'
import type { DesignKitAssetFile } from '@/application/ports/services/design-kit-assets'

/** One drawn page: its name and the markup inside its `<main>`. */
export interface DrawnPageBody {
  readonly page: string
  readonly body: string
}

/** The public files the drawings name, by their root-relative path. */
export interface PageImages {
  readonly files: ReadonlyMap<string, DesignKitAssetFile>
  readonly notices: readonly string[]
}

const IMAGE_TAG = /<img\b[^>]*>/g
const SOURCE = /\ssrc="([^"]*)"/

/** An attribute's value as a path: entities decoded, `..` and `.` segments resolved. */
const decodedAttribute = (value: string): string =>
  posix.normalize(
    value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&')
  )

/** A root-relative address of the app's own, never another site's. */
const isPublicPath = (src: string): boolean => src.startsWith('/') && !src.startsWith('//')

/** Every root-relative image of a drawing, with the node it is stamped with. */
const imagesOf = (body: string) =>
  [...body.matchAll(IMAGE_TAG)].flatMap((match) => {
    const src = SOURCE.exec(match[0])?.[1]
    const id = /\sdata-sovrium-id="([^"]*)"/.exec(match[0])?.[1]
    return src === undefined || !isPublicPath(decodedAttribute(src))
      ? []
      : [{ src: decodedAttribute(src), id }]
  })

/**
 * The public files every drawing's images name, and one notice per stamped
 * image whose file is not there.
 *
 * @param drawn - each exported page's drawing, in config order.
 */
export const collectPageImages = (drawn: readonly DrawnPageBody[]) =>
  Effect.gen(function* () {
    const assets = yield* DesignKitAssets
    const named = drawn.flatMap((page) =>
      imagesOf(page.body).map((image) => ({ ...image, page: page.page }))
    )
    const paths = [...new Set(named.map((image) => image.src))].toSorted()
    const found = yield* Effect.forEach(paths, (path) =>
      Effect.map(assets.publicFile(path), (file) => [path, Option.getOrUndefined(file)] as const)
    )
    const files = new Map(
      found.flatMap(([path, file]) => (file === undefined ? [] : [[path, file] as const]))
    )
    const notices = named
      .filter((image) => image.id !== undefined && !files.has(image.src))
      .map(
        (image) =>
          `Note: page ${image.page}, node ${image.id ?? ''}: ${image.src} is not in the public ` +
          'directory, so the drawing shows no image there.'
      )
    return { files, notices } satisfies PageImages
  }).pipe(
    Effect.withSpan('design-system.page-images', { attributes: { 'design.pages': drawn.length } })
  )

/**
 * A drawing with every carried image pointed at its copy under `directory`
 * (`assets/` beside `pages/`, `../assets/` from a canvas board).
 */
export const withImagesAt = (body: string, images: PageImages, directory: string): string =>
  images.files.size === 0
    ? body
    : body.replaceAll(IMAGE_TAG, (tag) =>
        tag.replace(SOURCE, (whole, src: string) =>
          images.files.has(decodedAttribute(src))
            ? ` src="${directory}${decodedAttribute(src).slice(1).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`
            : whole
        )
      )

/** The carried files of every place that draws them but the Penpot file. */
export const pageImageEntries = (images: PageImages): readonly DesignSystemBundleEntry[] =>
  [...images.files].flatMap(([path, file]) =>
    (
      [
        ['pages/assets', 'page'],
        ['adapters/claude-design/canvas/assets', 'adapter'],
        ['adapters/figma/pages/assets', 'adapter'],
      ] as const
    ).map(([directory, role]) => ({
      path: `${directory}${path}`,
      mediaType: file.mediaType,
      role,
      bytes: file.bytes,
    }))
  )

/** The carried files as Penpot archive entries, each under `objects/` as the format keeps media. */
export const penpotImageEntries = (
  images: PageImages
): readonly { readonly name: string; readonly bytes: Uint8Array }[] =>
  [...images.files].map(([path, file]) => ({
    name: `objects/${penpotUuidOf(`image:${path}`)}`,
    bytes: file.bytes,
  }))
