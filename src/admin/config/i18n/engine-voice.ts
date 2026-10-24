/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The engine's own words the console renders, overridden under the reserved
// `sovrium.` prefix. The English values are the engine's English unchanged:
// they exist so the two tables keep one key set (`parity.test.ts`). The point
// is the French twin, `fr-engine-voice.ts`.

export default {
  'sovrium.action.unreachable': 'The action could not be run. Try again.',
  'sovrium.agentConversations.idle': 'Select a conversation',
  'sovrium.agentConversations.idleBody': 'Pick one from the list to read its messages.',
  'sovrium.agentConversations.loadFailedBody': 'Conversations couldn’t load. Try again.',
  'sovrium.agentConversations.threadFailedBody': 'Messages couldn’t load. Try again.',
  'sovrium.aiChat.awaitingApproval': 'Waiting for your approval',
  'sovrium.aiChat.closed': 'No longer waiting for a decision. Ask again if you still need it.',
  'sovrium.aiChat.composer.voiceError': 'The recording could not be transcribed. Try again.',
  'sovrium.aiChat.notConfigured':
    'AI chat is not configured here. Set AI_PROVIDER, and AI_API_KEY for a hosted provider, to turn it on.',
  'sovrium.aiChat.placeholder': 'Ask a question…',
  'sovrium.aiChat.question.closed': 'This question is closed. Ask again if you still need it.',
  'sovrium.apiKeys.copyFailed': 'Could not copy — select the key above and copy it manually.',
  'sovrium.apiKeys.copyNow': 'Copy this key now — it is shown once and cannot be recovered.',
  'sovrium.apiKeys.createBody':
    'The key acts as you. You see its value once, right after you create it.',
  'sovrium.apiKeys.createFailed':
    'Could not create the key. Check you are still signed in and try again.',
  'sovrium.apiKeys.empty': 'You have no API keys yet.',
  'sovrium.apiKeys.emptyBody': 'Create one to let a script or a scheduled job call the API as you.',
  'sovrium.apiKeys.list': 'Your API keys',
  'sovrium.apiKeys.loadFailed': 'Your API keys couldn’t load.',
  'sovrium.apiKeys.loading': 'Loading your keys…',
  'sovrium.apiKeys.nameHint':
    'Name it after the job that will use it — that name is how you will recognise it later.',
  'sovrium.apiKeys.newKey': 'Your new API key',
  'sovrium.commandPalette.commandPlaceholder': 'Type a command or search…',
  'sovrium.commandPalette.searchAll': 'Search all your data',
  'sovrium.commandPalette.startTyping':
    'Start typing to search records, submissions, files, automations and users.',
  'sovrium.component.configHint': 'Add it to this component in your app config, then redeploy.',
  'sovrium.component.refreshToRetry': 'Refresh the page to try again.',
  'sovrium.csvImport.drop': 'Drag and drop a CSV file here',
  'sovrium.datatable.createFailed': 'Couldn’t save the record. Try again.',
  'sovrium.datatable.loadFailedIn': '{table} couldn’t load.',
  'sovrium.dialog.typeToConfirm': 'To confirm, type “{text}”',
  'sovrium.dialog.typeToConfirmAsked': 'To confirm, type the text asked for',
  'sovrium.filePreview.cannotShow': '{name} cannot be shown here. Download it to open it.',
  'sovrium.fileUpload.dropPrompt': 'Drop files here',
  'sovrium.form.confirmPrompt': 'Are you sure?',
  'sovrium.form.dropFiles': 'Drop files here or click to browse',
  'sovrium.form.selectUser': 'Select a user...',
  'sovrium.form.uploadFailed': 'The file couldn’t upload. Try again.',
  'sovrium.form.uploadTypeRefused': 'This file type isn’t allowed. Choose another file.',
  'sovrium.rateLimit.message': 'Too many requests. Wait a moment, then retry.',
  'sovrium.rateLimit.retryIn': 'Too many requests, retry in {seconds} s.',
  'sovrium.recordDrawer.browse': 'browse',
  'sovrium.recordDrawer.dropFiles': 'Drop files or {browse}',
  'sovrium.recordDrawer.invalidJson': 'Enter valid JSON.',
  'sovrium.recordDrawer.saveRefused': 'You can’t change this record, or it no longer exists.',
  'sovrium.tree.loadFailed': '{label} couldn’t load. Reload the page to try again.',
} as const
