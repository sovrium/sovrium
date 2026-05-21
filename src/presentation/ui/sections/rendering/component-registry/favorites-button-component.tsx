/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

const FAVORITES_BUTTON_RUNTIME = `(function () {
  function labelFor(favorited) {
    return favorited ? 'Remove from favorites' : 'Add to favorites';
  }
  function iconFor(favorited) {
    return favorited ? '\\u2605' : '\\u2606';
  }
  function applyState(button, favorited) {
    button.setAttribute('data-favorited', favorited ? 'true' : 'false');
    button.setAttribute('aria-pressed', favorited ? 'true' : 'false');
    button.setAttribute('aria-label', labelFor(favorited));
    button.textContent = iconFor(favorited);
  }
  function payloadFor(button) {
    return {
      entityType: button.getAttribute('data-entity-type'),
      entityId: button.getAttribute('data-entity-id'),
      tableName: button.getAttribute('data-table-name') || undefined,
    };
  }
  // Synchronous request so the caller (initial state probe + click toggle)
  // observes a committed result before returning. The favorites E2E specs
  // query GET /api/favorites immediately after a click with no explicit
  // wait, so an async fetch would race the SELECT ahead of the COMMIT.
  function sendSync(method, body) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open(method, '/api/favorites', false);
      xhr.setRequestHeader('Accept', 'application/json');
      if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body);
      return xhr;
    } catch (err) {
      return null;
    }
  }
  function refresh(button) {
    var xhr = sendSync('GET', undefined);
    if (!xhr || xhr.status < 200 || xhr.status >= 300) return;
    var list;
    try {
      list = JSON.parse(xhr.responseText);
    } catch (err) {
      return;
    }
    var type = button.getAttribute('data-entity-type');
    var id = button.getAttribute('data-entity-id');
    var match = Array.isArray(list) && list.some(function (fav) {
      return fav && fav.entityType === type && String(fav.entityId) === String(id);
    });
    applyState(button, match);
  }
  // Record a view of this record in the caller's recent items. Single-record
  // detail pages always carry a favorites-button bound to the host record, so
  // this doubles as the recent-items auto-tracking hook
  // (US-PAGES-INTERACTIVITY-FAVORITES-RECENT-002).
  function trackRecent(button) {
    var type = button.getAttribute('data-entity-type');
    var id = button.getAttribute('data-entity-id');
    if (!type || !id) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/recent', false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(JSON.stringify({
        entityType: type,
        entityId: id,
        tableName: button.getAttribute('data-table-name') || undefined,
      }));
    } catch (err) {
      /* recent-tracking is best-effort */
    }
  }
  function setup(button) {
    if (button.getAttribute('data-favorites-ready') === 'true') return;
    button.setAttribute('data-favorites-ready', 'true');
    refresh(button);
    trackRecent(button);
    button.addEventListener('click', function (event) {
      event.preventDefault();
      var favorited = button.getAttribute('data-favorited') === 'true';
      var method = favorited ? 'DELETE' : 'POST';
      sendSync(method, JSON.stringify(payloadFor(button)));
      applyState(button, !favorited);
    });
  }
  function init() {
    var buttons = document.querySelectorAll('[data-favorites-toggle]');
    for (var i = 0; i < buttons.length; i++) setup(buttons[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`

interface FavoritesButtonComponent {
  readonly entityType?: string
  readonly entityId?: string
  readonly tableName?: string
}

export const favoritesButtonComponent: ComponentRenderer = ({ component }): ReactElement => {
  const synthesized = (component ?? {}) as FavoritesButtonComponent
  const { tableName } = synthesized
  const entityType = synthesized.entityType ?? 'record'
  const entityId = synthesized.entityId ?? ''

  return (
    <>
      <button
        type="button"
        data-favorites-toggle="true"
        data-entity-type={entityType}
        data-entity-id={entityId}
        data-table-name={tableName}
        data-favorited="false"
        aria-pressed="false"
        aria-label="Add to favorites"
        style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.25rem' }}
      >
        {'☆'}
      </button>
      <script
        dangerouslySetInnerHTML={{ __html: FAVORITES_BUTTON_RUNTIME }}
      />
    </>
  )
}
