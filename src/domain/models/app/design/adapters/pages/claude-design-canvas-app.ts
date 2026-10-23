/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The stateful prototype (`--prototype=app`): one more board of the canvas,
 * the Prototype board, holding every page of the app as a view over ONE store
 * held in memory and seeded from the rows the export drew. A record created
 * on one view is listed on another, a record updated on its view reads the
 * new value everywhere, a delete is offered only to a role the table lets
 * delete, and Reset returns every view to the seed. The role the board is
 * played as is a Tweak of the board (its `role` prop).
 *
 * The page boards stay as `--prototype` draws them; the Prototype board is
 * never read back as a page. Nothing leaves the board, and the store holds no
 * secret: its rows are the drawn rows, a write-only value already drawn as its
 * specimen. A form that only starts an automation is answered with its
 * message and changes no row: the prototype runs no automation.
 *
 * A routed record page's view is drawn once with each field of its record as
 * a placeholder (`⟦field⟧`), which the store fills in with the record a link
 * opens it at.
 */

import { parseHtmlElementTree } from '@/domain/kernel/sanitize/html-element-tree'
import {
  boardPolicyOf,
  drawnNode,
  escapeText,
  imageOriginsOf,
  nodesById,
  serializeBoardNodes,
} from './claude-design-canvas-draw'
import {
  prototypeScriptOf,
  type BoardPrototype,
  type PrototypeCatalog,
} from './claude-design-canvas-prototype'
import type { CanvasLinkRoute } from './claude-design-canvas-links'
import type { CanvasBundle } from './claude-design-canvas-mount'
import type { PageDesignTree } from '@/domain/models/api/admin/design-system/page-design-tree'

/** The canvas folder and file of the Prototype board. */
export const PROTOTYPE_BOARD_FILE = 'sovrium-prototype/Prototype.dc.html'

/** The attribute the Prototype board's root carries, which the page import passes over. */
export const PROTOTYPE_BOARD_ATTRIBUTE = 'data-sovrium-prototype'

/** The id a record view is drawn at, and the placeholder of each field it shows. */
export const RECORD_VIEW_ID = 'dcrecord'
export const recordPlaceholderOf = (field: string): string => `⟦${field}⟧`

/** One page of the app, as a view of the Prototype board. */
export interface PrototypeView {
  readonly page: string
  readonly path: string
  /** The table a routed record page reads, and the route parameter naming its record. */
  readonly table?: string | undefined
  readonly param?: string | undefined
}

/** What the store starts from and judges by. */
export interface PrototypeStore {
  /** Each seeded table's rows. */
  readonly tables: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>
  /** Each table's create, update and delete rules, as the config writes them. */
  readonly permissions: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** The account each role is played as, for `$currentUser`. */
  readonly viewers: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly views: readonly PrototypeView[]
}

/**
 * The store, as the board's script builds it: a function of the store's
 * starting point, the document and the board's props, answering the runtime
 * (`claude-design-canvas-prototype-runtime.ts`). Held in a `<script>`, so it
 * holds no `</script` and no `{{`.
 */
