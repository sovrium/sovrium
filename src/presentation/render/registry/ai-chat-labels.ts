/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'

/**
 * Per-locale copy for the `ai-chat` panel's engine-written words.
 *
 * The sentence a failed turn shows, its Retry button, and the notice a host with
 * no AI provider draws are platform chrome, like the closed-form page
 * (`render/forms/form-closed-labels.ts`, whose pattern this mirrors): they follow
 * the document's language through an internal map rather than app-authored `$t:`
 * content. The engine ships English and French; any other language falls back
 * to English rather than rendering blank.
 */
export interface AiChatLabels {
  readonly failure: string
  readonly retry: string
  readonly notConfigured: string
  /** The separator closing replayed history, so new turns read as new. */
  readonly history: string
  /** On every attached file's chip: the agent receives the message text only. */
  readonly notSent: string
  /** The control that stops a streaming reply, and the marker a stopped one keeps. */
  readonly stop: string
  readonly stopped: string
  /** The collapsed marker holding the model's reasoning. */
  readonly reasoning: string
  /** The decisions on a call the agent holds, and the line saying it waits for one. */
  readonly approve: string
  readonly deny: string
  readonly awaitingApproval: string
  /** After a tool's name: the call was denied, failed, is running, or no longer waits. */
  readonly denied: string
  readonly failed: string
  readonly running: string
  readonly closed: string
  /** The words of a question the agent asks the reader, drawn as a questionnaire. */
  readonly question: AiChatQuestionLabels
  /** The group of sources an answer cites, under its bubble. */
  readonly sources: string
  /** The conversation list, and the actions in each turn's footer. */
  readonly branch: AiChatBranchLabels
  /** The composer's controls and the dictation button. */
  readonly composer: AiChatComposerLabels
  /** The transcript's accessible name, and the live marker while a reply is awaited. */
  readonly log: string
  readonly responding: string
  /** The name of the strip of suggested questions under the composer. */
  readonly suggestions: string
  /** The message box's placeholder when the author sets none. */
  readonly placeholder: string
}

/** The composer: its controls, its field's name, and push-to-talk. */
export interface AiChatComposerLabels {
  readonly send: string
  readonly attach: string
  /** The attach control's accessible name. */
  readonly attachFile: string
  readonly attachedFiles: string
  /** The message box's accessible name. */
  readonly message: string
  readonly talk: string
  readonly listening: string
  /** A recording the speech service could not read. */
  readonly voiceError: string
}

/** The conversation list and a turn's Edit, Regenerate and pager. */
export interface AiChatBranchLabels {
  readonly conversations: string
  readonly newConversation: string
  readonly edit: string
  /** The name of the text box an edited question is typed in. */
  readonly editMessage: string
  readonly saveAndSend: string
  readonly cancel: string
  readonly regenerate: string
  /** The pager between the answers to one question. */
  readonly previousAnswer: string
  readonly nextAnswer: string
  /** The pager between the versions of an edited question. */
  readonly previousVersion: string
  readonly nextVersion: string
  /** The open list while it is read, when it is empty, when it failed, and its Retry. */
  readonly loading: string
  readonly empty: string
  readonly failed: string
  readonly retry: string
  /** A conversation whose session never got a title. */
  readonly untitled: string
}

/** The questionnaire's words when the agent asks, and the line an answered question leaves. */
export interface AiChatQuestionLabels {
  readonly send: string
  readonly decline: string
  readonly next: string
  readonly previous: string
  readonly skip: string
  readonly yes: string
  readonly no: string
  /** Before the answer's values. */
  readonly answered: string
  readonly declined: string
  /** Before the name of the external MCP server asking, above its question. */
  readonly askedBy: string
  /** A question the server no longer holds, answered or dismissed elsewhere. */
  readonly closed: string
}

