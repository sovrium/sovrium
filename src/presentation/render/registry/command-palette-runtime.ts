/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COMMAND_PALETTE_RUNTIME_ACTIONS } from './command-palette-runtime-actions'
import { COMMAND_PALETTE_RUNTIME_DOM } from './command-palette-runtime-dom'
import { COMMAND_PALETTE_RUNTIME_FETCH } from './command-palette-runtime-fetch'
import { INLINE_TOAST_POLICY_RUNTIME } from './inline-toast-policy-runtime'

/**
 * Global command-palette runtime for the synthesized `command-palette`
 * component ([internal ref] /
 * [internal ref]).
 *
 * Server-authored constant string (no untrusted interpolation) dropped into an
 * inline `<script>` so the palette works without shipping the React island
 * bundle. Mirrors the `favorites-button` inline-runtime pattern.
 *
 * Behaviour:
 *  - `Cmd+K` / `Ctrl+K` opens the centered modal overlay and focuses the
 *    search input. `Escape` closes it.
 *  - When opened with an empty query, the palette renders a list of **quick
 * actions**: "Create new record
 *    in <table>" for each table, "Go to <page>" for each navigable page, and a
 *    "Toggle dark mode" action. It also fetches `GET /api/favorites` and
 *    `GET /api/recent` and renders a "Favorites" section above a "Recent"
 *    section (each section only appears when it has at least one item).
 *  - Typing a query filters the quick actions by label substring and calls
 *    `GET /api/command-search?q=` to render matching records/pages grouped by
 *    table. Each table group is a `role="group"` section whose `aria-label`
 *    is the table name; every option shows the table name alongside the
 *    matching record's label. Favorited records carry a star indicator
 *    (`data-favorite="true"`).
 *  - ArrowDown / ArrowUp move a highlighted option; Enter activates the
 *    highlighted option — navigating (records/pages/go-to actions), opening a
 *    record-creation dialog (create-record actions) or toggling dark mode.
 *
 * Quick-action options carry a `data-command-action` attribute:
 *  - `create-record:<table>` — opens the hidden per-table creation dialog
 *  - `navigate` — uses `data-href` (page navigation / "Go to" actions)
 *  - `toggle-dark-mode` — toggles the `dark` class on `<html>` and shows a toast
 */
