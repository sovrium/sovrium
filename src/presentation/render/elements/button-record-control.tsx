/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `button` placed on a record that the record can disable (`disabledWhen`).
 *
 * The verdict is the server's: the record the button is drawn for carries the
 * ids of its disabled controls (`_disabled`, judged on the whole row where the
 * page read it), and the page stamped this button's id on it before rendering
 * (`_controlId`, `record-control-service.ts`). A disabled button is drawn with
 * no action at all — no navigation, no fetch, no run to dispatch — marked
 * `aria-disabled`, focusable, with its reason as a tooltip and as its
 * description. An enabled one that starts an automation names the record it
 * is pressed on (`data-action-press`), so the server judges the press there.
 */

import { type ReactElement, type ReactNode } from 'react'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { CONTROL_ID_KEY, CONTROL_TABLE_KEY } from '@/domain/models/app/pages/record-control-service'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import {
  disabledControlAttributes,
  renderDisabledControl,
} from '@/presentation/design/disabled-reason'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ElementProps } from './html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'

type Row = Readonly<Record<string, unknown>>

/** The button's control on its record: its id, its table, and the record. */
export interface ButtonRecordControl {
  readonly id: string
  readonly table: string
  readonly record: Row | undefined
  /** The reason, in the page language and read from the record; set when disabled. */
  readonly disabledReason?: string | undefined
  readonly disabled: boolean
}

/** The button's `disabledReason`, in the page language and read from its record. */
function reasonOf(
  component: Row | undefined,
  record: Row | undefined,
  lang: { readonly currentLang?: string; readonly languages?: Languages } | undefined
): string | undefined {
  const reason = component?.['disabledReason']
  if (typeof reason !== 'string') return undefined
  const translated = resolveTranslationPattern(reason, lang?.currentLang ?? '', lang?.languages)
  return record === undefined ? translated : substituteRecordVars(translated, record)
}

/**
 * The control a record-bound `button` is, or `undefined` for a button the page
 * stamped no id on (no condition, or no table binding above it).
 */
export function buttonRecordControlOf(
  component: Row | undefined,
  props: ElementProps,
  lang: { readonly currentLang?: string; readonly languages?: Languages } | undefined
): ButtonRecordControl | undefined {
  const id = component?.[CONTROL_ID_KEY]
  const table = component?.[CONTROL_TABLE_KEY]
  if (typeof id !== 'string' || typeof table !== 'string') return undefined
  const record = (props as { readonly _record?: Row })._record
  const listed = record?.['_disabled']
  const disabled = Array.isArray(listed) && listed.includes(id)
  return { id, table, record, disabled, disabledReason: reasonOf(component, record, lang) }
}

/**
 * The attributes an enabled record-bound automation button adds: its id, and
 * the record its press names. Nothing when the record has no id to name.
 */
export function buttonPressAttributes(control: ButtonRecordControl): Record<string, string> {
  const recordId = control.record?.['id']
  const named = typeof recordId === 'string' || typeof recordId === 'number'
  return {
    'data-control-id': control.id,
    ...(named && {
      'data-action-press': JSON.stringify({
        table: control.table,
        recordId: String(recordId),
        control: control.id,
      }),
    }),
  }
}

/** A stable id for the reason node: the control on this record. */
const reasonIdOf = (control: ButtonRecordControl): string =>
  `disabled-reason-${control.id}-${String(control.record?.['id'] ?? '')}`.replace(/[^\w-]/g, '-')

/**
 * The button disabled on its record: its label and classes, no action, marked
 * `aria-disabled`, with its reason.
 */
export function renderRecordDisabledButton(
  props: ElementProps,
  buttonContent: ReactNode,
  control: ButtonRecordControl
): ReactElement {
  const {
    label: _label,
    'data-label': _dataLabel,
    disabled: _disabled,
    ...rest
  } = omitInternalMarkers(props) as Record<string, unknown>
  const reason = control.disabledReason
  const reasonId = reasonIdOf(control)
  const button = (
    <button
      {...rest}
      type="button"
      data-control-id={control.id}
      {...disabledControlAttributes(reason ? reasonId : undefined)}
    >
      {buttonContent}
    </button>
  )
  return renderDisabledControl(button, reasonId, reason)
}
