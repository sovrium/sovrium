/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const COMMAND_PALETTE_RUNTIME_DOM = `
  // Build the command-palette overlay (centered modal: search input + results
  // container) once and append it to <body>. Cached after first construction.
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.setAttribute('data-command-palette', 'true');
    overlay.setAttribute('data-testid', 'palette-backdrop');
    overlay.setAttribute('data-open', 'false');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Command palette');
    overlay.style.display = 'none';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '1000';
    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'center';
    overlay.style.paddingTop = '12vh';
    overlay.style.background = 'rgba(0,0,0,0.4)';

    var panel = document.createElement('div');
    panel.style.width = '100%';
    panel.style.maxWidth = '36rem';
    panel.style.background = '#ffffff';
    panel.style.borderRadius = '0.5rem';
    panel.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';
    panel.style.overflow = 'hidden';

    input = document.createElement('input');
    input.setAttribute('data-command-palette-input', 'true');
    input.setAttribute('type', 'search');
    input.setAttribute('role', 'searchbox');
    input.setAttribute('aria-label', 'Search');
    input.setAttribute('placeholder', 'Search\\u2026');
    input.style.width = '100%';
    input.style.padding = '0.75rem 1rem';
    input.style.border = 'none';
    input.style.borderBottom = '1px solid #e5e7eb';
    input.style.fontSize = '1rem';
    input.style.outline = 'none';

    results = document.createElement('div');
    results.setAttribute('data-command-palette-results', 'true');
    results.style.maxHeight = '24rem';
    results.style.overflowY = 'auto';
    results.style.padding = '0.5rem';

    panel.appendChild(input);
    panel.appendChild(results);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    input.addEventListener('input', function () {
      if (debounceHandle !== null) clearTimeout(debounceHandle);
      debounceHandle = setTimeout(refresh, 200);
    });
    // Clicking the dim backdrop (the overlay itself, outside the dialog
    // panel) closes the palette without performing any action.
    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) closePalette();
    });
  }

  function closeCreateDialog(dialog) {
    dialog.setAttribute('data-open', 'false');
    dialog.style.display = 'none';
  }

  // Look up a table's text fields from the JSON config.
  function tableFields(tableName) {
    for (var t = 0; t < config.tables.length; t++) {
      var table = config.tables[t];
      if (table && table.name === tableName && Array.isArray(table.fields)) {
        return table.fields;
      }
    }
    return [];
  }

  // Build the per-table record-creation dialog DOM on demand. The dialog is
  // NOT pre-rendered server-side so its labelled \`<input>\`s cannot collide
  // with a real \`form\` component's fields (an SSR \`<label>product</label>\`
  // would otherwise make \`getByLabel(/product/i)\` ambiguous). One dialog per
  // table is cached after first construction.
  function buildCreateDialog(tableName) {
    var dialog = document.createElement('div');
    dialog.setAttribute('data-create-record-dialog', tableName);
    dialog.setAttribute('data-open', 'false');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'New ' + tableName + ' record');
    dialog.style.display = 'none';
    dialog.style.position = 'fixed';
    dialog.style.inset = '0';
    dialog.style.zIndex = '1001';
    dialog.style.alignItems = 'flex-start';
    dialog.style.justifyContent = 'center';
    dialog.style.paddingTop = '12vh';
    dialog.style.background = 'rgba(0,0,0,0.4)';

    var panel = document.createElement('div');
    panel.style.width = '100%';
    panel.style.maxWidth = '32rem';
    panel.style.background = '#ffffff';
    panel.style.borderRadius = '0.5rem';
    panel.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';
    panel.style.padding = '1.25rem';

    var heading = document.createElement('h2');
    heading.textContent = 'New ' + tableName + ' record';
    panel.appendChild(heading);

    var form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', '/api/tables/' + tableName + '/records');

    var fields = tableFields(tableName);
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      if (!field || typeof field.name !== 'string') continue;
      var row = document.createElement('div');
      var inputId = 'create-' + tableName + '-' + field.name;
      var label = document.createElement('label');
      label.setAttribute('for', inputId);
      label.textContent = field.name;
      var control = document.createElement('input');
      control.setAttribute('id', inputId);
      control.setAttribute('name', field.name);
      control.setAttribute('type', 'text');
      row.appendChild(label);
      row.appendChild(control);
      form.appendChild(row);
    }

    var actions = document.createElement('div');
    var submit = document.createElement('button');
    submit.setAttribute('type', 'submit');
    submit.textContent = 'Create';
    var cancel = document.createElement('button');
    cancel.setAttribute('type', 'button');
    cancel.setAttribute('data-create-record-close', 'true');
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () { closeCreateDialog(dialog); });
    actions.appendChild(submit);
    actions.appendChild(cancel);
    form.appendChild(actions);

    panel.appendChild(form);
    dialog.appendChild(panel);
    dialog.addEventListener('mousedown', function (event) {
      if (event.target === dialog) closeCreateDialog(dialog);
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openCreateDialog(tableName) {
    var dialog = document.querySelector('[data-create-record-dialog="' + tableName + '"]');
    if (!dialog) dialog = buildCreateDialog(tableName);
    dialog.setAttribute('data-open', 'true');
    // See \`openPalette\` — clear any \`hidden\` a global modal handler may set.
    dialog.removeAttribute('hidden');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.style.display = 'flex';
  }
`