export const STORE_RUNTIME = String.raw`function (spec, doc, props) {
  'use strict'
  var seed = JSON.stringify(spec.tables || {})
  var tables = JSON.parse(seed)
  var role = props.role || 'admin'
  var viewer = (spec.viewers || {})[role] || {}
  var listeners = []
  var views = []
  var current = { view: null, record: null }
  var rebind = function () {}
  var lower = function (value) { return String(value === undefined || value === null ? '' : value).toLowerCase() }
  var asViewer = function (value) {
    return typeof value === 'string'
      ? value.replace(/\$currentUser\.(\w+)/g, function (match, field) { return viewer[field] === undefined ? '' : String(viewer[field]) })
      : value
  }
  var escape = function (value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
  var segments = function (path) { return String(path).split(/[?#]/)[0].split('/').filter(function (part) { return part !== '' }) }
  var matchOf = function (pattern, path) {
    var wanted = segments(pattern)
    var given = segments(path)
    if (wanted.length !== given.length) return null
    var values = {}
    for (var at = 0; at < wanted.length; at += 1) {
      if (wanted[at].charAt(0) === ':') values[wanted[at].slice(1)] = decodeURIComponent(given[at])
      else if (wanted[at] !== given[at]) return null
    }
    return values
  }
  var renderRecord = function (view) {
    var record = (tables[view.spec.table] || []).find(function (row) { return String(row.id) === String(current.record) }) || {}
    view.node.innerHTML = view.template.replace(/⟦(\w+)⟧/g, function (match, field) { return escape(record[field]) })
    rebind(view.node)
  }
  var changed = function () {
    listeners.forEach(function (listen) { listen() })
    if (current.view && current.view.spec.table) renderRecord(current.view)
  }
  var store = {
    rows: function (table) { return tables[table] ? tables[table].slice() : null },
    matches: function (row, condition) {
      var value = row[condition.field]
      var expected = asViewer(condition.value)
      switch (condition.operator) {
        case 'eq': return lower(value) === lower(expected)
        case 'neq': return lower(value) !== lower(expected)
        case 'contains': return lower(value).indexOf(lower(expected)) >= 0
        case 'in': return Array.isArray(expected) && expected.some(function (item) { return lower(item) === lower(value) })
        case 'isEmpty': return lower(value) === ''
        case 'isNotEmpty': return lower(value) !== ''
        default: return true
      }
    },
    // A filled address is followed only when it is the app's own (a path or
    // a query): a value typed in Play never makes it a script or another site.
    hrefOf: function (template, record) {
      var filled = String(template).replace(/\$record\.(\w+)/g, function (match, field) {
        return record && record[field] !== undefined && record[field] !== null ? String(record[field]) : ''
      })
      return /^[/?]/.test(filled) ? filled : null
    },
    may: function (action) {
      var rule = ((spec.permissions || {})[action.table] || {})[action.operation]
      if (rule === undefined || rule === 'all' || rule === 'authenticated') return true
      return Array.isArray(rule) && rule.some(function (granted) { return granted === role })
    },
    create: function (table, values) {
      var rows = tables[table] || []
      var id = rows.reduce(function (top, row) { return Math.max(top, Number(row.id) || 0) }, 0) + 1
      var record = Object.assign({ id: id }, values)
      tables[table] = rows.concat([record])
      changed()
      return record
    },
    update: function (table, id, data) {
      tables[table] = (tables[table] || []).map(function (row) { return String(row.id) === String(id) ? Object.assign({}, row, data) : row })
      changed()
    },
    remove: function (table, id) {
      tables[table] = (tables[table] || []).filter(function (row) { return String(row.id) !== String(id) })
      changed()
    },
    recordId: function () { return current.record },
    listen: function (listen) { listeners.push(listen) },
    navigate: function (address) {
      if (String(address).charAt(0) === '?') return
      var found = null
      var values = null
      views.forEach(function (view) {
        var matched = found ? null : matchOf(view.spec.path, address)
        if (matched) { found = view; values = matched }
      })
      if (!found) return
      views.forEach(function (view) { if (view === found) view.node.removeAttribute('hidden'); else view.node.setAttribute('hidden', '') })
      current.view = found
      current.record = found.spec.table ? values[found.spec.param] : null
      if (found.spec.table) renderRecord(found)
      if (typeof window.scrollTo === 'function') window.scrollTo(0, 0)
    },
    mount: function (root, bind) {
      rebind = bind
      views = Array.prototype.map.call(root.querySelectorAll('[data-dc-view]'), function (node) {
        var page = node.getAttribute('data-dc-view')
        return { node: node, template: node.innerHTML, spec: (spec.views || []).find(function (view) { return view.page === page }) || { page: page, path: '/' } }
      })
      var reset = root.querySelector('[data-dc-reset]')
      if (reset) reset.addEventListener('click', function () { tables = JSON.parse(seed); changed() })
      var first = views.find(function (view) { return !view.spec.table })
      if (first) store.navigate(first.spec.path)
    },
  }
  return store
}`

/** One view of the Prototype board: its page, its drawing and what it plays. */
export interface PrototypeViewDrawing {
  readonly view: PrototypeView
  readonly tree: PageDesignTree
  /** The page as drawn, a record view's record fields as placeholders. */
  readonly body: string
  readonly prototype?: BoardPrototype | undefined
}

