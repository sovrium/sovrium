/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// The path of a private asset. It lives at the app root, like `css-length.ts`,
// because two feature models name it: `assets` declares the files, and the
// automation actions read them through `{ asset: <path> }` — and the domain
// forbids one feature importing another.

/**
 * Whether a path stays inside the project directory BY ITS SPELLING.
 *
 * Relative, `/`-separated, no empty / `.` / `..` segment, no drive letter, no
 * home shorthand. A symbolic link that resolves outside the project cannot be
 * seen from the spelling; that check runs against the filesystem when the app
 * starts and when `validate` reads the config.
 */
const isContainedPath = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith('/') &&
  !path.startsWith('~') &&
  !path.includes('\\') &&
  !/^[A-Za-z]:/.test(path) &&
  path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')

/**
 * The path of a private asset, relative to the directory holding the config.
 *
 * The same spelling is how an action names the asset (`{ asset: <path> }`) and
 * how an HTML or SVG template embeds it (`<img src="images/logo.png">`).
 */
export const AssetPathSchema = Schema.String.pipe(
  Schema.annotate({
    description:
      "Path of the file relative to the directory that holds the config, written with '/' (e.g. 'templates/invoice.html'). It must stay inside the project: no leading '/', no '..' segment.",
  }),
  Schema.check(
    Schema.makeFilter((path: string) => isContainedPath(path), {
      message:
        "an asset path must be relative to the config directory, use '/', and contain no '..' or empty segment",
    })
  )
)

/** @public */
export type AssetPath = Schema.Schema.Type<typeof AssetPathSchema>
