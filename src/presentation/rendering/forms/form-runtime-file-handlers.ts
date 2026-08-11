/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * F-11 (file-uploads): inline JS source for the file-input portion of
 * the standalone form runtime. Sliced out of `form-runtime.tsx` so the
 * runtime file stays under the project's max-lines cap; concatenated
 * verbatim into the IIFE source string at module load time.
 *
 * The fragment assumes the surrounding IIFE provides:
 *   - `form` (HTMLFormElement)
 *   - `removeIfPresent` (DOM helper)
 *   - `showFieldError` (inline-error helper)
 *
 * The fragment exports two locals:
 *   - `fileStash` (per-field selected-file array, keyed on input name)
 *   - `fileInputs` / `hasFileInputs` (used by the submit interceptor)
 *
 * Both branches (`bindFileInput`, `buildMultipartBody` etc.) read these
 * via closure capture once the fragment runs.
 */
export const FORM_RUNTIME_FILE_HANDLERS_SCRIPT = `
  // ---- File-input handling ---------------------------------------------------
  // Per-field stash of File objects the user has accepted (passed accept /
  // maxFileSize / maxFiles validation). Native <input type="file"> would
  // reset its own .files on every selection, so we track ours separately
  // and re-render chips off this stash. Submission uses the stash, not the
  // input's .files property, so users can remove files mid-flow.
  var fileStash = {}
  function getFileInputs() {
    return form.querySelectorAll('input[type="file"][data-form-file-input]')
  }
  function fileMatchesAccept(file, accept) {
    if (!accept) return true
    var entries = accept.split(',').map(function (s) {
      return s.trim().toLowerCase()
    })
    var fileName = (file.name || '').toLowerCase()
    var fileType = (file.type || '').toLowerCase()
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i]
      if (!entry) continue
      if (entry.charAt(0) === '.') {
        if (fileName.indexOf(entry) === fileName.length - entry.length) return true
      } else if (entry.indexOf('/*') === entry.length - 2) {
        var prefix = entry.slice(0, -1)
        if (fileType.indexOf(prefix) === 0) return true
      } else if (fileType === entry) {
        return true
      }
    }
    return false
  }
  function formatBytesShort(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return bytes + ' B'
  }
  function clearFieldFileError(input) {
    var wrapper = input.closest('.form-field')
    if (!wrapper) return
    removeIfPresent(wrapper.querySelector('[data-field-error]'))
  }
  function renderFileChips(input) {
    var name = input.getAttribute('data-form-file-input')
    var host = form.querySelector('[data-form-file-chips="' + name + '"]')
    if (!host) return
    while (host.firstChild) host.removeChild(host.firstChild)
    var files = fileStash[name] || []
    files.forEach(function (file) {
      var chip = document.createElement('div')
      chip.setAttribute('data-testid', 'file-chip-' + file.name)
      chip.setAttribute('data-form-file-chip', file.name)
      chip.className = 'form-file-chip'
      var label = document.createElement('span')
      label.textContent = file.name + ' (' + formatBytesShort(file.size) + ')'
      chip.appendChild(label)
      if (file.type && file.type.indexOf('image/') === 0) {
        var preview = document.createElement('img')
        preview.alt = name + ' preview'
        preview.setAttribute('data-testid', 'preview-' + name)
        preview.className = 'form-file-preview'
        try {
          preview.src = URL.createObjectURL(file)
        } catch (_e) {
          preview.src = ''
        }
        chip.appendChild(preview)
      }
      var btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-testid', 'remove-file-' + file.name)
      btn.setAttribute('data-form-file-remove', file.name)
      btn.setAttribute('aria-label', 'Remove ' + file.name)
      btn.tabIndex = 0
      btn.textContent = 'x'
      btn.addEventListener('click', function () {
        fileStash[name] = (fileStash[name] || []).filter(function (f) {
          return f.name !== file.name
        })
        renderFileChips(input)
      })
      btn.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          btn.click()
        }
      })
      chip.appendChild(btn)
      host.appendChild(chip)
    })
  }
  function processSelectedFiles(input, fileList) {
    var name = input.getAttribute('data-form-file-input')
    if (!name) return
    var multiple = input.hasAttribute('multiple')
    var maxFileSize = parseInt(input.getAttribute('data-max-file-size') || '0', 10) || 0
    var maxFiles = parseInt(input.getAttribute('data-max-files') || '0', 10) || 0
    var accept = input.getAttribute('accept') || ''
    var arr = []
    for (var i = 0; i < fileList.length; i++) arr.push(fileList[i])
    clearFieldFileError(input)
    var oversize = arr.find(function (f) {
      return maxFileSize > 0 && f.size > maxFileSize
    })
    if (oversize) {
      showFieldError(
        input,
        'File size ' +
          formatBytesShort(oversize.size) +
          ' exceeds maximum of ' +
          formatBytesShort(maxFileSize)
      )
      return
    }
    var rejected = arr.find(function (f) {
      return !fileMatchesAccept(f, accept)
    })
    if (rejected) {
      showFieldError(input, 'File type not accepted: ' + (rejected.type || rejected.name))
      return
    }
    var existing = fileStash[name] || []
    var combined = multiple ? existing.concat(arr) : arr
    if (multiple && maxFiles > 0 && combined.length > maxFiles) {
      showFieldError(input, 'You can upload a maximum of ' + maxFiles + ' files')
      fileStash[name] = combined.slice(0, maxFiles)
      renderFileChips(input)
      return
    }
    fileStash[name] = multiple ? combined : combined.slice(0, 1)
    renderFileChips(input)
  }
  function bindFileInput(input) {
    input.addEventListener('change', function () {
      processSelectedFiles(input, input.files || [])
    })
    var name = input.getAttribute('data-form-file-input')
    if (!name) return
    var dropzone = form.querySelector('[data-form-dropzone="' + name + '"]')
    if (!dropzone) return
    dropzone.addEventListener('click', function () {
      input.click()
    })
    dropzone.addEventListener('dragover', function (ev) {
      ev.preventDefault()
      dropzone.setAttribute('data-drag-over', 'true')
    })
    dropzone.addEventListener('dragleave', function () {
      dropzone.removeAttribute('data-drag-over')
    })
    dropzone.addEventListener('drop', function (ev) {
      ev.preventDefault()
      dropzone.removeAttribute('data-drag-over')
      if (ev.dataTransfer && ev.dataTransfer.files) {
        processSelectedFiles(input, ev.dataTransfer.files)
      }
    })
  }
  var fileInputs = getFileInputs()
  fileInputs.forEach(bindFileInput)
  var hasFileInputs = fileInputs.length > 0

  function buildMultipartBody() {
    var body = new FormData()
    var inputs = namedInputs()
    inputs.forEach(function (input) {
      if (input.type === 'file') return
      if (input.type === 'checkbox') {
        if (input.checked) body.append(input.name, input.value || 'on')
        return
      }
      if (input.type === 'radio') {
        if (input.checked) body.append(input.name, input.value || '')
        return
      }
      body.append(input.name, input.value || '')
    })
    fileInputs.forEach(function (input) {
      var name = input.getAttribute('data-form-file-input')
      if (!name) return
      var stash = fileStash[name] || []
      var multiple = input.hasAttribute('multiple')
      if (multiple) {
        stash.forEach(function (file, idx) {
          body.append(name + '[' + idx + ']', file, file.name)
        })
      } else if (stash[0]) {
        body.append(name, stash[0], stash[0].name)
      }
    })
    return body
  }
`
