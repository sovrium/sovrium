/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CheckGlyph } from './control-glyphs'
import type { ReactElement } from 'react'

/** The classes of the signed reading's item parts, resolved by the server. */
export interface SignedItemClasses {
  readonly row: string
  readonly media: string
  readonly content: string
  readonly title: string
  readonly description: string
}

/**
 * The reading of a signature already given, drawn as ONE outlined shadcn/ui
 * `Item`: a check in its media, "Signed by … on …" as its title and the
 * statement agreed to as its description.
 *
 * Shared by the server renderer (a field signed before the page loaded) and the
 * pad island (the reading it turns into once the signature is written), so the
 * two never draw the same state in two ways. The classes arrive resolved: the
 * outline row is a `tailwind-merge` of the list's item base, which the server
 * can afford and an island cannot, so the server resolves every part once
 * (`signedItemClasses` in the signature-pad renderer) and hands the strings to
 * the island with its props.
 */
export function SignatureSignedItem({
  title,
  statement,
  classes,
  attributes,
}: {
  readonly title: string
  readonly statement: string | undefined
  readonly classes: SignedItemClasses
  /** Extra attributes for the row, such as the server's component-type stamp. */
  readonly attributes?: Readonly<Record<string, string | undefined>>
}): ReactElement {
  return (
    <div
      {...attributes}
      role="status"
      data-slot="signature-pad-signed"
      data-variant="outline"
      data-size="default"
      className={classes.row}
    >
      <div
        data-slot="item-media"
        data-variant="icon"
        className={classes.media}
      >
        <CheckGlyph />
      </div>
      <div
        data-slot="item-content"
        className={classes.content}
      >
        <div
          data-slot="item-title"
          className={classes.title}
        >
          {title}
        </div>
        {statement !== undefined && (
          <p
            data-slot="item-description"
            className={classes.description}
          >
            {statement}
          </p>
        )}
      </div>
    </div>
  )
}
