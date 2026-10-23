/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MOUNTED_NODE } from './claude-design-canvas-mount'

/**
 * The script a clickable Claude Design board runs in Play (`--prototype`):
 * what Sovrium's own islands do on a served page, done over the drawn markup
 * and nothing else. It reaches no network and no storage, and holds no value
 * the drawing does not already show.
 *
 * It is the body of the board's `componentDidMount`, called with the board's
 * prototype configuration (`claude-design-canvas-prototype.ts`) and the
 * document, and works by delegation on the document, so a canvas that draws
 * the board again keeps every control working:
 *
 * - a folded sidebar opens from its menu button into a modal panel;
 * - a dropdown menu opens its items, a dialog opens from its opener and
 *   closes, the theme toggle switches the board between light and dark;
 * - a grid pages, sorts, searches and opens a row menu over the drawn rows,
 *   and a row leads to the board of its record;
 * - a form validates as the app declares (required fields and email
 *   addresses, on blur and on submit), moves between its steps, holds its
 *   submit button while it submits, then shows its success message in place or
 *   leads to the board of the page it redirects to.
 *
 * With a store (`--prototype=app`), a grid draws the store's rows and a form,
 * a stop button or a row's delete writes to it (`claude-design-canvas-app.ts`).
 *
 * Written as an ES2017 function expression, holding no `</script` and no
 * `{{`, so it sits verbatim inside a board's `<script>` beside the canvas's
 * own template holes.
 */
