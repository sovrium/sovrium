/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * One signer of a signing flow, and where her mark goes on the document.
 *
 * Contact values (`email`, `phone`, `displayName`) are read from the record
 * when the request is sent, through `$record.<field>` references, or written
 * as literals. They are copied onto the request at that moment: editing the
 * record afterwards never redirects a link already sent.
 *
 * A signer's `field` is a `signature` field of the flow's table. The engine
 * writes it when she signs; nothing else may, and two signers never share one.
 */

/** A signer or flow name: lowercase words joined by `-` or `_`. */
export const SIGNATURE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/

/** The width a placed mark takes when `width` is left out, in PDF points. */
export const DEFAULT_SIGNATURE_MARK_WIDTH = 180

/** The most signers one flow may declare. */
export const MAX_SIGNERS = 20

export const SignatureSignerNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Signer Name',
    description:
      'Name of this signer within the flow, used in links, events and the evidence file: lowercase letters and digits, words joined by - or _.',
    examples: ['employee', 'manager', 'client'],
  }),
  Schema.check(
    Schema.isPattern(SIGNATURE_NAME_PATTERN, {
      message:
        'A signer name is lowercase letters and digits, words joined by - or _ (for example employee or legal-rep).',
    })
  )
)

/** A contact value: a literal, or a `$record.<field>` read when the request is sent. */
const contactValue = (description: string, examples: readonly string[]) =>
  Schema.String.pipe(
    Schema.annotate({ description, examples: [...examples] }),
    Schema.check(Schema.isMinLength(1))
  )

/** A non-negative length in PDF points. */
const pointsSchema = (description: string) =>
  Schema.Finite.pipe(
    Schema.annotate({ description }),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  )

/** Where the mark's top-left corner sits, in points from the page's top-left corner. */
export const SignatureMarkPointSchema = Schema.Struct({
  x: pointsSchema('Points from the left edge of the page to the left edge of the mark'),
  y: pointsSchema('Points from the top edge of the page to the top edge of the mark'),
}).pipe(
  Schema.annotate({
    description:
      "An exact position for the mark's top-left corner, in points from the page's top-left corner",
  })
)

/** The mark is drawn into a signature field the PDF already declares. */
export const SignaturePdfFieldPlacementSchema = Schema.Struct({
  pdfField: Schema.String.pipe(
    Schema.annotate({
      description:
        "Name of a signature field the PDF already contains, kept as the mark's position: the mark is drawn inside that field's box.",
      examples: ['employee_sig'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignaturePdfFieldPlacement',
    title: 'Signature Placement In A PDF Field',
    description: 'Draw the mark inside a signature field the PDF already declares, by name.',
  })
)

/** The mark is drawn at a position on a page. */
export const SignaturePointPlacementSchema = Schema.Struct({
  page: Schema.Union([
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Page number, the first page being 1' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))
    ),
    Schema.Literal('last').annotate({ description: 'The last page of the document' }),
  ]).pipe(
    Schema.annotate({
      description:
        'The page the mark is drawn on: a page number counted from 1, or last. A number past the end of the document refuses the request when it is sent.',
      examples: [1, 'last'],
    })
  ),
  at: SignatureMarkPointSchema,
  width: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: String(DEFAULT_SIGNATURE_MARK_WIDTH),
        description:
          'Width of the mark in points; its height follows the drawn image, or is a third of the width for a typed name. One point is 1/72 of an inch.',
      }),
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'SignaturePointPlacement',
    title: 'Signature Placement At A Point',
    description: 'Draw the mark at an exact position on one page of the document.',
  })
)

export const SignaturePlacementSchema = Schema.Union([
  SignaturePdfFieldPlacementSchema,
  SignaturePointPlacementSchema,
]).pipe(
  Schema.annotate({
    title: 'Signature Placement',
    description:
      'Where the signer’s mark is drawn on the signed document: inside a named signature field of the PDF, or at a position on a page. Left out, the mark appears only in the proof file.',
  })
)

export const SignatureSignerSchema = Schema.Struct({
  name: SignatureSignerNameSchema,
  email: contactValue(
    'Address the signing link and any email code are sent to: a literal address or a $record.<field> reference, read when the request is sent.',
    ['$record.employee_email', 'legal@example.com']
  ),
  phone: Schema.optional(
    contactValue(
      'Mobile number a text-message code is sent to, in international form (+33…): a literal or a $record.<field> reference, read when the request is sent. Required when the flow verifies by text message.',
      ['$record.employee_phone']
    )
  ),
  displayName: Schema.optional(
    contactValue(
      'Name shown to the signer and printed in the proof file: a literal or a $record.<field> reference. Left out, the email address is shown.',
      ['$record.employee_name']
    )
  ),
  field: Schema.String.pipe(
    Schema.annotate({
      description:
        'The signature field of the flow’s table this signer’s signature is stored in. Only the engine writes it, when she signs.',
      examples: ['employee_signature'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  placement: Schema.optional(SignaturePlacementSchema),
}).pipe(
  Schema.annotate({
    identifier: 'SignatureSigner',
    title: 'Signer',
    description:
      'One person asked to sign: how to reach her, the signature field her signature is stored in, and where her mark is drawn on the document.',
  })
)

/** @public */
export type SignatureSigner = Schema.Schema.Type<typeof SignatureSignerSchema>
