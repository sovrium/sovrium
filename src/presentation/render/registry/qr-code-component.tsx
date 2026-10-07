/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import { resolveQrCode, resolveQrPayload } from '@/presentation/render/resolve/qr-code-resolver'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'
import type { QrCodeSpec } from '@/presentation/render/resolve/qr-code-resolver'
import type { ReactElement } from 'react'

/**
 * Renderer for `{ type: 'qr-code' }` — a scannable symbol rendered inline.
 *
 * SSR-ONLY, DELIBERATELY — it emits NO `data-island` marker, matching `marquee`,
 * `toc` and `theme-toggle`. A QR is a deterministic function of its payload, so
 * hydrating one would buy nothing while costing island payload budget on a page
 * whose whole job may be to be printed. Keeping it script-free is also what
 * makes it correct with JavaScript disabled and printable from the browser's own
 * print dialog. A later "make it interactive" change would quietly destroy that
 * property, which is why a pages media spec pins it.
 *
 * Registered through `media-components.ts` — it belongs with the media family
 * (it is a static rendering of a value) but needs its own `.tsx` file for the
 * `dangerouslySetInnerHTML` below, the same split `marquee` and `toc` use.
 *
 * WHAT IT DOES NOT DO: the payload derivation and the encoding both live in
 * `@/presentation/rendering/qr-code-resolver`, because the encoder is a domain
 * SERVICE and a `presentation-component` may not import one. This file is
 * therefore purely presentational — it chooses the markup, nothing else.
 *
 * The accessible name comes from the generic `props` bag
 * (`props: { 'aria-label': 'Check-in code' }`) and is handed to the encoder as
 * the SVG's `<title>`. That is what makes the symbol announceable: the `<svg>`
 * carries `role="img"`, so its `<title>` becomes its accessible name, and a QR
 * matrix is otherwise completely opaque to a screen reader.
 *
 * `data-qr-value` carries the encoded string in the markup. Inside the SVG the
 * payload exists only as path geometry, so without it the one thing an author
 * most needs to check — *what did it actually encode?* — is unreadable in view
 * source, in a diff, and in a test.
 *
 * The `link`/`value` exclusion is NOT re-checked here: it is enforced once at
 * decode time (`@/domain/models/app/qr-code-validation`), so a component
 * reaching this renderer has exactly one of the two.
 */

/**
 * The `qr-code` fields this renderer reads off the component definition.
 *
 * Derived from the resolver's own spec rather than restated, so the two cannot
 * drift — and so this file never names `EccLevel`, which lives in the domain
 * SERVICE this layer may not import even for a type.
 */
type QrCodeComponentFields = Pick<QrCodeSpec, 'link' | 'value' | 'size' | 'ecc'>

/** The attributes every host this renderer writes carries. */
interface QrHostAttributes {
  readonly className: string | undefined
  readonly dataTestId: string | undefined
  readonly componentType: string | undefined
  readonly accessibleName: string | undefined
}

/**
 * A value naming `$record.` belongs to a record the server does not hold here
 * (a record drawer's slot): the host carries the template, and the island draws
 * the symbol once the record lands (`islands/runtime/qr-template.ts`).
 * `undefined` for every other QR, which the server draws itself.
 */
function recordTemplateHost(
  component: QrCodeComponentFields,
  host: QrHostAttributes
): ReactElement | undefined {
  const payload = resolveQrPayload({
    ...(component.link === undefined ? {} : { link: component.link }),
    ...(component.value === undefined ? {} : { value: component.value }),
  })
  if (payload === undefined || !payload.includes('$record.')) return undefined
  return (
    <div
      className={host.className}
      data-testid={host.dataTestId}
      data-component-type={host.componentType}
      data-qr-template={payload}
      data-qr-title={host.accessibleName}
      data-qr-size={component.size}
      data-qr-ecc={component.ecc}
    />
  )
}

export const qrCodeComponent: ComponentRenderer = (
  config: ComponentDispatchConfig
): ReactElement | null => {
  const component = (config.component ?? {}) as QrCodeComponentFields
  const elementProps = config.elementPropsWithSpacing
  const className = elementProps['className'] as string | undefined
  const dataTestId = elementProps['data-testid'] as string | undefined
  const accessibleName = elementProps['aria-label'] as string | undefined
  const componentType = hostComponentType(elementProps)

  const template = recordTemplateHost(component, {
    className,
    dataTestId,
    componentType,
    accessibleName,
  })
  if (template !== undefined) return template

  const resolved = resolveQrCode({
    ...(component.link === undefined ? {} : { link: component.link }),
    ...(component.value === undefined ? {} : { value: component.value }),
    ...(component.size === undefined ? {} : { size: component.size }),
    ...(component.ecc === undefined ? {} : { ecc: component.ecc }),
    ...(accessibleName === undefined ? {} : { title: accessibleName }),
  })

  if (resolved.kind === 'nothing-to-encode') return null

  // A page must not 500 because one component's string was too long, so the
  // symbol is dropped and the reason is left where an author will actually find
  // it rather than disappearing into a silently empty box.
  if (resolved.kind === 'failed') {
    return (
      <div
        className={className}
        data-testid={dataTestId}
        data-component-type={componentType}
        data-qr-value={resolved.payload}
        data-qr-error={resolved.errorCode}
      />
    )
  }

  return (
    <div
      className={className}
      data-testid={dataTestId}
      data-component-type={componentType}
      data-qr-value={resolved.payload}
      // eslint-disable-next-line sovrium/require-sanitized-html -- SVG the QR encoder generates from the payload; no raw string is spliced in
      dangerouslySetInnerHTML={{ __html: resolved.svg }}
    />
  )
}