export const PROTOTYPE_RUNTIME = String.raw`function (config, doc, props, makeStore) {
  'use strict'
  var root = doc.querySelector('[data-sovrium-page], [data-sovrium-prototype]') || doc.body
  var store = config.store && makeStore ? makeStore(config.store, doc, props || {}) : null
  var MESSAGES = { required: 'This field is required.', email: 'Enter a valid email address.' }
  // An app address plays on the board in a store; any other is a board of the canvas.
  var go = function (href) {
    if (!href) return
    if (store && /^[/?]/.test(href)) return store.navigate(href)
    window.location.href = href
  }
  var text = function (node) { return (node && node.textContent ? node.textContent : '').trim() }
  var el = function (tag, attrs, children) {
    var node = doc.createElement(tag)
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]) })
    ;(children || []).forEach(function (child) {
      node.append(typeof child === 'string' ? doc.createTextNode(child) : child)
    })
    return node
  }
  var closeOnEscape = []
  doc.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return
    closeOnEscape.slice().forEach(function (close) { close() })
  })

  // A menu of items, opened under its trigger.
  var openMenu = function (anchor, items, onClose) {
    var menu = el('div', { role: 'menu', class: 'absolute z-50 mt-1 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md' }, [])
    items.forEach(function (item) {
      var entry = el('button', { type: 'button', role: 'menuitem', class: 'flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent' }, [item.label])
      entry.addEventListener('click', function (event) { event.stopPropagation(); close(); if (item.run) item.run() })
      menu.append(entry)
    })
    var close = function () {
      menu.remove()
      anchor.setAttribute('aria-expanded', 'false')
      closeOnEscape = closeOnEscape.filter(function (other) { return other !== close })
      if (onClose) onClose()
    }
    anchor.setAttribute('aria-expanded', 'true')
    anchor.insertAdjacentElement('afterend', menu)
    closeOnEscape.push(close)
    return close
  }
  // The theme toggle: the board between light and dark.
  doc.addEventListener('click', function (event) {
    var toggle = event.target.closest && event.target.closest('[data-theme-toggle]')
    if (toggle) root.classList.toggle('dark')
  })

  // A grid over its drawn rows, or over the store's.
  var rowsOfStore = function (grid) {
    if (!store || !grid.table) return null
    var rows = store.rows(grid.table)
    if (!rows) return null
    return rows.filter(function (row) { return grid.filter.every(function (condition) { return store.matches(row, condition) }) })
  }
  ;(config.tables || []).forEach(function (grid) {
    var table = doc.querySelector('[data-sovrium-id="' + grid.id + '"]')
    if (!table) return
    var body = table.querySelector('tbody')
    var head = table.querySelector('thead tr')
    if (!body) { body = el('tbody', {}, []); table.append(body) }
    var template = body.querySelector('tr')
    var cellClass = template && template.firstElementChild ? template.firstElementChild.getAttribute('class') || '' : ''
    var rowClass = template ? template.getAttribute('class') || '' : ''
    var drawn = Array.prototype.slice.call(body.querySelectorAll('tr')).map(function (row, at) {
      return { node: row, href: grid.rowHrefs[at] || null, record: null }
    })
    var build = function (record) {
      var row = el('tr', { class: rowClass }, grid.columns.map(function (field) {
        return el('td', { class: cellClass }, [record[field] === undefined || record[field] === null ? '' : String(record[field])])
      }))
      return { node: row, href: grid.recordHref ? store.hrefOf(grid.recordHref, record) : null, record: record }
    }
    var state = { page: 1, sort: null, query: '' }
    var menuCell = function (entry) {
      var actions = (grid.actions || []).filter(function (action) { return !store || store.may(action) })
      if (!grid.rowMenu || actions.length === 0) return null
      var button = el('button', { type: 'button', 'aria-label': 'Open menu', class: 'rounded-md px-2 text-sm' }, ['...'])
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        openMenu(button, actions.map(function (action) {
          return { label: action.label, run: function () { if (store && entry.record) store.remove(action.table, entry.record.id) } }
        }))
      })
      return el('td', { class: cellClass }, [button])
    }
    if (head && grid.rowMenu) head.append(el('th', { class: head.firstElementChild ? head.firstElementChild.getAttribute('class') || '' : '' }, ['']))
    var pager = null
    var render = function () {
      var source = rowsOfStore(grid)
      var entries = source ? source.map(build) : drawn
      var query = state.query.toLowerCase()
      var kept = entries.filter(function (entry) { return query === '' || entry.node.textContent.toLowerCase().indexOf(query) >= 0 })
      if (state.sort) {
        var at = state.sort.column
        var sign = state.sort.direction === 'asc' ? 1 : -1
        kept = kept.slice().sort(function (a, b) {
          return sign * text(a.node.children[at]).localeCompare(text(b.node.children[at]), undefined, { numeric: true })
        })
      }
      var size = grid.pageSize || kept.length || 1
      var pages = Math.max(1, Math.ceil(kept.length / size))
      if (state.page > pages) state.page = pages
      var shown = kept.slice((state.page - 1) * size, state.page * size)
      shown.forEach(function (entry) {
        if (grid.rowMenu && !entry.node.hasAttribute('data-dc-menu')) {
          var cell = menuCell(entry)
          if (cell) entry.node.append(cell)
          entry.node.setAttribute('data-dc-menu', '')
        }
        if (entry.href && !entry.node.hasAttribute('data-dc-href')) {
          entry.node.setAttribute('data-dc-href', entry.href)
          entry.node.style.cursor = 'pointer'
          entry.node.addEventListener('click', function () { go(entry.href) })
        }
      })
      body.replaceChildren.apply(body, shown.map(function (entry) { return entry.node }))
      if (pager) pager.update(pages)
    }
    if (grid.pageSize) {
      var previous = el('button', { type: 'button', class: 'rounded-md border px-3 py-1 text-sm' }, ['Previous'])
      var next = el('button', { type: 'button', class: 'rounded-md border px-3 py-1 text-sm' }, ['Next'])
      var label = el('span', { class: 'text-sm text-muted-foreground' }, [''])
      previous.addEventListener('click', function () { if (state.page > 1) { state.page -= 1; render() } })
      next.addEventListener('click', function () { state.page += 1; render() })
      var bar = el('div', { class: 'flex items-center justify-end gap-2 py-2', 'data-dc-pager': '' }, [label, previous, next])
      ;(table.parentElement || table).insertAdjacentElement('afterend', bar)
      pager = { update: function (pages) { label.textContent = 'Page ' + state.page + ' of ' + pages; previous.disabled = state.page <= 1; next.disabled = state.page >= pages } }
    }
    ;(grid.sortable || []).forEach(function (column) {
      var cell = head && head.children[column]
      if (!cell) return
      cell.style.cursor = 'pointer'
      cell.setAttribute('aria-sort', 'none')
      cell.addEventListener('click', function () {
        var direction = state.sort && state.sort.column === column && state.sort.direction === 'asc' ? 'desc' : 'asc'
        state.sort = { column: column, direction: direction }
        cell.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending')
        state.page = 1
        render()
      })
    })
    if (grid.searchBindTo) {
      Array.prototype.forEach.call(doc.querySelectorAll('[data-publishes-bind-to="' + grid.searchBindTo + '"]'), function (input) {
        input.addEventListener('input', function () { state.query = input.value; state.page = 1; render() })
      })
    }
    if (store) store.listen(render)
    render()
  })

  // Forms: validated as the app declares, submitted to their success.
  var messageOf = function (input) {
    if (input.required && input.value.trim() === '') return MESSAGES.required
    if (input.type === 'email' && input.value !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)) return MESSAGES.email
    return ''
  }
  var showError = function (input, message) {
    var id = 'dc-error-' + (input.id || input.name)
    var note = doc.getElementById(id)
    if (message === '') {
      input.removeAttribute('aria-invalid')
      input.removeAttribute('aria-describedby')
      if (note) note.remove()
      return true
    }
    input.setAttribute('aria-invalid', 'true')
    input.setAttribute('aria-describedby', id)
    if (!note) {
      note = el('p', { id: id, class: 'text-sm text-destructive' }, [])
      input.insertAdjacentElement('afterend', note)
    }
    note.textContent = message
    return false
  }
  var fieldsIn = function (scope) {
    return Array.prototype.filter.call(scope.querySelectorAll('input, textarea, select'), function (input) {
      return input.type !== 'hidden' && input.name !== '_hp' && !input.closest('[hidden]')
    })
  }
  var validate = function (scope) {
    return fieldsIn(scope).map(function (input) { return showError(input, messageOf(input)) }).every(Boolean)
  }
  // Every control of a part of the board: the board, or a record view a store draws again.
  var bind = function (scope) {
  // A folded sidebar: its body lifts into the panel and back.
  Array.prototype.forEach.call(scope.querySelectorAll('[data-sidebar-drawer-trigger]'), function (trigger) {
    var frame = trigger.parentElement
    var panel = frame && frame.querySelector('[data-sidebar-drawer-panel]')
    var body = frame && frame.querySelector('[data-sidebar-drawer-body]')
    var content = panel && panel.querySelector('[data-sidebar-drawer-content]')
    if (!panel || !body || !content) return
    trigger.removeAttribute('disabled')
    var close = function () {
      if (!panel.open) return
      body.append.apply(body, Array.prototype.slice.call(content.childNodes))
      panel.close()
      trigger.setAttribute('aria-expanded', 'false')
    }
    panel.addEventListener('close', close)
    var closer = panel.querySelector('[data-sidebar-drawer-close]')
    if (closer) closer.addEventListener('click', close)
    trigger.addEventListener('click', function () {
      content.append.apply(content, Array.prototype.slice.call(body.childNodes))
      if (typeof panel.showModal === 'function') panel.showModal()
      else panel.setAttribute('open', '')
      trigger.setAttribute('aria-expanded', 'true')
    })
  })

  Array.prototype.forEach.call(scope.querySelectorAll('[data-island="dropdown-menu"]'), function (host) {
    var trigger = host.querySelector('button')
    var props = {}
    try { props = JSON.parse(host.getAttribute('data-island-props') || '{}') } catch (error) { props = {} }
    if (!trigger) return
    trigger.removeAttribute('disabled')
    trigger.setAttribute('aria-haspopup', 'menu')
    var close = null
    trigger.addEventListener('click', function () {
      if (close) { close(); close = null; return }
      close = openMenu(trigger, (props.menuItems || []).map(function (item) { return { label: item.label } }), function () { close = null })
    })
  })

  // A dialog opened by its opener, closed by its close button or Escape.
  Array.prototype.forEach.call(scope.querySelectorAll('[data-click-modal]'), function (opener) {
    var id = opener.getAttribute('data-click-modal')
    var host = Array.prototype.find.call(scope.querySelectorAll('[data-island="dialog"]'), function (candidate) {
      try { return JSON.parse(candidate.getAttribute('data-island-props') || '{}').id === id } catch (error) { return false }
    })
    if (!host) return
    var props = JSON.parse(host.getAttribute('data-island-props') || '{}')
    var dialog = host.querySelector('[role="dialog"]')
    var hidden = host.querySelector('div[hidden]')
    if (!dialog) return
    var close = function () {
      host.style.display = 'none'
      closeOnEscape = closeOnEscape.filter(function (other) { return other !== close })
    }
    opener.addEventListener('click', function () {
      var closer = el('button', { type: 'button', class: 'mt-4 rounded-md border px-3 py-1.5 text-sm' }, [props.closeLabel || 'Close'])
      closer.addEventListener('click', close)
      dialog.replaceChildren.apply(dialog, [el('h2', { class: 'text-lg font-semibold' }, [props.title || ''])].concat(
        hidden ? Array.prototype.map.call(hidden.childNodes, function (node) { return node.cloneNode(true) }) : [],
        [closer]))
      host.style.display = 'block'
      closeOnEscape.push(close)
    })
  })

  ;(config.forms || []).forEach(function (spec) {
    var form = scope.querySelector('form[data-form-name="' + spec.name + '"]')
    if (!form) return
    form.setAttribute('novalidate', '')
    var sample = form.querySelector('input:not([type="hidden"])')
    var sampleLabel = form.querySelector('label')
    var steps = (spec.steps || []).map(function (step, at) {
      var drawn = form.querySelector('[data-step="' + step.id + '"]')
      if (drawn) return drawn
      var nav = el('div', { class: 'flex gap-2' }, [])
      var back = el('button', { type: 'button', 'data-dc-step': 'back', class: 'rounded-md border px-3 py-1.5 text-sm' }, ['Back'])
      nav.append(back)
      if (at < spec.steps.length - 1) nav.append(el('button', { type: 'button', 'data-dc-step': 'next', class: 'rounded-md border px-3 py-1.5 text-sm' }, ['Next']))
      var fields = step.fields.map(function (field) {
        var id = 'field-' + field.name
        var input = el('input', { id: id, name: field.name, type: field.type || 'text', class: sample ? sample.getAttribute('class') || '' : '' }, [])
        if (field.required) { input.required = true; input.setAttribute('aria-required', 'true') }
        return el('div', {}, [el('label', { for: id, class: sampleLabel ? sampleLabel.getAttribute('class') || '' : '' }, [field.label + (field.required ? ' *' : '')]), input])
      })
      var block = el('div', { 'data-step': step.id, 'data-step-index': String(at), class: 'flex flex-col gap-3.5', hidden: '' }, [el('h2', {}, [step.title || ''])].concat(fields, [nav]))
      var submit = form.querySelector('button[type="submit"]')
      form.insertBefore(block, submit)
      return block
    })
    var submit = form.querySelector('button[type="submit"]')
    var current = 0
    var show = function (at) {
      steps.forEach(function (step, index) { if (index === at) step.removeAttribute('hidden'); else step.setAttribute('hidden', '') })
      current = at
      if (submit) { if (at === steps.length - 1) submit.removeAttribute('hidden'); else submit.setAttribute('hidden', '') }
    }
    if (steps.length > 0) show(0)
    form.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('button')
      if (!button || button.type === 'submit') return
      var label = text(button).toLowerCase()
      var move = button.getAttribute('data-dc-step') || (label === 'next' ? 'next' : label === 'back' || label === 'previous' ? 'back' : '')
      if (move === 'next' && validate(steps[current] || form)) show(Math.min(current + 1, steps.length - 1))
      if (move === 'back') show(Math.max(current - 1, 0))
    })
    // A message is shown when a field is left, and taken away as it is typed
    // right, so the form never moves under a pointer about to press a button.
    form.addEventListener('focusout', function (event) {
      var input = event.target
      if (!input || !input.name || input.type === 'hidden' || input.value === '') return
      var message = messageOf(input)
      if (message !== '') showError(input, message)
    })
    form.addEventListener('input', function (event) {
      var input = event.target
      if (input && input.hasAttribute && input.hasAttribute('aria-invalid') && messageOf(input) === '') showError(input, '')
    })
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      if (!validate(form)) return
      var values = {}
      Array.prototype.forEach.call(form.querySelectorAll('input, textarea, select'), function (input) {
        if (input.name && input.name !== '_hp' && input.name !== '_idempotency') values[input.name] = input.value
      })
      var written = store && spec.writes ? store.create(spec.writes, values) : null
      if (spec.success && store && spec.success.path) return go(store.hrefOf(spec.success.path, written || {}))
      if (spec.success && spec.success.href) return go(spec.success.href)
      if (submit) submit.disabled = true
      setTimeout(function () {
        if (submit) submit.disabled = false
        var message = el('div', { role: 'status', class: 'rounded-md border p-4 text-sm' }, [spec.success && spec.success.message ? spec.success.message : 'Sent.'])
        form.insertAdjacentElement('beforebegin', message)
        form.setAttribute('hidden', '')
      }, 300)
    })
  })

  // A button that updates the record the board draws.
  ;(config.updates || []).forEach(function (update) {
    var button = scope.querySelector('[data-sovrium-id="' + update.id + '"], [${MOUNTED_NODE}="' + update.id + '"]')
    if (!button || !store) return
    var target = button.tagName === 'BUTTON' ? button : button.querySelector('button') || button
    target.addEventListener('click', function () { store.update(update.table, store.recordId(), update.data) })
  })
  }
  if (store) {
    doc.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[data-sovrium-href]')
      if (!link) return
      event.preventDefault()
      store.navigate(link.getAttribute('data-sovrium-href'))
    })
    store.mount(root, bind)
  }
  bind(doc)
}`
