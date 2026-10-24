/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A clickable Claude Design canvas (`--prototype`): each board's links lead to
 * the boards of their targets, and each board carries the script that plays it
 * (`claude-design-canvas-prototype-runtime.ts`) with what it needs to know of
 * its grids and forms.
 *
 * A link inside the app leads to its target page's board: the board of the
 * record its address names when one is drawn, else the page's default board;
 * a query link (`?tab=history`) to the board drawn at that state. A link
 * outside the app keeps `#`. Every address is relative, board to board, so the
 * canvas plays offline wherever it is opened.
 */

import { posix } from 'node:path'
import {
  addressWithoutLanguage,
  pageOfAddress,
  type CanvasLinkRoute,
} from './claude-design-canvas-links'
import { PROTOTYPE_RUNTIME } from './claude-design-canvas-prototype-runtime'

/** One grid of a board, as the prototype plays it. */
export interface PrototypeTable {
  /** The grid's node id: the drawn table carries it. */
  readonly id: string
  /** The table it reads, for a store to answer. */
  readonly table?: string | undefined
  /** The field each drawn column shows, in order. */
  readonly columns: readonly string[]
  /** Its filter, for a store to keep its rows. */
  readonly filter: readonly {
    readonly field: string
    readonly operator: string
    readonly value?: unknown
  }[]
  readonly pageSize?: number | undefined
  /** The drawn columns a reader may sort by, by index. */
  readonly sortable: readonly number[]
  /** The search inputs that filter it publish to this binding. */
  readonly searchBindTo?: string | undefined
  /** Where each drawn row leads, as an app address. */
  readonly rowPaths: readonly (string | undefined)[]
  /** Where a row leads, as the config writes it (`/vessels/$record.id`). */
  readonly recordPath?: string | undefined
  /** Whether its rows carry a menu of their actions. */
  readonly rowMenu: boolean
  readonly actions: readonly {
    readonly label: string
    readonly table: string
    readonly operation: string
  }[]
  /**
   * The cells of each drawn row that read differently from what is stored, by
   * row id then field: the stored value, and the text drawn for it (its
   * column's format, else its field type's). A cell whose value changed reads
   * as stored.
   */
  readonly texts?: Readonly<Record<string, Readonly<Record<string, readonly [string, string]>>>>
}

/** One field of a step a board does not draw, which the prototype draws. */
export interface PrototypeField {
  readonly name: string
  readonly label: string
  readonly type: string
  readonly required: boolean
}

/** One form of a board, as the prototype plays it. */
export interface PrototypeForm {
  readonly name: string
  /** Its steps, in order, when it has several. */
  readonly steps?:
    | readonly {
        readonly id: string
        readonly title: string
        readonly fields: readonly PrototypeField[]
      }[]
    | undefined
  /** What it answers once submitted: the page it leads to, or its message. */
  readonly success?:
    | { readonly path: string }
    | { readonly message: string; readonly title?: string | undefined }
    | undefined
  /** The table it writes a record to, for a store to keep. */
  readonly writes?: string | undefined
}

/** A button that updates the record its board draws. */
export interface PrototypeUpdate {
  readonly id: string
  readonly table: string
  readonly data: Readonly<Record<string, unknown>>
}

/** What one board plays. */
export interface BoardPrototype {
  readonly tables: readonly PrototypeTable[]
  readonly forms: readonly PrototypeForm[]
  readonly updates?: readonly PrototypeUpdate[] | undefined
}

/** Every board of the canvas, as a link reaches it. */
export interface PrototypeCatalog {
  readonly routes: readonly CanvasLinkRoute[]
  readonly boards: readonly {
    readonly file: string
    readonly page: string
    readonly state: string | undefined
  }[]
  /** The record each routed page's default board draws, by page. */
  readonly defaultRecords: Readonly<Record<string, string>>
  /** The codes of the languages the app is served in, each a segment an address may open with. */
  readonly languages?: readonly string[] | undefined
}

