/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef } from 'react'
import { type FieldDef } from '../components/crud-form/fields'
import { type CrudFormIslandProps, type FormState, type SubmitContext } from './types'

/** Default debounce delay (ms) for `saveMode: 'auto'` when not configured. */
const DEFAULT_AUTO_SAVE_DEBOUNCE_MS = 500

/**
 * Computes the subset of `values` that differs from the initially loaded
 * record. Only changed fields are sent to the update endpoint so untouched
 * columns are never re-written.
 */
function diffChangedFields(
  fields: readonly FieldDef[],
  values: Record<string, string>,
  record: Record<string, unknown> | undefined
): Record<string, string> {
  return Object.fromEntries(
    fields
      .filter((f) => {
        const current = values[f.name] ?? ''
        const original = record?.[f.name]
        const originalStr = original !== undefined && original !== null ? String(original) : ''
        return current !== originalStr
      })
      .map((f) => [f.name, values[f.name] ?? ''])
  )
}

/**
 * Persists the changed fields via the update mutation. Skips the network call
 * entirely when nothing changed, so a blur on an untouched field is a no-op.
 */
async function persistAutoSave(ctx: SubmitContext, changed: Record<string, string>): Promise<void> {
  if (!ctx.recordId || Object.keys(changed).length === 0) return
  ctx.setState({ isPending: true })
  try {
    await ctx.updateRecord.mutateAsync({ recordId: ctx.recordId, fields: changed })
    ctx.setState({ isPending: false })
  } catch (err) {
    const error = err as { message?: string }
    ctx.setState({ error: error.message ?? 'Auto-save failed', isPending: false })
  }
}

interface UseAutoSaveParams {
  readonly island: CrudFormIslandProps
  readonly values: Record<string, string>
  readonly ctx: SubmitContext
  readonly setState: (s: FormState) => void
}

interface UseAutoSaveResult {
  /** True when auto-save is active for this form (edit mode + auto/onBlur). */
  readonly enabled: boolean
  /** Ref to attach to the `<form>` element for validity checks and blur capture. */
  readonly formRef: React.RefObject<HTMLFormElement | null>
}

/**
 * Wires automatic persistence of form edits.
 *
 * Auto-save activates only for `update` (edit) mode with a resolved
 * `recordId` and an `autoSave.saveMode` of `auto` or `onBlur`:
 *
 * - `auto`   — debounced save after each keystroke (Airtable-like). The
 *   debounce window is `autoSaveDebounceMs` (default 500ms).
 * - `onBlur` — save when an edited field loses focus (Notion-like).
 *
 * Create-mode forms never auto-save: an explicit submit is
 * always required to create a new record.
 *
 * Before any save the hook runs `form.checkValidity()`; if a native HTML
 * constraint (e.g. `type="email"`) fails, the save is skipped so invalid
 * values are never persisted.
 *
 * Only fields that differ from the initially loaded record are sent
 *, leaving untouched columns unchanged.
 */
export function useAutoSave(params: UseAutoSaveParams): UseAutoSaveResult {
  const { island, values, ctx } = params
  const formRef = useRef<HTMLFormElement | null>(null)
  const saveMode = island.autoSave?.saveMode
  const enabled =
    island.operation === 'update' &&
    !!island.recordId &&
    (saveMode === 'auto' || saveMode === 'onBlur')

  // Latest values + record kept in a ref so debounce/blur callbacks read fresh
  // data without re-subscribing on every keystroke.
  const valuesRef = useRef(values)
  // eslint-disable-next-line functional/immutable-data -- ref mirrors latest controlled values
  valuesRef.current = values

  const runSave = useCallback(() => {
    const form = formRef.current
    // Skip persistence when a native HTML constraint fails (e.g. invalid email).
    if (form && !form.checkValidity()) return
    const changed = diffChangedFields(island.fields, valuesRef.current, island.record)
    void persistAutoSave(ctx, changed)
  }, [ctx, island.fields, island.record])

  // `auto` mode: debounce a save after each value change.
  useEffect(() => {
    if (!enabled || saveMode !== 'auto') return
    const delay = island.autoSave?.autoSaveDebounceMs ?? DEFAULT_AUTO_SAVE_DEBOUNCE_MS
    const handle = setTimeout(runSave, delay)
    return () => clearTimeout(handle)
  }, [enabled, saveMode, island.autoSave?.autoSaveDebounceMs, runSave, values])

  // `onBlur` mode: persist when an edited field loses focus.
  useEffect(() => {
    if (!enabled || saveMode !== 'onBlur') return
    const form = formRef.current
    if (!form) return
    const onBlur = () => runSave()
    form.addEventListener('focusout', onBlur)
    return () => form.removeEventListener('focusout', onBlur)
  }, [enabled, saveMode, runSave])

  return { enabled, formRef }
}
