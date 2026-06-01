/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isPublicPage } from './is-public'
import type { Page } from './page'

export const getPublicPagePaths = (pages: readonly Page[] | undefined): readonly string[] =>
  (pages ?? [])
    .filter((page) => !page.path.startsWith('/_') && isPublicPage(page))
    .map((page) => page.path)
