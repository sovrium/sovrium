/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `ai-chat` panel's own words — a failed turn and its Retry, the notice a
 * host with no AI provider draws, the composer, the conversation list, the
 * approval and question controls — under `aiChat.*`, a dot for each group
 * (`aiChat.composer.send`, `aiChat.branch.retry`). Part of the interpreter
 * catalogue: English is the default, French is built in, and an author renames
 * any of them under `sovrium.aiChat.<key>`. The panel addresses its reader
 * as « vous » in French (« Posez une question… »), as the rest of the catalogue
 * does.
 */
export const AI_CHAT_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'aiChat.failure': { en: 'The assistant is unavailable.', fr: 'L’assistant est indisponible.' },
  'aiChat.retry': { en: 'Retry', fr: 'Réessayer' },
  'aiChat.history': { en: 'Earlier conversation', fr: 'Conversation précédente' },
  'aiChat.notSent': { en: 'Not sent to the assistant', fr: 'Non transmis à l’assistant' },
  'aiChat.stop': { en: 'Stop', fr: 'Arrêter' },
  'aiChat.stopped': { en: 'Stopped', fr: 'Arrêté' },
  'aiChat.reasoning': { en: 'Reasoning', fr: 'Raisonnement' },
  'aiChat.input': { en: 'Input', fr: 'Entrée' },
  'aiChat.output': { en: 'Output', fr: 'Sortie' },
  'aiChat.truncated': {
    en: 'Showing the first 2,000 characters',
    fr: 'Seuls les 2\u202f000 premiers caractères sont affichés',
  },
  'aiChat.approve': { en: 'Approve', fr: 'Approuver' },
  'aiChat.deny': { en: 'Deny', fr: 'Refuser' },
  'aiChat.awaitingApproval': { en: 'Waiting for your approval', fr: 'En attente de votre accord' },
  'aiChat.denied': { en: 'Denied', fr: 'Refusé' },
  'aiChat.failed': { en: 'Failed', fr: 'Échec' },
  'aiChat.running': { en: 'Running…', fr: 'En cours…' },
  'aiChat.closed': {
    en: 'No longer waiting for a decision. Ask again if you still need it.',
    fr: 'Plus en attente de décision. Redemandez si vous en avez encore besoin.',
  },
  'aiChat.question.send': { en: 'Send answer', fr: 'Envoyer la réponse' },
  'aiChat.question.decline': { en: 'Decline', fr: 'Refuser' },
  'aiChat.question.next': { en: 'Next', fr: 'Suivant' },
  'aiChat.question.previous': { en: 'Previous', fr: 'Précédent' },
  'aiChat.question.skip': { en: 'Skip', fr: 'Passer' },
  'aiChat.question.yes': { en: 'Yes', fr: 'Oui' },
  'aiChat.question.no': { en: 'No', fr: 'Non' },
  'aiChat.question.answered': { en: 'Answered:', fr: 'Répondu :' },
  'aiChat.question.declined': { en: 'Declined', fr: 'Refusé' },
  'aiChat.question.askedBy': { en: 'Asked by', fr: 'Demandé par' },
  'aiChat.question.closed': {
    en: 'This question is closed. Ask again if you still need it.',
    fr: 'Cette question est close. Redemandez si vous en avez encore besoin.',
  },
  'aiChat.sources': { en: 'Sources', fr: 'Sources' },
  'aiChat.usageTotal': { en: '{count} tokens', fr: '{count} jetons' },
  'aiChat.usageInput': { en: '{count} input', fr: '{count} en entrée' },
  'aiChat.usageOutput': { en: '{count} output', fr: '{count} en sortie' },
  'aiChat.branch.conversations': { en: 'Conversations', fr: 'Conversations' },
  'aiChat.branch.newConversation': { en: 'New conversation', fr: 'Nouvelle conversation' },
  'aiChat.branch.edit': { en: 'Edit', fr: 'Modifier' },
  'aiChat.branch.editMessage': { en: 'Edit message', fr: 'Modifier le message' },
  'aiChat.branch.saveAndSend': { en: 'Save and send', fr: 'Enregistrer et envoyer' },
  'aiChat.branch.cancel': { en: 'Cancel', fr: 'Annuler' },
  'aiChat.branch.regenerate': { en: 'Regenerate', fr: 'Régénérer' },
  'aiChat.branch.previousAnswer': { en: 'Previous answer', fr: 'Réponse précédente' },
  'aiChat.branch.nextAnswer': { en: 'Next answer', fr: 'Réponse suivante' },
  'aiChat.branch.previousVersion': { en: 'Previous version', fr: 'Version précédente' },
  'aiChat.branch.nextVersion': { en: 'Next version', fr: 'Version suivante' },
  'aiChat.branch.loading': { en: 'Loading conversations…', fr: 'Chargement des conversations…' },
  'aiChat.branch.empty': {
    en: 'No earlier conversations yet.',
    fr: 'Aucune conversation pour le moment.',
  },
  'aiChat.branch.failed': {
    en: 'Conversations could not be loaded.',
    fr: 'Les conversations n’ont pas pu être chargées.',
  },
  'aiChat.branch.retry': { en: 'Retry', fr: 'Réessayer' },
  'aiChat.branch.untitled': { en: 'Untitled conversation', fr: 'Conversation sans titre' },
  'aiChat.composer.send': { en: 'Send', fr: 'Envoyer' },
  'aiChat.composer.attach': { en: 'Attach', fr: 'Joindre' },
  'aiChat.composer.attachFile': { en: 'Attach file', fr: 'Joindre un fichier' },
  'aiChat.composer.attachedFiles': { en: 'Attached files', fr: 'Fichiers joints' },
  'aiChat.composer.message': { en: 'Message', fr: 'Message' },
  'aiChat.composer.talk': { en: 'Talk', fr: 'Parler' },
  'aiChat.composer.listening': { en: 'Listening…', fr: 'À l’écoute…' },
  'aiChat.composer.voiceError': {
    en: 'The recording could not be transcribed. Try again.',
    fr: 'L’enregistrement n’a pas pu être transcrit. Réessayez.',
  },
  /** The dictation button's accessible name, and why it could not start recording. */
  'aiChat.composer.holdToTalk': { en: 'Hold to talk', fr: 'Maintenir pour parler' },
  'aiChat.composer.micUnsupported': {
    en: 'This browser cannot record from a microphone.',
    fr: 'Ce navigateur ne peut pas enregistrer depuis un micro.',
  },
  'aiChat.composer.micRefused': {
    en: 'Microphone access was refused.',
    fr: 'L’accès au micro a été refusé.',
  },
  'aiChat.log': { en: 'Chat messages', fr: 'Messages du chat' },
  'aiChat.responding': { en: 'Assistant is responding', fr: 'L’assistant répond' },
  'aiChat.suggestions': { en: 'Suggested questions', fr: 'Questions suggérées' },
  'aiChat.placeholder': { en: 'Ask a question…', fr: 'Posez une question…' },
  'aiChat.notConfigured': {
    en: 'AI chat is not configured here. Set AI_PROVIDER, and AI_API_KEY for a hosted provider, to turn it on.',
    fr: 'Le chat IA n’est pas configuré ici. Définissez AI_PROVIDER, et AI_API_KEY pour un fournisseur hébergé, pour l’activer.',
  },
}