export const COMMAND_PALETTE_RUNTIME = `(function () {
  var configEl = document.querySelector('[data-command-palette-config]');
  var config = { tables: [], pages: [] };
  try {
    if (configEl && configEl.textContent) config = JSON.parse(configEl.textContent);
  } catch (err) { config = { tables: [], pages: [] }; }
  if (!Array.isArray(config.tables)) config.tables = [];
  if (!Array.isArray(config.pages)) config.pages = [];
  var debounceHandle = null;
  var activeIndex = -1;

  // The overlay DOM is built lazily on first \`Cmd+K\` — see \`ensureOverlay\`.
  // Pre-rendering it server-side would pollute generic page selectors in
  // unrelated specs (\`page.locator('input')\` / \`locator('[role="dialog"]')\`
  // would resolve the palette's search input / dialog and fail strict mode).
  var overlay = null;
  var input = null;
  var results = null;
${COMMAND_PALETTE_RUNTIME_DOM}
${COMMAND_PALETTE_RUNTIME_FETCH}
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
    // Content-page body excerpt with the matched span wrapped in <mark>.
    // Built with createTextNode (never innerHTML) so the snippet text is never
    // interpreted as markup.
    if (typeof match.excerpt === 'string' && match.excerpt) {
      var snippet = document.createElement('div');
      snippet.setAttribute('data-command-palette-excerpt', '');
      var range = Array.isArray(match.matchRange) ? match.matchRange : null;
      if (range && range.length === 2 && range[0] >= 0 && range[1] > range[0]) {
        snippet.appendChild(document.createTextNode(match.excerpt.slice(0, range[0])));
        var mark = document.createElement('mark');
        mark.appendChild(document.createTextNode(match.excerpt.slice(range[0], range[1])));
        snippet.appendChild(mark);
        snippet.appendChild(document.createTextNode(match.excerpt.slice(range[1])));
      } else {
        snippet.appendChild(document.createTextNode(match.excerpt));
      }
      li.appendChild(snippet);
    }
    li.addEventListener('click', function () { activate(li); });
    return li;
  }

${COMMAND_PALETTE_RUNTIME_ACTIONS}

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

  // \`showToast\` and the helpers it uses are spliced in from
  // \`inline-toast-policy-runtime.ts\`, the one transcription of the dismissal
  // policy the two inline runtimes share. The palette raises only unvariant
  // confirmations, so every toast it shows takes the default-expiry clause.
${INLINE_TOAST_POLICY_RUNTIME}

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

  // \`ensureOverlay\`, \`closeCreateDialog\`, \`tableFields\`, \`buildCreateDialog\`
  // and \`openCreateDialog\` are defined in the COMMAND_PALETTE_RUNTIME_DOM
  // fragment spliced in above (they are hoisted into this shared closure).

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
  function renderDefault(ctx) {
    // Quick actions are derived from config alone, so they paint immediately
    // rather than waiting on the network — the palette is never blank while the
    // favorites/recent requests are in flight. The two sections below always
    // append AFTER them, so the resulting order is unchanged.
    clearResults();
    renderQuickActions('');
    return Promise.all([
      getJson('/api/favorites', ctx.signal),
      getJson('/api/recent?limit=20', ctx.signal),
    ]).then(function (responses) {
      if (isStale(ctx.token)) return;
      var favorites = responses[0] || [];
      var recent = responses[1] || [];
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
    });
  }

  // Search view: page matches in a "Pages" category section above the record
  // matches, which live in a "Records" category section grouped by table name.
  // Quick actions filtered by the query are rendered LAST — when a query is
  // typed the user is most likely looking for an actual page/record match, so
  // pressing ArrowDown once should highlight a content result, not the generic
  // "Create new record in <table>" quick action.
  function renderSearch(query, ctx) {
    // The previous results stay on screen until the new ones arrive: clearing
    // up front would blank the list on every debounce tick, which reads as
    // flicker rather than as progress.
    return getJson('/api/command-search?q=' + encodeURIComponent(query), ctx.signal).then(
      function (response) {
        if (isStale(ctx.token)) return;
        renderMatches(query, response || []);
      }
    );
  }

  function renderMatches(query, matches) {
    clearResults();
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
    // Quick actions render after content matches — see the function doc.
    renderQuickActions(query);
  }

  function refresh() {
    var query = (input.value || '').trim();
    // Claim the render slot BEFORE branching, so a sub-floor keystroke also
    // cancels the request the previous keystroke started.
    var ctx = beginRender();
    if (query.length < MIN_QUERY_LENGTH) {
      renderDefault(ctx);
    } else {
      renderSearch(query, ctx);
    }
  }

  function openPalette() {
    ensureOverlay();
    // The overlay closure is cached at first \`ensureOverlay()\` (the early-return
    // guard prevents rebuild on every open). If a navigation, a teleport, or a
    // host page replaced <body>, the cached node may be detached — re-attach
    // defensively so subsequent Cmd+K events still surface the palette.
    if (!overlay.isConnected) document.body.appendChild(overlay);
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
    if (!overlay) return;
    overlay.setAttribute('data-open', 'false');
    overlay.style.display = 'none';
  }

  document.addEventListener('keydown', function (event) {
    var isToggle = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
    if (isToggle) {
      event.preventDefault();
      if (overlay && overlay.getAttribute('data-open') === 'true') {
        closePalette();
      } else {
        openPalette();
      }
      return;
    }
    if (!overlay || overlay.getAttribute('data-open') !== 'true') return;
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

  // The search-input \`input\` listener and the backdrop \`mousedown\` listener
  // are wired inside \`ensureOverlay\` when the overlay DOM is first built.

  // Escape closes any open record-creation dialog (the dialog is layered
  // above the palette and has its own dismissal lifecycle). Each dialog is
  // built lazily by \`buildCreateDialog\` with its own close-button and
  // backdrop-click handlers wired in at construction time.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var open = document.querySelector('[data-create-record-dialog][data-open="true"]');
    if (open) {
      event.preventDefault();
      closeCreateDialog(open);
    }
  });
})();`
