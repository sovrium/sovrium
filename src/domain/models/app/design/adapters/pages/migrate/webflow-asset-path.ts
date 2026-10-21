/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where an asset a Webflow page names sits in the site's code export.
 *
 * A page names its images relative to its own place in the export:
 * `blog/post.html` writes `../images/x.png` for the export's `images/x.png`.
 * The reference is resolved against the folder of the HTML file that holds
 * it, inside the archive, with POSIX normalisation (`.` and `..` segments
 * collapsed), and a path the site serves from its root (`/images/x.png`) is
 * read from the archive's root.
 *
 * A reference that climbs above the archive's root names no file of the
 * export: written as it is, it would point at whatever the operator's site
 * serves at that path, so it is answered as outside the export.
 */

/** Where a reference leads: a path inside the export, a network address, an inline file, or outside. */
export type WebflowAssetPlace =
  | { readonly kind: 'archive'; readonly path: string }
  | { readonly kind: 'network'; readonly url: string }
  | { readonly kind: 'inline' }
  | { readonly kind: 'outside'; readonly reference: string }

/** The folder segments of a file's path inside the archive. */
const folderOf = (file: string): readonly string[] => file.split('/').slice(0, -1)

/**
 * A path's segments, `.` and `..` collapsed against `base`; `undefined` when a
 * `..` climbs above the root.
 */
const normalised = (
  base: readonly string[],
  segments: readonly string[]
): readonly string[] | undefined =>
  segments.reduce<readonly string[] | undefined>((folder, segment) => {
    if (folder === undefined || segment === '' || segment === '.') return folder
    if (segment !== '..') return [...folder, segment]
    return folder.length === 0 ? undefined : folder.slice(0, -1)
  }, base)

/**
 * Where an asset reference written in `file` leads.
 *
 * @param file - the HTML file holding the reference, by its path inside the archive.
 * @param reference - the reference as the page wrote it (`src`).
 */
export const webflowAssetPlaceOf = (file: string, reference: string): WebflowAssetPlace => {
  const written = reference.trim()
  if (/^data:/i.test(written)) return { kind: 'inline' }
  if (/^(?:https?:)?\/\//i.test(written)) return { kind: 'network', url: written }
  if (/^[a-z][a-z0-9+.-]*:/i.test(written)) return { kind: 'outside', reference: written }
  const path = written.replace(/[?#].*$/, '')
  const base = path.startsWith('/') ? [] : folderOf(file.replaceAll('\\', '/'))
  const segments = normalised(base, path.split('/'))
  return segments === undefined || segments.length === 0
    ? { kind: 'outside', reference: written }
    : { kind: 'archive', path: segments.join('/') }
}
