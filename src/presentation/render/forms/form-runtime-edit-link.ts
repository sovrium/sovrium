/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The private edit link a submission to an `editAfterSubmit` form answers
 * with, drawn after the success feedback as a plain link beside the form —
 * it stays where the submitter can bookmark it, whatever `onSuccess` shows.
 * Assumes the surrounding IIFE provides `form`, `formName`, `S` (the
 * page-language strings) and `removeIfPresent`.
 */
export const FORM_RUNTIME_EDIT_LINK_SCRIPT = `
  function renderEditLink(url) {
    if (typeof url !== 'string' || url.charAt(0) !== '/' || url.charAt(1) === '/') return
    removeIfPresent(document.querySelector('[data-form-edit-link="' + formName + '"]'))
    var box = document.createElement('p')
    box.setAttribute('data-form-edit-link', formName)
    box.className = 'form-edit-link'
    var link = document.createElement('a')
    link.href = url
    link.textContent = S['form.editAnswers'] || 'Edit your answers'
    box.appendChild(link)
    form.parentNode.insertBefore(box, form.nextSibling)
  }
`
