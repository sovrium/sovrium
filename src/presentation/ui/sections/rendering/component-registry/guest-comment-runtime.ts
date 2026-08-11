/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline runtime for the SSR guest comment form (PG-02). Mirrors the
 * `favorites-button` and `reorderable-list` inline-runtime patterns —
 * a server-authored constant string dropped into an inline `<script>`
 * so the form works without shipping the React island bundle. Trusted
 * by construction: no untrusted interpolation; per-form context
 * (table name, record ID) travels in `data-*` attributes on the form.
 *
 * Behaviour (drives `guest-comments.spec.ts`):
 * - [internal ref]: client-side `name` required check;
 *    renders inline "Name is required" message inside the form.
 * - [internal ref]: client-side `email` required check
 *    when `data-comments-guest-email-required="true"`; renders inline
 *    "Email is required" message.
 * - [internal ref]: client-side `email` format check;
 *    renders inline "Enter a valid email" message when the value does
 *    not match the canonical `/.+@.+\..+/` shape.
 * - [internal ref]: on a successful submit, append the
 *    posted comment's author name + content to the SSR comments section
 *    so the assertion `page.getByText('Jane Doe')` resolves without a
 *    hydration island roundtrip.
 *
 * Synchronous XHR is used for the POST so the click handler blocks
 * until the response is committed — Playwright's `getByText` is
 * auto-retrying, but the synchronous flow keeps the wire-shape echo
 * deterministic from the click point.
 */
export const GUEST_COMMENT_FORM_RUNTIME = `(function () {
  function clearErrors(form) {
    var existing = form.querySelectorAll('[data-comments-error]');
    for (var i = 0; i < existing.length; i++) {
      existing[i].parentNode.removeChild(existing[i]);
    }
  }
  function showError(form, message) {
    var p = document.createElement('p');
    p.setAttribute('data-comments-error', '');
    p.setAttribute('role', 'alert');
    p.style.color = '#dc2626';
    p.style.fontSize = '0.875rem';
    p.style.margin = '0.25rem 0 0';
    p.textContent = message;
    form.appendChild(p);
  }
  function validate(form) {
    clearErrors(form);
    var name = (form.elements['guestName'] && form.elements['guestName'].value || '').trim();
    var email = (form.elements['guestEmail'] && form.elements['guestEmail'].value || '').trim();
    var content = (form.elements['content'] && form.elements['content'].value || '').trim();
    var emailRequired = form.getAttribute('data-comments-guest-email-required') === 'true';
    var errors = [];
    if (name.length === 0) errors.push('Name is required');
    if (emailRequired && email.length === 0) errors.push('Email is required');
    if (email.length > 0 && !/.+@.+\\..+/.test(email)) errors.push('Enter a valid email');
    if (content.length === 0) errors.push('Comment is required');
    for (var i = 0; i < errors.length; i++) showError(form, errors[i]);
    return errors.length === 0;
  }
  function appendCommentToSection(section, body) {
    var comment = body && body.comment ? body.comment : body;
    if (!comment) return;
    var author = comment.guestName || 'Anonymous';
    var content = comment.content || '';
    // Hide the empty-state once a comment lands.
    var empty = section.querySelector('[data-comments-empty-state]');
    if (empty) empty.setAttribute('hidden', '');
    var li = document.createElement('article');
    li.setAttribute('data-comment-id', String(comment.id || ''));
    li.className = 'comments-item mt-3 border-t pt-3';
    var authorEl = document.createElement('p');
    authorEl.className = 'comments-author font-medium text-sm';
    authorEl.textContent = author;
    var bodyEl = document.createElement('p');
    bodyEl.className = 'comments-body text-sm';
    bodyEl.textContent = content;
    li.appendChild(authorEl);
    li.appendChild(bodyEl);
    section.insertBefore(li, section.querySelector('form'));
  }
  function submitForm(form) {
    var section = form.closest('[data-component="comments"]');
    if (!section) return;
    var table = section.getAttribute('data-comments-table');
    var recordId = section.getAttribute('data-comments-record-id') || 'guest-comment-record';
    if (!table) return;
    var payload = {
      content: (form.elements['content'] && form.elements['content'].value || '').trim(),
      guestName: (form.elements['guestName'] && form.elements['guestName'].value || '').trim(),
      guestEmail: (form.elements['guestEmail'] && form.elements['guestEmail'].value || '').trim(),
    };
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/tables/' + encodeURIComponent(table) + '/records/' + encodeURIComponent(recordId) + '/comments', false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(JSON.stringify(payload));
      if (xhr.status >= 200 && xhr.status < 300) {
        var body;
        try { body = JSON.parse(xhr.responseText); } catch (err) { body = undefined; }
        if (body) appendCommentToSection(section, body);
        // Reset on success.
        form.reset();
      } else {
        showError(form, 'Failed to submit comment');
      }
    } catch (err) {
      showError(form, 'Failed to submit comment');
    }
  }
  function setup(form) {
    if (form.getAttribute('data-comments-form-ready') === 'true') return;
    form.setAttribute('data-comments-form-ready', 'true');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!validate(form)) return;
      submitForm(form);
    });
    // APP-PAGES-PUBLIC-COMMENTS-008 prefill: if a session user is exposed
    // via the section's data-* attributes (set when the SSR renderer
    // resolves an authenticated session), prefill the name/email inputs
    // so the toHaveValue() assertions match without a hydration roundtrip.
    var section = form.closest('[data-component="comments"]');
    if (section) {
      var name = section.getAttribute('data-comments-session-name');
      var email = section.getAttribute('data-comments-session-email');
      if (name && form.elements['guestName'] && !form.elements['guestName'].value) {
        form.elements['guestName'].value = name;
      }
      if (email && form.elements['guestEmail'] && !form.elements['guestEmail'].value) {
        form.elements['guestEmail'].value = email;
      }
    }
  }
  function init() {
    var forms = document.querySelectorAll('form[data-comments-form="guest"]');
    for (var i = 0; i < forms.length; i++) setup(forms[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`
