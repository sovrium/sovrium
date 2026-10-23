/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'

/**
 * The geometry of each Lucide icon a fetched row named, asked once per name per
 * document. The name comes from a row, so it is known only in the browser; the
 * icon set stays on the server (`lucide-glyph.tsx` says why), which answers
 * `/assets/icons/<name>` with the icon's geometry, or 404 for a name it does not
 * know — and an unknown name draws no icon.
 */
const geometry = new Map<string, Promise<unknown>>()

/** The geometry of `name`, fetched at most once; `undefined` when the server knows no such icon. */
function geometryOf(name: string): Promise<unknown> {
  const known = geometry.get(name)
  if (known !== undefined) return known
  const asked = fetch(`/assets/icons/${encodeURIComponent(name)}`)
    .then((response) => (response.ok ? response.json() : undefined))
    .then((body) => (body as { readonly iconNode?: unknown } | undefined)?.iconNode)
    .catch(() => undefined)
  geometry.set(name, asked)
  return asked
}

/** A Lucide icon a row named, drawn once its geometry has arrived. */
export default function FetchedLucideIcon({ name }: { readonly name: string }) {
  const [iconNode, setIconNode] = useState<unknown>(undefined)
  useEffect(() => {
    let live = true
    void geometryOf(name).then((node) => {
      if (live) setIconNode(node)
    })
    return () => {
      live = false
    }
  }, [name])
  if (iconNode === undefined) return undefined
  return (
    <LucideGlyph
      iconNode={iconNode}
      name={name}
      size={16}
      aria-hidden="true"
    />
  )
}
