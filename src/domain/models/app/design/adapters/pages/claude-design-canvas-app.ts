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
 * played as is a Tweak of the board (its `role` prop), and so is the language
 * an app with several is played in (its `language` prop): every view is drawn
 * in the default language, and its texts read as the played language writes
 * them. An address opening with a language segment plays in that language.
 *
 * The page boards stay as `--prototype` draws them; the Prototype board is
 * never read back as a page. Nothing leaves the board, and the store holds no
 * secret: its rows are the drawn rows, a write-only value already drawn as its
 * specimen. A form that only starts an automation is answered with its
 * message and changes no row, and a button starting one shows its pending
 * label and its success: the prototype runs no automation. A sign-in form
 * succeeds as the role the board is played as and keeps nothing typed.
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
  withScopedIds,
} from './claude-design-canvas-draw'
import {
  prototypeScriptOf,
  type BoardPrototype,
  type PrototypeCatalog,
} from './claude-design-canvas-prototype'
import type { CanvasLinkRoute } from './claude-design-canvas-links'
import type { CanvasBundle } from './claude-design-canvas-mount'
import type { PageDesignTree } from '@/domain/models/api/admin/design-system/page-design-tree'
import type { RowLevelFilterNode } from '@/domain/models/app/tables/row-level-evaluator-service'

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
  /** The field the route parameter is matched against; absent, the record's `id`. */
  readonly key?: string | undefined
  /** The `visibility` rule of each node of the page that has one, by node id. */
  readonly visibility?: Readonly<Record<string, unknown>> | undefined
  /** The default value of each query parameter the page declares. */
  readonly query?: Readonly<Record<string, string>> | undefined
}

/**
 * What a role may read of one table: no row (`'none'`), or the rows its row
 * rule admits, resolved for the account it is played as (`'all'` without one),
 * less the fields it may not read.
 */
export interface PrototypeRead {
  readonly rows: 'all' | 'none' | RowLevelFilterNode
  readonly hidden: readonly string[]
}

/** What the store starts from and judges by. */
export interface PrototypeStore {
  /** Each seeded table's rows. */
  readonly tables: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>
  /**
   * The fields of each seeded row that a page writes differently from what is
   * stored (a date, a checkbox, an option), by table, row id and field: the
   * stored value and its text. A value changed in play reads as stored.
   */
  readonly texts?:
    | Readonly<
        Record<
          string,
          Readonly<Record<string, Readonly<Record<string, readonly [string, string]>>>>
        >
      >
    | undefined
  /**
   * For each role, whether it may create, update and delete in each table, as
   * the app's write gates answer it; absent when the app gates no write.
   */
  readonly writes?:
    | Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, boolean>>>>>>
    | undefined
  /** For each role, what it may read of each table it is narrowed on; a table absent is read whole. */
  readonly reads?: Readonly<Record<string, Readonly<Record<string, PrototypeRead>>>> | undefined
  /** The account each role is played as, for `$currentUser`. */
  readonly viewers: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly views: readonly PrototypeView[]
  /** The languages the board may be played in, its `language` Tweak; absent for an app with one. */
  readonly language?: PrototypeLanguage | undefined
  /** The address each role's sign-in leads to, its `defaultLanding`. */
  readonly landings?: Readonly<Record<string, string>> | undefined
}

