/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Write a mounted island's descriptive attributes onto the element that NAMES it.
 *
 * A data island is named once: the SSR host carries `data-component` beside
 * `data-component-type`, and the element the island mounts inside it carries
 * neither — two elements answering `[data-component="gallery"]` made every
 * reader count the component twice. What the mounted element used to say about
 * itself (the gallery's active column count, the calendar's view, the KPI's
 * state) belongs to the component too, so it moves to the element that names
 * it. It is found by the name rather than by `data-island`, because the same
 * island also mounts INSIDE a data-table's view switcher, where the named
 * element is a wrapper the switcher draws and the nearest island host is the
 * table's.
 *
 * The attributes are set in a layout effect — before paint, so a reader never
 * sees the name without the description — and removed when the element
 * unmounts, so a state that ends (a loading card) does not leave its value
 * behind for the next one to contradict.
 *
 * @param name - the `data-component` value of the naming element
 * @param attributes - attribute name → value; `undefined` omits the attribute
 * @returns the ref to attach to the island's mounted root element
 */
export function useNamedHostAttributes<T extends HTMLElement>(
  name: string,
  attributes: Readonly<Record<string, string | undefined>>
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const serialized = JSON.stringify(attributes)
  useLayoutEffect(() => {
    const host = ref.current?.closest(`[data-component="${name}"]`)
    if (!host) return undefined
    const entries = Object.entries(JSON.parse(serialized) as Record<string, string | undefined>)
    entries.forEach(([key, value]) => {
      if (value !== undefined) host.setAttribute(key, value)
    })
    return () => entries.forEach(([key]) => host.removeAttribute(key))
  }, [name, serialized])
  return ref
}
