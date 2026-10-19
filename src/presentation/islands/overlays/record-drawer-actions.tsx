/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record drawer's footer actions (CAP-1): a row of buttons below the record
 * body, each firing against the loaded record — a `fetch`, a `crud` delete or
 * update (`record-drawer-crud.ts`), or an `openSheet` that hands the same
 * record to the drawer it names — behind an optional confirm gate. Split out of `record-drawer-content.tsx`, which composes it.
 */

import { useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
} from 'react'
import {
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import {
  computeButtonDefaultClasses,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import { executeFetchAction } from '../runtime/action-executor'
import { dispatch } from '../runtime/event-bus'
import { InlineConfirmDialog, ObjectConfirmDialog } from '../runtime/inline-confirm-dialog'
import { renderToast } from '../runtime/toast'
import {
  holdActionFocus,
  settleActionFocus,
  type ActionFocusHold,
} from './record-drawer-action-focus'
import { runDrawerCrud } from './record-drawer-crud'
import type { DrawerBuiltInLabels } from './record-drawer-labels'
import type { Action, FetchAction } from '@/domain/models/app/pages/components/action'
import type { CrudAction } from '@/domain/models/app/pages/components/action-operations'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

type RawRecord = Record<string, unknown>

/**
 * The words a footer draws and says on its own, in the page language the SSR
 * host resolved: the Cancel of its questions, and what a refused write toasts.
 */
type DrawerActionWords = Pick<DrawerBuiltInLabels, 'cancel' | 'writeRefusal'>

/** A footer action button the drawer renders below the record body (CAP-1). */
export interface DrawerAction {
  readonly label: string
  readonly action: Action
  /** The `button` variant it is drawn in; none draws an outline button. */
  readonly variant?: ButtonVariant
  /** Confirm gate before firing — the legacy STRING prompt or the rich OBJECT form. */
  readonly confirm?: string | ConfirmObject
  /** Drawn only on a record meeting it (`record-drawer-visibility.ts`). */
  readonly visibleWhen?: FieldCondition
}

/** What a footer action does to the sheet it belongs to once it has run. */
interface DrawerSettle {
  /** Close the sheet. */
  readonly onLeave: () => void
  /** Read the record again: the action wrote it and the sheet stays open. */
  readonly onWritten: () => void
}

/**
 * A footer `fetch`: its toast either way, and on success the executor's shared
 * outcome — `navigate` with `$record.*` read from the record the drawer shows
 * (`action-outcome.ts`). `close` closes this drawer, which the footer belongs
 * to; otherwise a request the sheet sent itself reads the record again, so its
 * fields and `visibleWhen` buttons follow the write. A refusal closes nothing.
 */
async function runDrawerFetch(
  action: FetchAction,
  record: RawRecord,
  settle: DrawerSettle
): Promise<void> {
  const result = await executeFetchAction(action, { record, renderToast })
  if (result?.ok !== true) return
  if (action.onSuccess?.close === true) settle.onLeave()
  else if ((action.mode ?? 'fetch') === 'fetch') settle.onWritten()
}

/**
 * Dispatch a drawer footer action against the loaded record. Reuses the shared
 * `executeFetchAction` runtime — `$record.<field>` in the action's `url` / `body`
 * resolves against `record` at CLICK time (the drawer loads its record lazily).
 * An `openSheet` action closes this drawer and opens the one it names.
 */
function dispatchDrawerAction(
  action: Action,
  record: RawRecord,
  settle: DrawerSettle,
  words: DrawerActionWords
): void {
  const { onLeave } = settle
  if ('type' in action && action.type === 'fetch') {
    void runDrawerFetch(action as FetchAction, record, settle)
    return
  }
  if ('type' in action && action.type === 'crud') {
    void runDrawerCrud(action as CrudAction, record, settle, words.writeRefusal)
    return
  }
  // `openSheet` hands the SAME record to the drawer it names — a detail drawer
  // whose footer opens the decision drawer — and steps aside for it, so one
  // modal surface is open at a time.
  if ('action' in action && action.action === 'openSheet') {
    onLeave()
    dispatch('sovrium:open-drawer', { id: action.component, record })
  }
}

const NO_WORDS: DrawerActionWords = {}

/** The class a footer action is drawn with: a `button` of its variant, outline by default. */
const actionButtonClass = (variant: ButtonVariant | undefined): string =>
  computeButtonDefaultClasses({ variant: variant ?? 'outline' })

/**
 * A single footer action button. A `confirm`-bearing action arms the shared
 * inline `alertdialog` gate on the first click (its confirm affordance re-uses
 * this action's label); otherwise the action fires immediately.
 */
function DrawerActionButton({
  item,
  record,
  disabled,
  settle,
  words,
}: {
  readonly item: DrawerAction
  readonly record: RawRecord
  /** The record has not loaded yet: `$record.*` would resolve against nothing. */
  readonly disabled: boolean
  readonly settle: DrawerSettle
  readonly words: DrawerActionWords
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const fire = useCallback(
    () => dispatchDrawerAction(item.action, record, settle, words),
    [item.action, record, settle, words]
  )

  if (item.confirm && confirming) {
    // The OBJECT form renders the shared `ObjectConfirmDialog` (separate title /
    // dialog role / type-to-confirm input / label overrides); the legacy STRING
    // form keeps the byte-identical inline gate.
    if (typeof item.confirm !== 'string') {
      return (
        <ObjectConfirmDialog
          config={item.confirm}
          record={record}
          fallbackConfirmLabel={item.label}
          {...(words.cancel === undefined ? {} : { fallbackCancelLabel: words.cancel })}
          onConfirm={fire}
          onCancel={() => setConfirming(false)}
        />
      )
    }
    return (
      <InlineConfirmDialog
        prompt={substituteRecordVars(item.confirm, withRecordText(record))}
        confirmLabel={item.label}
        {...(words.cancel === undefined ? {} : { cancelLabel: words.cancel })}
        onConfirm={fire}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <button
      type="button"
      data-component-type="button"
      className={actionButtonClass(item.variant)}
      disabled={disabled}
      onClick={() => (item.confirm ? setConfirming(true) : fire())}
    >
      {item.label}
    </button>
  )
}

/** The footer action row rendered below the record body (nothing when empty). */
export function DrawerActions({
  actions,
  record,
  loading,
  onLeave,
  words = NO_WORDS,
}: {
  readonly actions: ReadonlyArray<DrawerAction>
  readonly record: RawRecord
  readonly loading: boolean
  readonly onLeave: () => void
  readonly words?: DrawerActionWords | undefined
}): ReactElement | null {
  const queryClient = useQueryClient()
  const settle = useMemo<DrawerSettle>(
    () => ({
      onLeave,
      onWritten: () =>
        void queryClient.invalidateQueries({ queryKey: ['record-drawer', 'table-record'] }),
    }),
    [onLeave, queryClient]
  )
  // The control that fired, held until the re-read its write started is done:
  // only a loading → loaded transition settles it (`record-drawer-action-focus.ts`).
  const held = useRef<ActionFocusHold | undefined>(undefined)
  const wasLoading = useRef(loading)
  const onPress = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const control = (event.target as Element).closest('button')
    if (control !== null) held.current = holdActionFocus(control)
  }, [])
  useEffect(() => {
    const settled = wasLoading.current && !loading
    wasLoading.current = loading
    if (!settled || held.current === undefined) return
    settleActionFocus(held.current)
    held.current = undefined
  }, [loading])
  if (actions.length === 0) return null
  return (
    <div
      className="border-border mt-2 flex flex-wrap gap-2 border-t pt-4"
      onClickCapture={onPress}
    >
      {actions.map((item, index) => (
        <DrawerActionButton
          key={`${item.label}-${index}`}
          item={item}
          record={record}
          disabled={loading}
          settle={settle}
          words={words}
        />
      ))}
    </div>
  )
}
