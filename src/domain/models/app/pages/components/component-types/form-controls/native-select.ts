/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `native-select` — one choice in the browser's own dropdown, with no script to
 * load. shadcn/ui's Native Select, under its own name.
 *
 * ## A promotion, not a new control
 *
 * The control already ships: it is `select` with `native: true`, the
 * server-rendered `<select>` left enabled and never replaced by an island. This
 * type is that control without the flag, so its keys are picked from
 * {@link selectFields} rather than redeclared.
 *
 * Left out on purpose: `native` (this type always is the browser's control) and
 * the three type-ahead keys — `searchable`, `searchPlaceholder`,
 * `allowCustomValue` — which the platform control cannot honour and whose
 * control is `type: combobox`. A per-option `icon` decodes here, because the
 * option list is shared, and is refused by the same semantic check that refuses
 * it on a `select` with `native: true`.
 *
 * `multiple` is kept: a multi-select is a real platform control, a poor one,
 * which is the author's judgement rather than a contradiction to refuse.
 */

import { Schema } from 'effect'
import { selectFields } from './select'

export const NativeSelectTypeLiteral = Schema.Literal('native-select')

export const nativeSelectFields = {
  props: selectFields.props,
  classes: selectFields.classes,
  visibility: selectFields.visibility,
  i18n: selectFields.i18n,
  options: selectFields.options,
  dataSource: selectFields.dataSource,
  publishes: selectFields.publishes,
  emptyOption: selectFields.emptyOption,
  defaultValue: selectFields.defaultValue,
  multiple: selectFields.multiple,
} as const
