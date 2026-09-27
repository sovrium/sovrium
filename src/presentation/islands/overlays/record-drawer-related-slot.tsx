/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record drawer's CAP-8 related slot, as the island mounts it
 *. A hook rather than a component the island renders
 * so the island's body stays one element handed to its surface.
 */

import { useMemo, type ReactElement } from 'react'
import {
  RecordDrawerRelated,
  type RelatedLabels,
  type RelatedSection,
} from './record-drawer-related'

/**
 * The island props the related slot reads: the sections the SSR host resolved
 * against the related tables and the caller's permissions (an unreadable one
 * is absent), and the create affordance's labels — the grid's own wording.
 */
export interface RelatedSlotProps {
  readonly related?: ReadonlyArray<RelatedSection>
  readonly newRecordLabel?: string
  readonly cancelLabel?: string
  readonly createFailedLabel?: string
}

/**
 * The drawer's related slot, or nothing when it declares no section. The
 * labels fall back to the platform-default (English) catalog entries, used
 * only if a host mounts the island without them.
 */
export function useRelatedSlot(
  props: RelatedSlotProps,
  state: { readonly open: boolean; readonly recordId: string | undefined; readonly save: string },
  onReplace: () => void
): ReactElement | undefined {
  const { related: sections, newRecordLabel, cancelLabel, createFailedLabel } = props
  const labels = useMemo<RelatedLabels>(
    () => ({
      newRecord: newRecordLabel ?? 'New record',
      save: state.save,
      cancel: cancelLabel ?? 'Cancel',
      createFailed: createFailedLabel ?? 'The record could not be created.',
    }),
    [newRecordLabel, cancelLabel, createFailedLabel, state.save]
  )
  if (sections === undefined || sections.length === 0) return undefined
  return (
    <RecordDrawerRelated
      sections={sections}
      recordId={state.recordId}
      open={state.open}
      labels={labels}
      onReplace={onReplace}
    />
  )
}
