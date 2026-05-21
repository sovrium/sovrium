/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef } from 'react'
import { type FieldDef } from '../components/crud-form/fields'
import { type CrudFormIslandProps, type FormState, type SubmitContext } from './types'

const DEFAULT_AUTO_SAVE_DEBOUNCE_MS = 500

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
  readonly enabled: boolean
  readonly formRef: React.RefObject<HTMLFormElement | null>
}

export function useAutoSave(params: UseAutoSaveParams): UseAutoSaveResult {
  const { island, values, ctx } = params
  const formRef = useRef<HTMLFormElement | null>(null)
  const saveMode = island.autoSave?.saveMode
  const enabled =
    island.operation === 'update' &&
    !!island.recordId &&
    (saveMode === 'auto' || saveMode === 'onBlur')

  const valuesRef = useRef(values)
  valuesRef.current = values

  const runSave = useCallback(() => {
    const form = formRef.current
    if (form && !form.checkValidity()) return
    const changed = diffChangedFields(island.fields, valuesRef.current, island.record)
    void persistAutoSave(ctx, changed)
  }, [ctx, island.fields, island.record])

  useEffect(() => {
    if (!enabled || saveMode !== 'auto') return
    const delay = island.autoSave?.autoSaveDebounceMs ?? DEFAULT_AUTO_SAVE_DEBOUNCE_MS
    const handle = setTimeout(runSave, delay)
    return () => clearTimeout(handle)
  }, [enabled, saveMode, island.autoSave?.autoSaveDebounceMs, runSave, values])

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