const EN: AiChatLabels = {
  failure: 'The assistant is unavailable.',
  retry: 'Retry',
  history: 'Earlier conversation',
  notSent: 'Not sent to the assistant',
  stop: 'Stop',
  stopped: 'Stopped',
  reasoning: 'Reasoning',
  approve: 'Approve',
  deny: 'Deny',
  awaitingApproval: 'Waiting for your approval',
  denied: 'Denied',
  failed: 'Failed',
  running: 'Running…',
  closed: 'No longer waiting for a decision. Ask again if you still need it.',
  question: {
    send: 'Send answer',
    decline: 'Decline',
    next: 'Next',
    previous: 'Previous',
    skip: 'Skip',
    yes: 'Yes',
    no: 'No',
    answered: 'Answered:',
    declined: 'Declined',
    askedBy: 'Asked by',
    closed: 'This question is closed. Ask again if you still need it.',
  },
  sources: 'Sources',
  branch: {
    conversations: 'Conversations',
    newConversation: 'New conversation',
    edit: 'Edit',
    editMessage: 'Edit message',
    saveAndSend: 'Save and send',
    cancel: 'Cancel',
    regenerate: 'Regenerate',
    previousAnswer: 'Previous answer',
    nextAnswer: 'Next answer',
    previousVersion: 'Previous version',
    nextVersion: 'Next version',
    loading: 'Loading conversations…',
    empty: 'No earlier conversations yet.',
    failed: 'Conversations could not be loaded.',
    retry: 'Retry',
    untitled: 'Untitled conversation',
  },
  composer: {
    send: 'Send',
    attach: 'Attach',
    attachFile: 'Attach file',
    attachedFiles: 'Attached files',
    message: 'Message',
    talk: 'Talk',
    listening: 'Listening…',
    voiceError: 'The recording could not be transcribed. Try again.',
  },
  log: 'Chat messages',
  responding: 'Assistant is responding',
  suggestions: 'Suggested questions',
  placeholder: 'Ask a question…',
  notConfigured:
    'AI chat is not configured here. Set AI_PROVIDER, and AI_API_KEY for a hosted provider, to turn it on.',
}

const FR: AiChatLabels = {
  failure: 'L’assistant est indisponible.',
  retry: 'Réessayer',
  history: 'Conversation précédente',
  notSent: 'Non transmis à l’assistant',
  stop: 'Arrêter',
  stopped: 'Arrêté',
  reasoning: 'Raisonnement',
  approve: 'Approuver',
  deny: 'Refuser',
  awaitingApproval: 'En attente de ton accord',
  denied: 'Refusé',
  failed: 'Échec',
  running: 'En cours…',
  closed: 'Plus en attente de décision. Redemande si tu en as encore besoin.',
  question: {
    send: 'Envoyer la réponse',
    decline: 'Refuser',
    next: 'Suivant',
    previous: 'Précédent',
    skip: 'Passer',
    yes: 'Oui',
    no: 'Non',
    answered: 'Répondu :',
    declined: 'Refusé',
    askedBy: 'Demandé par',
    closed: 'Cette question est close. Redemande si tu en as encore besoin.',
  },
  sources: 'Sources',
  branch: {
    conversations: 'Conversations',
    newConversation: 'Nouvelle conversation',
    edit: 'Modifier',
    editMessage: 'Modifier le message',
    saveAndSend: 'Enregistrer et envoyer',
    cancel: 'Annuler',
    regenerate: 'Régénérer',
    previousAnswer: 'Réponse précédente',
    nextAnswer: 'Réponse suivante',
    previousVersion: 'Version précédente',
    nextVersion: 'Version suivante',
    loading: 'Chargement des conversations…',
    empty: 'Aucune conversation pour le moment.',
    failed: 'Les conversations n’ont pas pu être chargées.',
    retry: 'Réessayer',
    untitled: 'Conversation sans titre',
  },
  composer: {
    send: 'Envoyer',
    attach: 'Joindre',
    attachFile: 'Joindre un fichier',
    attachedFiles: 'Fichiers joints',
    message: 'Message',
    talk: 'Parler',
    listening: 'À l’écoute…',
    voiceError: 'L’enregistrement n’a pas pu être transcrit. Réessaie.',
  },
  log: 'Messages du chat',
  responding: 'L’assistant répond',
  suggestions: 'Questions suggérées',
  placeholder: 'Pose une question…',
  notConfigured:
    'Le chat IA n’est pas configuré ici. Définis AI_PROVIDER, et AI_API_KEY pour un fournisseur hébergé, pour l’activer.',
}

/**
 * Locale → labels. An open `Record<string, …>` so a supported language with no
 * entry resolves to the English default via {@link getAiChatLabels}.
 */
const AI_CHAT_LABELS: Readonly<Record<string, AiChatLabels>> = {
  en: EN,
  fr: FR,
}

/**
 * Resolve the chat notices for the document language. A regional tag resolves
 * through its primary subtag (`fr-FR` → `fr`); `undefined` and any unmapped
 * language fall back to English.
 */
export const getAiChatLabels = (lang: string | undefined): AiChatLabels =>
  resolveForLanguage(AI_CHAT_LABELS, lang, EN)
