/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline JS source for the `recordAudio` recorder of the standalone form
 * runtime, concatenated into the IIFE right after the file-input fragment
 * (`form-runtime-file-handlers.ts`), whose locals it reuses:
 *   - `form` (HTMLFormElement), `removeIfPresent`
 *   - `processSelectedFiles(input, files)`: the SAME validation, chip and
 *     submission path a picked file takes. A finished recording is handed to
 *     it as a `File`, so it is uploaded with `{ url, name, size, mimeType }`
 *     exactly like a file from the picker.
 *
 * Format: `audio/webm;codecs=opus` where the browser records it, `audio/mp4`
 * otherwise (older Safari). The file is named `.weba` / `.m4a` — never
 * `.webm`, which the MIME table resolves to `video/webm` — and carries the
 * recorder's own type with its codec parameter dropped.
 *
 * A refused or missing microphone leaves an inline `role="alert"` on the field
 * and changes nothing else: the picker keeps working.
 */
export const FORM_RUNTIME_AUDIO_RECORDER_SCRIPT = `
  // ---- Audio recording (recordAudio) ----------------------------------------
  var RECORDER_TYPES = [
    { mime: 'audio/webm;codecs=opus', ext: '.weba' },
    { mime: 'audio/webm', ext: '.weba' },
    { mime: 'audio/mp4', ext: '.m4a' },
  ]
  function pickRecorderType() {
    if (typeof MediaRecorder === 'undefined') return undefined
    if (typeof MediaRecorder.isTypeSupported !== 'function') return RECORDER_TYPES[0]
    return RECORDER_TYPES.find(function (t) {
      return MediaRecorder.isTypeSupported(t.mime)
    })
  }
  function formatElapsed(ms) {
    var total = Math.floor(ms / 1000)
    var seconds = total % 60
    return Math.floor(total / 60) + ':' + (seconds < 10 ? '0' : '') + seconds
  }
  function recordingFileName(ext) {
    var d = new Date()
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n
    }
    return (
      'recording-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + ext
    )
  }
  function bindAudioRecorder(host) {
    var name = host.getAttribute('data-form-audio-recorder')
    var recordBtn = host.querySelector('[data-form-record-audio]')
    var input = form.querySelector('input[data-form-file-input="' + name + '"]')
    if (!name || !recordBtn || !input) return
    var maxMs = (parseInt(host.getAttribute('data-max-duration-seconds') || '0', 10) || 7200) * 1000
    var active = null
    function clearError() {
      removeIfPresent(host.querySelector('[data-form-record-error]'))
    }
    function showError(message) {
      clearError()
      var alert = document.createElement('p')
      alert.setAttribute('role', 'alert')
      alert.setAttribute('data-form-record-error', name)
      alert.setAttribute('data-testid', 'record-audio-error-' + name)
      alert.className = 'field-error form-audio-error'
      alert.textContent = message
      host.appendChild(alert)
    }
    function finish() {
      if (!active) return
      var session = active
      active = null
      clearInterval(session.ticker)
      clearTimeout(session.cap)
      removeIfPresent(session.stopBtn)
      removeIfPresent(session.elapsed)
      recordBtn.hidden = false
      recordBtn.disabled = false
      if (session.recorder.state !== 'inactive') session.recorder.stop()
    }
    function start(stream, type) {
      var recorder = new MediaRecorder(stream, { mimeType: type.mime })
      var chunks = []
      recorder.addEventListener('dataavailable', function (ev) {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data)
      })
      recorder.addEventListener('stop', function () {
        stream.getTracks().forEach(function (track) {
          track.stop()
        })
        var mime = (recorder.mimeType || type.mime).split(';')[0]
        var blob = new Blob(chunks, { type: mime })
        if (blob.size === 0) return
        processSelectedFiles(input, [new File([blob], recordingFileName(type.ext), { type: mime })])
      })
      var stopBtn = document.createElement('button')
      stopBtn.type = 'button'
      // The Stop button wears the Record button's button recipe (rendered on
      // the server), with its own marker class in place of the Record one.
      stopBtn.className = recordBtn.className.replace('form-audio-record', 'form-audio-stop')
      stopBtn.setAttribute('data-testid', 'stop-recording-' + name)
      stopBtn.textContent = 'Stop recording'
      stopBtn.addEventListener('click', finish)
      var elapsed = document.createElement('span')
      elapsed.className = 'form-audio-elapsed'
      elapsed.setAttribute('data-testid', 'recording-elapsed-' + name)
      elapsed.setAttribute('aria-live', 'off')
      elapsed.textContent = '0:00'
      recordBtn.hidden = true
      host.insertBefore(stopBtn, recordBtn)
      host.insertBefore(elapsed, recordBtn)
      var startedAt = Date.now()
      recorder.start()
      active = {
        recorder: recorder,
        stopBtn: stopBtn,
        elapsed: elapsed,
        ticker: setInterval(function () {
          elapsed.textContent = formatElapsed(Date.now() - startedAt)
        }, 250),
        cap: setTimeout(finish, maxMs),
      }
      stopBtn.focus()
    }
    recordBtn.addEventListener('click', function () {
      if (active) return
      clearError()
      var type = pickRecorderType()
      var media = navigator.mediaDevices
      if (!type || !media || typeof media.getUserMedia !== 'function') {
        showError('This browser cannot record from a microphone. You can upload an audio file instead.')
        return
      }
      recordBtn.disabled = true
      media.getUserMedia({ audio: true }).then(
        function (stream) {
          try {
            start(stream, type)
          } catch (_e) {
            // The recorder never started, so its stop handler will never
            // release the microphone: release it here.
            stream.getTracks().forEach(function (track) {
              track.stop()
            })
            recordBtn.disabled = false
            showError('The microphone could not be started. You can upload an audio file instead.')
          }
        },
        function () {
          recordBtn.disabled = false
          showError('Microphone access was refused. You can upload an audio file instead.')
        }
      )
    })
  }
  form.querySelectorAll('[data-form-audio-recorder]').forEach(bindAudioRecorder)
`
