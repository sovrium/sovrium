/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The plugin UI, in Figma's null-origin iframe: the file picker in, the
 * download out, the check's list. It posts to the plugin code and to nothing
 * else — there is no `fetch` here, and the manifest allows no domain.
 *
 * A file leaves by a `Blob` and an `<a download>`. That pattern is community
 * practice, not stated by Figma, and whether the iframe's sandbox allows
 * downloads is UNVERIFIED (`facts.md`), so the text is also shown in a
 * read-only box to copy from when the download does not happen.
 */

import type { CheckFinding } from './check-board'
import type { CodeMessage, ExportedFile, UiMessage } from './messages'

const post = (message: UiMessage) => parent.postMessage({ pluginMessage: message }, '*')

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`The plugin UI has no #${id}.`)
  return element as T
}

const status = byId<HTMLDivElement>('status')
const files = byId<HTMLDivElement>('files')
const findings = byId<HTMLUListElement>('findings')
const selectAll = byId<HTMLButtonElement>('select-all')

const say = (text: string, error = false) => {
  status.textContent = text
  status.className = error ? 'error' : ''
}

const download = (file: ExportedFile) => {
  const url = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const showFile = (file: ExportedFile) => {
  const label = document.createElement('div')
  label.textContent = file.fileName
  const text = document.createElement('textarea')
  text.readOnly = true
  text.value = file.text
  text.addEventListener('focus', () => text.select())
  files.append(label, text)
}

const describe = (finding: CheckFinding): string =>
  finding.kind === 'off-scale'
    ? `${finding.layerName} (${finding.page}, ${finding.breakpoint}): ${finding.property ?? ''} ${finding.value ?? ''} is off the scale` +
      (finding.nearestVariable === undefined ? '' : `; nearest ${finding.nearestVariable}`)
    : `${finding.layerName} (${finding.page}, ${finding.breakpoint}): not a kit component`

const showFindings = (list: readonly CheckFinding[]) => {
  findings.replaceChildren(
    ...list.map((finding) => {
      const item = document.createElement('li')
      const text = document.createElement('span')
      text.textContent = describe(finding)
      const select = document.createElement('button')
      select.textContent = 'Select'
      select.addEventListener('click', () => post({ type: 'select', layerIds: [finding.layerId] }))
      item.append(text, select)
      return item
    })
  )
  selectAll.hidden = list.length === 0
  selectAll.onclick = () =>
    post({ type: 'select', layerIds: list.map((finding) => finding.layerId) })
}

const onReply = (message: CodeMessage) => {
  switch (message.type) {
    case 'imported': {
      const { summary } = message
      say(
        [
          `Drew "${summary.page}": ${summary.boards} board(s), ${summary.layers} layer(s).`,
          ...summary.ambiguousVariables.map(
            (name) => `Two collections name ${name}; the first was bound.`
          ),
          ...summary.warnings,
        ].join('\n')
      )
      return
    }
    case 'exported':
      files.replaceChildren()
      message.files.forEach((file) => {
        download(file)
        showFile(file)
      })
      say(
        [
          `Exported ${message.files.map((file) => file.fileName).join(', ')}.`,
          ...message.warnings,
        ].join('\n')
      )
      return
    case 'checked': {
      const { report } = message
      showFindings(report.findings)
      say(
        [
          report.spacingSteps === 0
            ? 'No spacing/* variable in this file: import the token files to check values against the scale.'
            : `${report.findings.length} finding(s). Nothing was changed.`,
          ...report.warnings,
        ].join('\n')
      )
      return
    }
    case 'error':
      say(message.message, true)
  }
}

window.onmessage = (event: MessageEvent<{ readonly pluginMessage?: CodeMessage }>) => {
  const message = event.data.pluginMessage
  if (message !== undefined) onReply(message)
}

byId<HTMLInputElement>('file').addEventListener('change', async (event) => {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (file === undefined) return
  say(`Reading ${file.name}…`)
  post({ type: 'import', fileName: file.name, text: await file.text() })
  input.value = ''
})
byId<HTMLButtonElement>('export').addEventListener('click', () => post({ type: 'export' }))
byId<HTMLButtonElement>('check').addEventListener('click', () => post({ type: 'check' }))
