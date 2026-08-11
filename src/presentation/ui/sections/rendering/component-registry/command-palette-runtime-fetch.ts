/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The command palette's request-scheduling layer, spliced into
 * `COMMAND_PALETTE_RUNTIME`'s IIFE.
 *
 * A FRAGMENT, not a module: its `var`s and `function`s are hoisted into the
 * runtime's shared closure, exactly like `COMMAND_PALETTE_RUNTIME_DOM`. It is
 * split out because the palette runtime crossed the 400-line file cap, and this
 * is the seam that carves along a real boundary — everything here is about WHEN
 * a request is issued and WHICH response is allowed to win, with no knowledge of
 * what the palette renders.
 *
 * ## What it replaced, and why
 *
 * The palette used to read every endpoint through a SYNCHRONOUS
 * `XMLHttpRequest` (`xhr.open(url, false)`). That blocks the main thread for the
 * entire round trip, on every 200 ms debounce tick, against an endpoint whose
 * production failure mode was a Gateway Timeout — so a slow search did not merely
 * feel slow, it froze the page the reader was typing into, and the palette could
 * not even paint their own keystrokes until the server answered.
 *
 * Going async removes the freeze and introduces the two problems async always
 * introduces. Both are handled here:
 *
 *   out-of-order responses  a slow reply for `quar` landing after a fast reply
 *                           for `quarterly` would overwrite newer results with
 *                           staler ones. Every render carries a token, and only
 *                           the newest token may touch the DOM.
 *   abandoned requests      a keystroke supersedes the previous one, so the
 *                           request it started is aborted rather than left to
 *                           consume a connection and a rate-limit slot.
 */
export const COMMAND_PALETTE_RUNTIME_FETCH = `
  var renderSeq = 0;
  var pendingController = null;

  // Mirrors the server's own selectivity floor. \`GET /api/command-search\`
  // answers \`200 []\` for any shorter query, so issuing the request would spend
  // a round trip to be told nothing — on the FIRST keystroke of every search
  // anyone performs, which is precisely the traffic worth not sending.
  var MIN_QUERY_LENGTH = 2;

  // Claim the newest render slot and cancel whatever the previous one started.
  function beginRender() {
    renderSeq = renderSeq + 1;
    if (pendingController) {
      try { pendingController.abort(); } catch (err) { /* already settled */ }
    }
    pendingController = typeof AbortController === 'function' ? new AbortController() : null;
    return { token: renderSeq, signal: pendingController ? pendingController.signal : undefined };
  }

  // True when a newer render has started since \`token\` was issued, in which
  // case this one must not write to the DOM.
  function isStale(token) {
    return token !== renderSeq;
  }

  // Resolves to the parsed body, or to null for any failure — an aborted
  // request, a non-2xx (including the 429 the endpoint's rate limit returns),
  // or a body that is not JSON. Callers render the empty state for null, which
  // is what the synchronous version did on every one of those paths too.
  function getJson(url, signal) {
    var options = { headers: { Accept: 'application/json' } };
    if (signal) options.signal = signal;
    return fetch(url, options)
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .catch(function () {
        return null;
      });
  }
`
