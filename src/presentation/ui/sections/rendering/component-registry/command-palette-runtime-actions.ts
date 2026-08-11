/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The command palette's quick-action catalogue, spliced into
 * `COMMAND_PALETTE_RUNTIME`'s IIFE.
 *
 * A FRAGMENT, not a module: its `function`s are hoisted into the runtime's
 * shared closure alongside `COMMAND_PALETTE_RUNTIME_DOM` and
 * `COMMAND_PALETTE_RUNTIME_FETCH`, and it reads `config`, `results`,
 * `makeHeading` and `activate` from there.
 *
 * Split out to keep the runtime under the 400-line file cap once the palette's
 * network layer went async. It carves along a real boundary: everything here is
 * derived from the app's own `config` and needs NO network at all, which is why
 * quick actions can paint immediately while a search request is still in
 * flight — see `renderDefault`.
 */
export const COMMAND_PALETTE_RUNTIME_ACTIONS = `
  // Build a quick-action option element. \`action\` is one of:
  //   create-record:<table> | navigate | toggle-dark-mode
  function makeActionOption(label, action, href) {
    var li = document.createElement('div');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-label', label);
    li.setAttribute('data-command-action', action);
    if (typeof href === 'string' && href) li.setAttribute('data-href', href);
    var text = document.createElement('span');
    text.textContent = label;
    li.appendChild(text);
    li.addEventListener('click', function () { activate(li); });
    return li;
  }

  // The full quick-action catalogue, rebuilt on every render so it stays in
  // sync with the app's tables/pages config.
  function quickActions() {
    var actions = [];
    for (var t = 0; t < config.tables.length; t++) {
      var table = config.tables[t];
      if (table && typeof table.name === 'string') {
        actions.push({
          label: 'Create new record in ' + table.name,
          action: 'create-record:' + table.name,
        });
      }
    }
    for (var p = 0; p < config.pages.length; p++) {
      var page = config.pages[p];
      if (page && typeof page.path === 'string') {
        var title = typeof page.title === 'string' && page.title ? page.title : page.name;
        actions.push({ label: 'Go to ' + title, action: 'navigate', href: page.path });
      }
    }
    actions.push({ label: 'Toggle dark mode', action: 'toggle-dark-mode' });
    return actions;
  }

  // A quick action matches a query when every whitespace-separated token of
  // the query appears (case-insensitive substring) somewhere in its label.
  // This lets "new task" match "Create new record in tasks".
  function actionMatchesQuery(label, query) {
    var haystack = label.toLowerCase();
    var tokens = query.toLowerCase().split(/\\s+/);
    for (var t = 0; t < tokens.length; t++) {
      if (tokens[t].length > 0 && haystack.indexOf(tokens[t]) === -1) return false;
    }
    return true;
  }

  // Render a "Quick actions" section, filtered by \`query\` (empty = all).
  function renderQuickActions(query) {
    var needle = (query || '').trim();
    var actions = quickActions();
    var matched = [];
    for (var i = 0; i < actions.length; i++) {
      if (needle.length === 0 || actionMatchesQuery(actions[i].label, needle)) {
        matched.push(actions[i]);
      }
    }
    if (matched.length === 0) return;
    var section = document.createElement('section');
    section.setAttribute('data-command-palette-section', 'actions');
    section.appendChild(makeHeading('Quick actions'));
    for (var m = 0; m < matched.length; m++) {
      section.appendChild(makeActionOption(matched[m].label, matched[m].action, matched[m].href));
    }
    results.appendChild(section);
  }
`