/** What the Prototype board is drawn from. */
export interface PrototypeBoardInput {
  readonly appName: string
  readonly routes: readonly CanvasLinkRoute[]
  readonly bundle?: CanvasBundle | undefined
  /** The bundle script the board loads, relative to it, when the canvas installs one. */
  readonly bundleScript?: string | undefined
  readonly views: readonly PrototypeViewDrawing[]
  readonly store: PrototypeStore
  /** Every role the board may be played as, its `role` Tweak. */
  readonly roles: readonly string[]
  readonly catalog: PrototypeCatalog
  readonly width: number
  readonly height: number
}

/** One view drawn for the board: links naming their target, every node stamped. */
const viewOf = (input: PrototypeBoardInput, drawing: PrototypeViewDrawing, shown: boolean) => {
  const parsed = parseHtmlElementTree(drawing.body)
  const context = {
    byId: nodesById(drawing.tree.nodes),
    links: { routes: input.routes, page: drawing.view.page },
    bundle: input.bundle,
  }
  const body = parsed.ok ? parsed.nodes.flatMap((node) => drawnNode(context, node)) : []
  return `<div data-dc-view="${escapeText(drawing.view.page)}"${shown ? '' : ' hidden'}>${serializeBoardNodes(body)}</div>`
}

/** The board's bar: a link to each page a reader can open without a record, and Reset. */
const toolbarOf = (views: readonly PrototypeViewDrawing[]): string =>
  [
    '<nav aria-label="Pages" class="flex flex-wrap items-center gap-3 border-b p-3 text-sm">',
    ...views
      .filter((drawing) => drawing.view.table === undefined)
      .map(
        (drawing) =>
          `<a href="#" data-sovrium-href="${escapeText(drawing.view.path)}">${escapeText(drawing.view.page)}</a>`
      ),
    '<button type="button" data-dc-reset="" class="ml-auto rounded-md border px-3 py-1">Reset</button>',
    '</nav>',
  ].join('')

/** Everything every view plays, gathered for the one script of the board. */
const playedOf = (views: readonly PrototypeViewDrawing[]): BoardPrototype => ({
  tables: views.flatMap((drawing) => drawing.prototype?.tables ?? []),
  forms: views.flatMap((drawing) => drawing.prototype?.forms ?? []),
  updates: views.flatMap((drawing) => drawing.prototype?.updates ?? []),
})

/**
 * The Prototype board: every view, the first page a reader can open without a
 * record shown, over one store, the role it is played as a Tweak.
 *
 * @param input - the views, the store and where the board sits.
 */
export const prototypeBoardOf = (input: PrototypeBoardInput): string => {
  const first = input.views.findIndex((drawing) => drawing.view.table === undefined)
  const views = input.views.map((drawing, at) => viewOf(input, drawing, at === first)).join('')
  const props = JSON.stringify({
    $preview: { width: input.width, height: input.height },
    role: { editor: 'enum', options: input.roles, default: 'admin' },
  })
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${boardPolicyOf(imageOriginsOf(views))}">`,
    `<title>${escapeText(`Prototype · ${input.appName}`)}</title>`,
    '<script src="./support.js"></script>',
    ...(input.bundleScript === undefined ? [] : [`<script src="${input.bundleScript}"></script>`]),
    '<link rel="stylesheet" href="../pages.css">',
    '</head>',
    '<body>',
    '<x-dc>',
    '<helmet>',
    '<style>',
    'body{margin:0}',
    '</style>',
    '</helmet>',
    `<div ${PROTOTYPE_BOARD_ATTRIBUTE}="" class="bg-background text-foreground">${toolbarOf(input.views)}<main>${views}</main></div>`,
    '</x-dc>',
    `<script type="text/x-dc" data-dc-script data-props='${props}'>`,
    ...prototypeScriptOf(
      input.catalog,
      { file: PROTOTYPE_BOARD_FILE, page: '' },
      playedOf(input.views),
      { spec: input.store, runtime: STORE_RUNTIME }
    ),
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
