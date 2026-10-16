/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { SharedFilterPublisherConfig } from './use-shared-filter-publisher'

/** The publisher runtime, loaded once, the first time a declaring island asks for it. */
const loadPublisher = () => import('../runtime/shared-filter-publish')

/**
 * `useSharedFilterPublisher`'s contract, with the publisher runtime loaded ON
 * DEMAND: for an island whose publishing is incidental to what it draws (a
 * tree publishes the node a reader selects), so a page that declares no
 * `publishes` on it never downloads the wire, the address mirror or the
 * late-join record.
 *
 * The module is requested at mount when `publishes` is declared — which is
 * also when a value the control left in the page address is published again —
 * and every later publish waits on the same promise, so values go out in the
 * order the reader made them even if the first arrives before the module.
 */
export function useLazySharedFilterPublisher(
  publishes: SharedFilterPublisherConfig | undefined
): (value: unknown) => void {
  const signature = publishes === undefined ? '' : JSON.stringify(publishes)

  useEffect(() => {
    if (publishes === undefined) return
    void loadPublisher().then(({ publisherWire, publishOnChannel, valueInAddress }) => {
      const wire = publisherWire(publishes)
      const restored = valueInAddress(wire)
      if (wire !== undefined && restored !== undefined) publishOnChannel(wire, restored)
    })
    // `signature` stands in for the object's identity, which changes per render.
  }, [signature])

  return useCallback(
    (value: unknown): void => {
      if (publishes === undefined) return
      void loadPublisher().then(({ publisherWire, publishOnChannel }) => {
        const wire = publisherWire(publishes)
        if (wire !== undefined) publishOnChannel(wire, value)
      })
    },
    [signature]
  )
}

/**
 * Publish the record a reader selects in a record view (a list, a board, a
 * gallery, a calendar, a map): the returned toggle publishes the record's id,
 * and called again with the same id clears the selection and withdraws it.
 * `undefined` when the view declares no `publishes`.
 */
export function useRecordSelectionToggle(
  publishes: SharedFilterPublisherConfig | undefined
): ((recordId: unknown) => void) | undefined {
  const publish = useLazySharedFilterPublisher(publishes)
  const selected = useRef('')
  const toggle = useCallback(
    (recordId: unknown): void => {
      const id = recordId === null || recordId === undefined ? '' : String(recordId)
      if (id === '') return
      selected.current = selected.current === id ? '' : id
      publish(selected.current)
    },
    [publish]
  )
  return publishes === undefined ? undefined : toggle
}
