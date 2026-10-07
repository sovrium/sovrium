/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'
import type { GalleryPartClasses } from '@/presentation/design/gallery-part-classes'

/**
 * The gallery's piece classes, the author's parts already merged on the server
 * (`galleryClasses` in the payload). Absent, each piece draws its recipe.
 */
export const GalleryClassesContext = createContext<GalleryPartClasses | undefined>(undefined)