/** The languages a board is played in, and how each writes the default language's texts. */
export interface PrototypeLanguage {
  readonly codes: readonly string[]
  readonly default: string
  /** For each other language, each text of the default language as that language writes it. */
  readonly texts: Readonly<Record<string, Readonly<Record<string, string>>>>
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
  var current = { view: null, record: null, id: undefined, query: {} }
  var rebind = function () {}
  // The language the board is played in: its Tweak, else the app's default; a
  // drawn text of the default language reads as that language writes it.
  var language = spec.language || null
  var lang = language ? (language.codes.indexOf(props.language) >= 0 ? props.language : language['default']) : null
  var originals = new WeakMap()
  var textOf = function (text) {
    var texts = language && lang !== language['default'] ? language.texts[lang] || {} : {}
    var trimmed = String(text).trim()
    if (trimmed === '' || !Object.prototype.hasOwnProperty.call(texts, trimmed)) return String(text)
    return String(text).replace(trimmed, function () { return texts[trimmed] })
  }
  var translate = function (scope) {
    if (!language) return
    var walker = doc.createTreeWalker(scope, 4)
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!originals.has(node)) originals.set(node, node.data)
      var shown = textOf(originals.get(node))
      if (node.data !== shown) node.data = shown
    }
  }
  // An address opening with a supported language code: its path without it.
  var withoutLanguage = function (address) {
    var first = segments(address)[0]
    if (!language || language.codes.indexOf(first) < 0) return null
    return { language: first, address: String(address).slice(first.length + 1) || '/' }
  }
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
  // An address's query, each parameter by name.
  var queryOf = function (address) {
    var query = Object.create(null)
    var text = String(address).split('#')[0].split('?')[1] || ''
    text.split('&').forEach(function (pair) {
      if (pair === '') return
      var at = pair.indexOf('=')
      var name = decodeURIComponent(at < 0 ? pair : pair.slice(0, at))
      query[name] = at < 0 ? '' : decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' '))
    })
    return query
  }
  // A visibility rule, judged as the app judges it: its roles, its query
  // operators against the address's query (a parameter at its default when
  // absent), its record operators against the record the view draws.
  var isEmpty = function (value) {
    if (value === undefined || value === null || value === '') return true
    return typeof value === 'object' && Object.keys(value).length === 0
  }
  var holds = function (operators, value, skip) {
    var text = String(value)
    var number = Number(value)
    return Object.keys(operators).every(function (operator) {
      var expected = operators[operator]
      if (operator === skip || expected === undefined) return true
      switch (operator) {
        case 'isEmpty': return expected === true && isEmpty(value)
        case 'isNotEmpty': return expected === true && !isEmpty(value)
        case 'eq': return text === String(expected)
        case 'neq': return text !== String(expected)
        case 'in': return Array.isArray(expected) && expected.some(function (entry) { return String(entry) === text })
        case 'notIn': return Array.isArray(expected) && !expected.some(function (entry) { return String(entry) === text })
        case 'contains': return text.indexOf(String(expected)) >= 0
        case 'gt': return !isNaN(number) && number > Number(expected)
        case 'lt': return !isNaN(number) && number < Number(expected)
        case 'gte': return !isNaN(number) && number >= Number(expected)
        case 'lte': return !isNaN(number) && number <= Number(expected)
        default: return false
      }
    })
  }
  var shows = function (view, record) {
    var query = Object.assign({}, view.spec.query || {}, current.query)
    return function (rule) {
      if (!rule || typeof rule !== 'object') return true
      if (Array.isArray(rule.roles) && rule.roles.indexOf(role) < 0) return false
      if (rule.query && !holds(rule.query, query[rule.query.name], 'name')) return false
      return !(rule.record && record && !holds(rule.record, record[rule.record.field], 'field'))
    }
  }
  // A record view drops each part its rules hide; any other view hides it, as
  // its drawing is kept across addresses.
  var judge = function (view, record) {
    var rules = view.spec.visibility || {}
    var shown = shows(view, record)
    Array.prototype.forEach.call(view.node.querySelectorAll('[data-sovrium-id]'), function (node) {
      var id = node.getAttribute('data-sovrium-id')
      if (!Object.prototype.hasOwnProperty.call(rules, id)) return
      var keep = shown(rules[id])
      if (record) { if (!keep) node.remove(); return }
      if (keep && node.hasAttribute('data-dc-unshown')) { node.removeAttribute('data-dc-unshown'); node.removeAttribute('hidden') }
      if (!keep && !node.hasAttribute('hidden')) { node.setAttribute('data-dc-unshown', ''); node.setAttribute('hidden', '') }
    })
  }
  // A field as the page writes it: its text while its value is the one seeded.
  var shownOf = function (table, record, field) {
    var stored = record[field] === undefined || record[field] === null ? '' : String(record[field])
    var written = (((spec.texts || {})[table] || {})[String(record.id)] || {})[field]
    return written && written[0] === stored ? written[1] : stored
  }
  // The view is drawn at its own id: wherever the drawing names it (an
  // address, a field the route matches) it names the record opened. A
  // placeholder in an attribute is the stored value; in a text, as written.
  var renderRecord = function (view) {
    var key = view.spec.key || 'id'
    var record = readable(view.spec.table).find(function (row) { return String(row[key]) === String(current.record) }) || {}
    current.id = record.id === undefined ? current.record : record.id
    view.node.innerHTML = view.template
      .replace(/([\w:-]+)="([^"]*)"/g, function (attribute, name, value) {
        return name + '="' + value.replace(/⟦(\w+)⟧/g, function (match, field) {
          var stored = record[field] === undefined || record[field] === null ? '' : String(record[field])
          return escape(name === 'data-island-props' ? JSON.stringify(stored).slice(1, -1) : stored)
        }) + '"'
      })
      .replace(/⟦(\w+)⟧/g, function (match, field) { return escape(shownOf(view.spec.table, record, field)) })
      .split('${RECORD_VIEW_ID}').join(escape(current.record))
    judge(view, record)
    rebind(view.node)
    translate(view.node)
  }
  var changed = function () {
    listeners.forEach(function (listen) { listen() })
    if (current.view && current.view.spec.table) renderRecord(current.view)
  }
  // What the role may read: a row its rule admits, compared as the records
  // API compares it (an empty value admits nothing), less its hidden fields.
  var reads = (spec.reads || {})[role] || {}
  var same = function (stored, wanted) {
    if (stored === wanted) return true
    if (wanted === undefined || wanted === null || typeof stored === typeof wanted) return false
    if (typeof stored === 'number' && typeof wanted === 'string') return wanted.trim() !== '' && Number(wanted) === stored
    return String(stored) === String(wanted)
  }
  var admits = function (row, rule) {
    if (rule.and) return rule.and.every(function (part) { return admits(row, part) })
    if (rule.or) return rule.or.some(function (part) { return admits(row, part) })
    var stored = row[rule.field]
    if (stored === undefined || stored === null) return false
    if (rule.operator === 'equals') return same(stored, rule.value)
    if (rule.operator === 'notEquals') return !same(stored, rule.value)
    if (rule.operator === 'in') return [].concat(rule.value).some(function (wanted) { return same(stored, wanted) })
    return false
  }
  var readable = function (table) {
    var read = reads[table]
    var rows = tables[table] || []
    if (!read) return rows.slice()
    if (read.rows === 'none') return []
    return rows
      .filter(function (row) { return read.rows === 'all' || admits(row, read.rows) })
      .map(function (row) {
        var shown = Object.assign({}, row)
        read.hidden.forEach(function (field) { delete shown[field] })
        return shown
      })
  }
  var store = {
    // A table the store holds no row of plays its drawn rows, unless the role reads none.
    rows: function (table) { return tables[table] ? readable(table) : reads[table] && reads[table].rows === 'none' ? [] : null },
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
    // As the app's write gates answered it for the role; a role or table it
    // did not answer for writes nothing.
    may: function (action) {
      if (!spec.writes) return true
      var granted = (spec.writes[role] || {})[action.table] || {}
      return granted[action.operation] === true
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
    recordId: function () { return current.id === undefined ? current.record : current.id },
    text: textOf,
    // A sign-in succeeds as the role the board is played as: its landing page.
    landing: function (fallback) { return (spec.landings || {})[role] || fallback },
    listen: function (listen) { listeners.push(listen) },
    navigate: function (address) {
      if (String(address).charAt(0) === '?') {
        if (!current.view) return
        current.query = queryOf(address)
        if (current.view.spec.table) renderRecord(current.view)
        else judge(current.view, null)
        return
      }
      var found = null
      var values = null
      var find = function (path) {
        views.forEach(function (view) {
          var matched = found ? null : matchOf(view.spec.path, path)
          if (matched) { found = view; values = matched }
        })
      }
      find(address)
      var localized = found ? null : withoutLanguage(address)
      if (localized) find(localized.address)
      if (!found) return
      if (localized) lang = localized.language
      views.forEach(function (view) { if (view === found) view.node.removeAttribute('hidden'); else view.node.setAttribute('hidden', '') })
      current.view = found
      current.query = queryOf(address)
      current.record = found.spec.table ? values[found.spec.param] : null
      if (found.spec.table) renderRecord(found)
      else judge(found, null)
      translate(found.node)
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
    links: {
      routes: input.routes,
      page: drawing.view.page,
      languages: input.store.language?.codes,
    },
    bundle: input.bundle,
  }
  const drawn = parsed.ok ? parsed.nodes.flatMap((node) => drawnNode(context, node)) : []
  // Two views may draw a control for the same field: each view's ids are its own.
  const body = input.views.length > 1 ? withScopedIds(drawn, drawing.view.page) : drawn
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
    ...(input.store.language === undefined
      ? {}
      : {
          language: {
            editor: 'enum',
            options: input.store.language.codes,
            default: input.store.language.default,
          },
        }),
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
