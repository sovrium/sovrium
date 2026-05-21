/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const COMMAND_PALETTE_RUNTIME = `(function () {
  var overlay = document.querySelector('[data-command-palette]');
  if (!overlay) return;
  var input = overlay.querySelector('[data-command-palette-input]');
  var results = overlay.querySelector('[data-command-palette-results]');
  var configEl = document.querySelector('[data-command-palette-config]');
  var config = { tables: [], pages: [] };
  try {
    if (configEl && configEl.textContent) config = JSON.parse(configEl.textContent);
  } catch (err) { config = { tables: [], pages: [] }; }
  if (!Array.isArray(config.tables)) config.tables = [];
  if (!Array.isArray(config.pages)) config.pages = [];
  var debounceHandle = null;
  var activeIndex = -1;

  function getJson(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();
      if (xhr.status < 200 || xhr.status >= 300) return null;
      return JSON.parse(xhr.responseText);
    } catch (err) {
      return null;
    }
  }

  function clearResults() {
    while (results.firstChild) results.removeChild(results.firstChild);
    activeIndex = -1;
  }

  function makeHeading(text) {
    var h = document.createElement('h3');
    h.textContent = text;
    h.setAttribute('data-command-palette-heading', text.toLowerCase());
    return h;
  }

  function makeOption(match) {
    var li = document.createElement('div');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-label', match.label);
    if (typeof match.detailPath === 'string' && match.detailPath) {
      li.setAttribute('data-href', match.detailPath);
    }
    if (match.favorited === true) {
      var star = document.createElement('span');
      star.setAttribute('data-favorite', 'true');
      star.setAttribute('aria-label', 'favorite');
      star.textContent = '\\u2605 ';
      li.appendChild(star);
    }
    var text = document.createElement('span');
    text.textContent = match.label;
    li.appendChild(text);
    // Table-name badge so each result advertises the table it belongs to.
    if (typeof match.tableName === 'string' && match.tableName) {
      var badge = document.createElement('span');
      badge.setAttribute('data-command-palette-table', match.tableName);
      badge.textContent = ' ' + match.tableName;
      li.appendChild(badge);
    }
    li.addEventListener('click', function () { activate(li); });
    return li;
  }

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

  function getOptions() {
    return results.querySelectorAll('[role="option"]');
  }

  function highlight(index) {
    var options = getOptions();
    if (options.length === 0) { activeIndex = -1; return; }
    if (index < 0) index = 0;
    if (index >= options.length) index = options.length - 1;
    for (var i = 0; i < options.length; i++) {
      if (i === index) {
        options[i].setAttribute('data-active', 'true');
        options[i].setAttribute('aria-selected', 'true');
      } else {
        options[i].removeAttribute('data-active');
        options[i].setAttribute('aria-selected', 'false');
      }
    }
    activeIndex = index;
  }

  function navigateTo(option) {
    if (!option) return;
    var href = option.getAttribute('data-href');
    if (href) window.location.assign(href);
  }

  function showToast(message) {
    var container = document.querySelector('[data-sonner-toaster]');
    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-sonner-toaster', '');
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.style.position = 'fixed';
      container.style.bottom = '16px';
      container.style.right = '16px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.setAttribute('data-toast', '');
    toast.textContent = message;
    container.appendChild(toast);
  }

  function toggleDarkMode() {
    var root = document.documentElement;
    var willEnable = !root.classList.contains('dark');
    if (willEnable) {
      root.classList.add('dark');
      showToast('Dark mode enabled');
    } else {
      root.classList.remove('dark');
      showToast('Light mode enabled');
    }
  }

  function openCreateDialog(tableName) {
    var dialog = document.querySelector('[data-create-record-dialog="' + tableName + '"]');
    if (!dialog) return;
    dialog.setAttribute('data-open', 'true');
    // See \`openPalette\` — clear any \`hidden\` a global modal handler may set.
    dialog.removeAttribute('hidden');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.style.display = 'flex';
  }

  // Activate the given option element: navigate, open a creation dialog or
  // toggle dark mode depending on its \`data-command-action\` attribute.
  function activate(option) {
    if (!option) return;
    var action = option.getAttribute('data-command-action');
    if (action === 'toggle-dark-mode') {
      closePalette();
      toggleDarkMode();
      return;
    }
    if (action && action.indexOf('create-record:') === 0) {
      closePalette();
      openCreateDialog(action.slice('create-record:'.length));
      return;
    }
    // \`navigate\` actions and plain record/page results both use data-href.
    navigateTo(option);
  }

  // Empty-query view: quick actions, then a Favorites section above a Recent
  // section.
  function renderDefault() {
    clearResults();
    renderQuickActions('');
    var favorites = getJson('/api/favorites') || [];
    var recent = getJson('/api/recent?limit=20') || [];
    if (Array.isArray(favorites) && favorites.length > 0) {
      var favSection = document.createElement('section');
      favSection.setAttribute('data-command-palette-section', 'favorites');
      favSection.appendChild(makeHeading('Favorites'));
      results.appendChild(favSection);
    }
    if (Array.isArray(recent) && recent.length > 0) {
      var recentSection = document.createElement('section');
      recentSection.setAttribute('data-command-palette-section', 'recent');
      recentSection.appendChild(makeHeading('Recent'));
      results.appendChild(recentSection);
    }
  }

  // Search view: quick actions filtered by query, then page matches in a
  // "Pages" category section above the record matches, which live in a
  // "Records" category section. Within "Records" the matches are grouped by
  // table name, each group a role="group" section labelled with its table name.
  function renderSearch(query) {
    clearResults();
    renderQuickActions(query);
    var matches = getJson('/api/command-search?q=' + encodeURIComponent(query)) || [];
    if (!Array.isArray(matches)) return;
    var pageMatches = [];
    var recordMatches = [];
    for (var i = 0; i < matches.length; i++) {
      var match = matches[i];
      if (!match || typeof match.label !== 'string') continue;
      if (match.entityType === 'page') {
        pageMatches.push(match);
      } else {
        recordMatches.push(match);
      }
    }
    if (pageMatches.length > 0) {
      var pagesSection = document.createElement('section');
      pagesSection.setAttribute('data-command-palette-section', 'pages');
      pagesSection.appendChild(makeHeading('Pages'));
      for (var p = 0; p < pageMatches.length; p++) {
        pagesSection.appendChild(makeOption(pageMatches[p]));
      }
      results.appendChild(pagesSection);
    }
    if (recordMatches.length > 0) {
      var recordsSection = document.createElement('section');
      recordsSection.setAttribute('data-command-palette-section', 'records');
      recordsSection.appendChild(makeHeading('Records'));
      var groups = {};
      var order = [];
      for (var r = 0; r < recordMatches.length; r++) {
        var rec = recordMatches[r];
        var table = typeof rec.tableName === 'string' ? rec.tableName : '';
        if (!groups[table]) {
          groups[table] = [];
          order.push(table);
        }
        groups[table].push(rec);
      }
      for (var g = 0; g < order.length; g++) {
        var tableName = order[g];
        var group = document.createElement('section');
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', tableName);
        group.setAttribute('data-command-palette-group', tableName);
        group.appendChild(makeHeading(tableName));
        var items = groups[tableName];
        for (var j = 0; j < items.length; j++) {
          group.appendChild(makeOption(items[j]));
        }
        recordsSection.appendChild(group);
      }
      results.appendChild(recordsSection);
    }
  }

  function refresh() {
    var query = (input.value || '').trim();
    if (query.length === 0) {
      renderDefault();
    } else {
      renderSearch(query);
    }
  }

  function openPalette() {
    overlay.setAttribute('data-open', 'true');
    // Clear any \`hidden\` attribute a global modal-lifecycle handler may have
    // stamped on this \`role="dialog"\` element — \`[hidden]\` carries a
    // \`display:none !important\` rule that would otherwise pin the palette
    // invisible regardless of the inline display below.
    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
    input.value = '';
    refresh();
    // Defer focus so the keydown that opened the palette does not type into
    // the freshly-focused search input.
    setTimeout(function () { input.focus(); }, 0);
  }

  function closePalette() {
    overlay.setAttribute('data-open', 'false');
    overlay.style.display = 'none';
  }

  document.addEventListener('keydown', function (event) {
    var isToggle = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
    if (isToggle) {
      event.preventDefault();
      if (overlay.getAttribute('data-open') === 'true') {
        closePalette();
      } else {
        openPalette();
      }
      return;
    }
    if (overlay.getAttribute('data-open') !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(activeIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(activeIndex - 1);
      return;
    }
    if (event.key === 'Enter') {
      var options = getOptions();
      if (activeIndex >= 0 && activeIndex < options.length) {
        event.preventDefault();
        activate(options[activeIndex]);
      }
    }
  });

  input.addEventListener('input', function () {
    if (debounceHandle !== null) clearTimeout(debounceHandle);
    debounceHandle = setTimeout(refresh, 200);
  });

  // Clicking the dim backdrop (the overlay itself, outside the dialog panel)
  // closes the palette without performing any action.
  overlay.addEventListener('mousedown', function (event) {
    if (event.target === overlay) {
      closePalette();
    }
  });

  function closeCreateDialog(dialog) {
    dialog.setAttribute('data-open', 'false');
    dialog.style.display = 'none';
  }

  // Wire each per-table creation dialog: close control + backdrop click.
  var dialogs = document.querySelectorAll('[data-create-record-dialog]');
  for (var d = 0; d < dialogs.length; d++) {
    (function (dialog) {
      var closeBtn = dialog.querySelector('[data-create-record-close]');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () { closeCreateDialog(dialog); });
      }
      dialog.addEventListener('mousedown', function (event) {
        if (event.target === dialog) closeCreateDialog(dialog);
      });
    })(dialogs[d]);
  }

  // Escape closes any open record-creation dialog (the dialog is layered
  // above the palette and has its own dismissal lifecycle).
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var open = document.querySelector('[data-create-record-dialog][data-open="true"]');
    if (open) {
      event.preventDefault();
      closeCreateDialog(open);
    }
  });
})();`
