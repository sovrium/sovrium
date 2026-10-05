/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A card's QR code: the value of the card's record, drawn in the browser.
 *
 * A board or gallery card is drawn from records the browser fetched, so its
 * QR cannot be drawn on the server. The encoder is the server's own, loaded
 * with `import()` the first time a card holds a QR — it is a chunk of its own,
 * so a board without one never downloads it. Its output is the encoder's SVG:
 * the value becomes module geometry and the title is escaped text, so no
 * record data reaches the markup.
 */

import { createElement, useEffect, useState, type ReactElement } from 'react'
import type { EccLevel } from '@/domain/models/app/links/qr-code-service'

/**
 * Draw `value` as a QR code named `title`; empty until the encoder has loaded.
 * `size`, `ecc` and `className` mean what they mean on a page `qr-code`.
 */
export function CardQr({
  value,
  title,
  size,
  ecc,
  className,
}: {
  readonly value: string
  readonly title: string
  readonly size?: number
  readonly ecc?: EccLevel
  readonly className?: string
}): ReactElement {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    import('@/domain/models/app/links/qr-code-service')
      .then(({ encodeQrSvg }) => {
        const encoded = encodeQrSvg(value, { title: title || value, size, ecc })
        setSvg(encoded.ok ? encoded.value : '')
      })
      // A failed load leaves the host empty, which is what it held before.
      .catch(() => undefined)
  }, [value, title, size, ecc])
  return createElement('div', {
    className,
    'data-component-type': 'qr-code',
    'data-qr-value': value,
    dangerouslySetInnerHTML: { __html: svg },
  })
}