/** The value of each route parameter an address gives a page's pattern. */
const routeValuesOf = (pattern: string, address: string): readonly string[] => {
  const wanted = pattern.split('/').filter((segment) => segment !== '')
  const given = (address.split(/[?#]/, 1)[0] ?? '').split('/').filter((segment) => segment !== '')
  return wanted.flatMap((segment, at) => (segment.startsWith(':') ? [given[at] ?? ''] : []))
}

/** The board an in-app address leads to, as a canvas file; `undefined` when none draws it. */
export const prototypeTargetOf = (
  catalog: PrototypeCatalog,
  fromPage: string,
  address: string
): string | undefined => {
  const target = address.trim()
  const boardOf = (page: string, state: string | undefined) =>
    catalog.boards.find((board) => board.page === page && board.state === state)?.file
  if (target.startsWith('?')) {
    const states = target.slice(1).split('&')
    return states.map((state) => boardOf(fromPage, state)).find((file) => file !== undefined)
  }
  if (!/^\/(?!\/)/.test(target)) return undefined
  const page = pageOfAddress(catalog.routes, target, catalog.languages)
  if (page === undefined) return undefined
  const pattern = catalog.routes.find((route) => route.name === page)?.path ?? ''
  const path =
    pageOfAddress(catalog.routes, target) === undefined
      ? addressWithoutLanguage(target, catalog.languages).address
      : target
  const record = routeValuesOf(pattern, path).find(
    (value) => boardOf(page, `record=${value}`) !== undefined
  )
  return record !== undefined && catalog.defaultRecords[page] !== record
    ? boardOf(page, `record=${record}`)
    : boardOf(page, undefined)
}

/** The relative address from one board to another. */
export const relativeBoardHref = (from: string, to: string): string => {
  const relative = posix.relative(posix.dirname(from), to)
  return relative === '' ? posix.basename(to) : relative
}

/** What the board's script plays, every address resolved to a board. */
const resolvedConfigOf = (
  catalog: PrototypeCatalog,
  board: { readonly file: string; readonly page: string },
  prototype: BoardPrototype,
  store: unknown
) => {
  const hrefOf = (address: string | undefined): string | undefined => {
    const target =
      address === undefined ? undefined : prototypeTargetOf(catalog, board.page, address)
    return target === undefined ? undefined : relativeBoardHref(board.file, target)
  }
  return {
    tables: prototype.tables.map(({ rowPaths, recordPath, ...table }) => ({
      ...table,
      rowHrefs: rowPaths.map((path) => hrefOf(path)),
      ...(recordPath === undefined ? {} : { recordHref: recordPath }),
    })),
    forms: prototype.forms.map(({ success, ...form }) => ({
      ...form,
      ...(success === undefined
        ? {}
        : 'message' in success
          ? { success }
          : {
              success: {
                href: hrefOf(success.path.replaceAll(/\$[\w.]+/g, '_')),
                path: success.path,
              },
            }),
    })),
    updates: prototype.updates ?? [],
    ...(store === undefined ? {} : { store }),
  }
}

/**
 * A JSON text a `<script>` can hold, whatever a seeded value or a config text
 * says: no `<` at all (so neither `</script` nor `<!--` changes how the
 * script is read) and no `{{` (the canvas's template holes). Both only ever
 * occur inside a string, where the escape reads back as the same character.
 */
const scriptJson = (value: unknown): string =>
  JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('{{', '{\\u007b')

/**
 * The value a board's component gives the canvas's template, so a drawn
 * attribute holding `{{` stays as written: there it is written as the hole
 * `{{$braces}}`, which every board fills with `{{` (the script spells it
 * `{\u007b`, holding no `{{` itself).
 */
export const LITERAL_BRACES_HOLE = '{{$braces}}'
export const BOARD_RENDER_VALUES = "    return { $braces: '{\\u007b' };"

/**
 * The script of a clickable board: the canvas's component, which plays the
 * board once it is drawn.
 *
 * @param catalog - every board of the canvas.
 * @param board - the board's own file and page.
 * @param prototype - its grids, forms and buttons.
 * @param store - the stateful prototype's store and the script building it, on the Prototype board only.
 */
export const prototypeScriptOf = (
  catalog: PrototypeCatalog,
  board: { readonly file: string; readonly page: string },
  prototype: BoardPrototype,
  store?: { readonly spec: unknown; readonly runtime: string }
): readonly string[] => [
  'class Component extends DCLogic {',
  '  renderVals() {',
  BOARD_RENDER_VALUES,
  '  }',
  '  componentDidMount() {',
  `    (${PROTOTYPE_RUNTIME})(${scriptJson(resolvedConfigOf(catalog, board, prototype, store?.spec))}, document, this.props, ${store?.runtime ?? 'null'});`,
  '  }',
  '}',
]
