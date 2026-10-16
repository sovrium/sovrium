/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatRecordText } from '@/domain/models/app/tables/record-text-service'
import { computeAttachmentLinkClasses } from '@/presentation/design/cell-affordances-default-classes'
import { resolvePageLocale } from '../../runtime/page-locale'
import { EMPTY_VALUE, isMissing } from '../cell-empty'
import { currencyText } from './currency-text'
import type { CellFieldOptions } from '../cell-renderers'

/**
 * The read-only cells of the field types the renderer registry had no entry
 * for, so each printed whatever TanStack's passthrough made of the stored
 * value: an amount without its currency, a percentage as a bare number, an
 * email that could not be pressed.
 *
 * Money and percentages read through the SAME domain formatter the page text
 * uses (`formatRecordText`), at the field's declared currency and precision, so
 * a grid cell and a `$record.<field>` token print one value one way. The figures
 * themselves are set in tabular figures and right-aligned by their COLUMN
 * (`field-type-presentation-service.ts`), not here.
 */

type CellProps = { readonly value: unknown; readonly fieldOptions?: CellFieldOptions }

const localeOf = (fieldOptions?: CellFieldOptions): string =>
  fieldOptions?.locale ?? resolvePageLocale()

/** A `currency` value, in its declared currency, symbol position and separators. */
export function CurrencyCell({ value, fieldOptions }: CellProps): React.ReactNode {
  return isMissing(value) ? EMPTY_VALUE : currencyText(value, fieldOptions)
}

/** A `percentage` value (stored 0 to 100), at its declared precision. */
export function PercentCell({ value, fieldOptions }: CellProps): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const precision = fieldOptions?.display?.precision
  return formatRecordText(
    value,
    { format: 'percent', ...(precision === undefined ? {} : { precision }) },
    localeOf(fieldOptions)
  )
}

/**
 * A number, an integer, a decimal, an autonumber or a time of day: printed as
 * stored. Grouping a year or a reference (`2,026`) would be wrong, so the value
 * is left alone and only its column decides where it sits.
 */
export function StoredValueCell({ value }: CellProps): React.ReactNode {
  return isMissing(value) ? EMPTY_VALUE : String(value)
}

/** The characters an address may carry before it is offered as a link. */
const EMAIL_SHAPE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const PHONE_SHAPE = /^\+?[\d\s().-]{3,}$/

/** A link of a given scheme, or the plain text when the value is not shaped like one. */
function schemeLink(value: unknown, scheme: 'mailto' | 'tel', shape: RegExp): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const text = String(value).trim()
  if (!shape.test(text)) return text
  const target = scheme === 'tel' ? text.replace(/[^\d+]/g, '') : text
  return (
    <a
      href={`${scheme}:${target}`}
      className={computeAttachmentLinkClasses()}
    >
      {text}
    </a>
  )
}

/** An `email` value, pressable as a `mailto:` link. */
export function EmailLinkCell({ value }: CellProps): React.ReactNode {
  return schemeLink(value, 'mailto', EMAIL_SHAPE)
}

/** A `phone-number` value, pressable as a `tel:` link. */
export function PhoneLinkCell({ value }: CellProps): React.ReactNode {
  return schemeLink(value, 'tel', PHONE_SHAPE)
}
