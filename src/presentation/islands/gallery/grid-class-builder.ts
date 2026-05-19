/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { GalleryGridColumns } from '@/domain/models/app/pages/components/component-types/data/gallery'

const BREAKPOINTS = {
  mobile: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

type Breakpoint = keyof typeof BREAKPOINTS

const BASE_GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

const SM_GRID_CLASS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
}

const MD_GRID_CLASS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
}

const LG_GRID_CLASS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

const XL_GRID_CLASS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
}

const DEFAULT_MOBILE_COLUMNS = 1

function classFor(map: Record<number, string>, count: number | undefined): string | undefined {
  return count === undefined ? undefined : map[count]
}

export function buildGridClasses(columns: GalleryGridColumns | undefined): string {
  const mobile = columns?.mobile ?? DEFAULT_MOBILE_COLUMNS
  const parts: ReadonlyArray<string | undefined> = [
    BASE_GRID_CLASS[mobile] ?? BASE_GRID_CLASS[DEFAULT_MOBILE_COLUMNS],
    classFor(SM_GRID_CLASS, columns?.sm),
    classFor(MD_GRID_CLASS, columns?.md),
    classFor(LG_GRID_CLASS, columns?.lg),
    classFor(XL_GRID_CLASS, columns?.xl),
  ]
  return parts.filter((c): c is string => Boolean(c)).join(' ')
}

export function resolveActiveBreakpoint(viewportWidth: number): Breakpoint {
  if (viewportWidth > BREAKPOINTS.xl) return 'xl'
  if (viewportWidth > BREAKPOINTS.lg) return 'lg'
  if (viewportWidth > BREAKPOINTS.md) return 'md'
  if (viewportWidth > BREAKPOINTS.sm) return 'sm'
  return 'mobile'
}

export function resolveActiveColumns(
  columns: GalleryGridColumns | undefined,
  viewportWidth: number
): number {
  if (!columns) return DEFAULT_MOBILE_COLUMNS
  const active = resolveActiveBreakpoint(viewportWidth)
  const order: ReadonlyArray<Breakpoint> = ['xl', 'lg', 'md', 'sm', 'mobile']
  const startIndex = order.indexOf(active)
  const candidates = order.slice(startIndex)
  const matched = candidates.find((bp) => columns[bp] !== undefined)
  if (!matched) return DEFAULT_MOBILE_COLUMNS
  return columns[matched] ?? DEFAULT_MOBILE_COLUMNS
}
