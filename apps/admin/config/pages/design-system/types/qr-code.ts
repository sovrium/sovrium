/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `qr-code` — a link, made scannable.
//
// Drawn as the real component rather than through the shared specimen, and the
// reason is a decode rule worth knowing: a `specimen` naming a LITERAL type is
// validated against that type's own required-field rules, so
// `subject: { type: 'qr-code' }` is refused with "declares neither 'link' nor
// 'value' — it has nothing to encode". The derived page never hit this because
// its subject was a `$param` placeholder, which is not a type name at decode
// time.
//
// The rule is right. A QR code with nothing to encode is not a QR code, and a
// catalogue that drew one would be drawing a grey square.

import type { TypePageBody } from './_shape'

const qrCode: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [{ type: 'qr-code', link: 'https://sovrium.com', size: 128 }],
    },
  ],
}

export default qrCode
