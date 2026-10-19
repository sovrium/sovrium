/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AI_CHAT_UI_STRINGS } from './interpreter-ui-strings-ai-chat'
import { CONSOLE_UI_STRINGS } from './interpreter-ui-strings-console'
import { CONTROL_UI_STRINGS } from './interpreter-ui-strings-controls'
import { RECORD_SHEET_UI_STRINGS } from './interpreter-ui-strings-record-sheet'
import { SURFACE_UI_STRINGS } from './interpreter-ui-strings-surfaces'

/**
 * The interpreter strings of the page components that draw their own states —
 * empty, failed, unreadable — and of the controls that carry their own words:
 * the tree, the signature pad, the file upload, a button field's outcome, the
 * matrix and the graph, the `ai-chat` panel and the console's conversation
 * list. Part of {@link INTERPRETER_UI_STRINGS}, which spreads this table in;
 * kept apart only so neither file outgrows its ceiling. The contract is the
 * catalogue's: English is today's literal word for word, French is built in,
 * and an author renames any key under `sovrium.<key>`.
 */
export const COMPONENT_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- A record sheet whose read failed — refused, or the server unreachable ----
  'recordDrawer.readFailed': {
    en: 'This record couldn’t be read.',
    fr: 'Cet enregistrement n’a pas pu être lu.',
  },
  // ---- A data component with no record to draw and no authored `emptyMessage` ----
  'chart.empty': { en: 'No data to chart yet.', fr: 'Aucune donnée à afficher pour l’instant.' },
  'chart.emptyHint': {
    en: "Records matching this chart's data source will appear here.",
    fr: 'Les enregistrements correspondant à la source de données de ce graphique s’afficheront ici.',
  },
  'gallery.empty': { en: 'No records yet.', fr: 'Aucun enregistrement pour l’instant.' },
  'gallery.emptyHint': {
    en: 'Records added to this table will appear here.',
    fr: 'Les enregistrements ajoutés à cette table s’afficheront ici.',
  },
  'timeline.empty': {
    en: 'No records on the timeline yet.',
    fr: 'Aucun enregistrement sur la frise pour l’instant.',
  },
  'timeline.emptyHint': {
    en: 'Records with a value in the configured date field will appear here.',
    fr: 'Les enregistrements ayant une valeur dans le champ de date configuré s’afficheront ici.',
  },

  // ---- Tree: `{label}` is the tree's accessible name (lowercased in the filter's name) ----
  'tree.label': { en: 'Tree', fr: 'Arborescence' },
  /** The default name where a sentence carries it mid-way, as a common noun. */
  'tree.labelInSentence': { en: 'Tree', fr: 'l’arborescence' },
  'tree.loading': { en: 'Loading…', fr: 'Chargement…' },
  'tree.empty': { en: 'Nothing here yet.', fr: 'Rien à afficher pour l’instant.' },
  'tree.loadFailed': {
    en: '{label} could not be loaded. Refresh to try again.',
    fr: 'Impossible de charger {label}. Actualisez la page pour réessayer.',
  },
  'tree.filter': { en: 'Filter', fr: 'Filtrer' },
  'tree.filterLabel': { en: 'Filter {label}', fr: 'Filtrer {label}' },

  // ---- Matrix and graph: a read that failed, or failed in part, and nothing to draw ----
  'matrix.unavailable': {
    en: 'This grid could not be read.',
    fr: 'Impossible de lire cette grille.',
  },
  'matrix.degraded': {
    en: 'Some sources could not be read: {sources}',
    fr: 'Certaines sources n’ont pas pu être lues : {sources}',
  },
  'matrix.empty': { en: 'Nothing to show.', fr: 'Rien à afficher.' },
  'matrix.truncated': {
    en: 'This grid is larger than the renderer draws whole; some rows or columns are not shown.',
    fr: 'Cette grille est trop grande pour être affichée en entier ; certaines lignes ou colonnes sont masquées.',
  },
  /** The accessible twin's column headings. */
  'matrix.resource': { en: 'Resource', fr: 'Ressource' },
  'matrix.grantSource': { en: 'Grant source', fr: 'Origine de l’accès' },
  'matrix.operations': { en: 'Operations', fr: 'Opérations' },
  'matrix.note': { en: 'Note', fr: 'Remarque' },
  'graph.unavailable': { en: 'This map could not be read.', fr: 'Impossible de lire cette carte.' },
  'graph.degraded': {
    en: 'Some sources could not be read: {sources}',
    fr: 'Certaines sources n’ont pas pu être lues : {sources}',
  },
  'graph.empty': { en: 'Nothing to show.', fr: 'Rien à afficher.' },
  /** The accessible twin's column headings. */
  'graph.node': { en: 'Node', fr: 'Élément' },
  'graph.kind': { en: 'Kind', fr: 'Type' },
  'graph.column': { en: 'Column', fr: 'Colonne' },
  'graph.group': { en: 'Group', fr: 'Groupe' },
  'graph.detail': { en: 'Detail', fr: 'Détail' },
  'graph.reaches': { en: 'Reaches', fr: 'Atteint' },

  // ---- Signature pad: `{name}` signed on `{date}`, a day already in the page language ----
  'signaturePad.label': { en: 'Signature', fr: 'Signature' },
  'signaturePad.well': {
    en: 'Signing well: draw your signature',
    fr: 'Zone de signature : dessinez votre signature',
  },
  'signaturePad.fullName': { en: 'Full name', fr: 'Nom complet' },
  'signaturePad.clear': { en: 'Clear', fr: 'Effacer' },
  'signaturePad.typeInstead': { en: 'Type your name instead', fr: 'Saisir mon nom plutôt' },
  'signaturePad.drawInstead': { en: 'Draw instead', fr: 'Dessiner plutôt' },
  'signaturePad.sign': { en: 'Sign', fr: 'Signer' },
  'signaturePad.signing': { en: 'Signing…', fr: 'Signature en cours…' },
  'signaturePad.saveFailed': {
    en: 'The signature could not be saved. Check the connection and sign again.',
    fr: 'La signature n’a pas pu être enregistrée. Vérifiez la connexion et signez à nouveau.',
  },
  'signaturePad.signedBy': { en: 'Signed by {name} on {date}', fr: 'Signé par {name} le {date}' },
  'signaturePad.unknownSigner': { en: 'an unknown signer', fr: 'un signataire inconnu' },
  'signaturePad.unknownDate': { en: 'an unknown date', fr: 'une date inconnue' },

  // ---- File upload: the button with no `label`, the drop zone, its limits and refusals ----
  'fileUpload.button': { en: 'Upload file', fr: 'Envoyer un fichier' },
  'fileUpload.dropPrompt': { en: 'Drop files here', fr: 'Déposez des fichiers ici' },
  'fileUpload.browse': { en: 'Browse files', fr: 'Parcourir les fichiers' },
  'fileUpload.maxOneFile': { en: 'up to 1 file', fr: 'jusqu’à 1 fichier' },
  'fileUpload.maxFiles': { en: 'up to {count} files', fr: 'jusqu’à {count} fichiers' },
  'fileUpload.sizeEach': { en: '{size} each', fr: '{size} chacun' },
  'fileUpload.tooMany': {
    en: 'Too many files (max {count})',
    fr: 'Trop de fichiers (maximum {count})',
  },
  'fileUpload.tooLarge': {
    en: 'File "{name}" is too large — size limit is {limit}MB',
    fr: 'Le fichier « {name} » est trop volumineux — la limite est de {limit} Mo',
  },

  // ---- A password field that sets a password: its rule, and a refusal about it ----
  'password.minLength': { en: 'At least {count} characters', fr: 'Au moins {count} caractères' },
  'password.incorrect': {
    en: 'The current password is incorrect',
    fr: 'Le mot de passe actuel est incorrect',
  },

  // ---- A button field's automation run, told in a toast ----
  'action.completed': { en: 'Action completed.', fr: 'Action terminée.' },
  /** A denial or an absent record: the same words for both, as the API answers. */
  'action.unavailable': {
    en: 'This action is not available on this record.',
    fr: 'Cette action n’est pas disponible sur cet enregistrement.',
  },
  'action.unfinished': {
    en: 'The action ran but did not complete.',
    fr: 'L’action a été lancée mais ne s’est pas terminée.',
  },
  'action.unreachable': {
    en: 'The action could not be run. Try again.',
    fr: 'L’action n’a pas pu être exécutée. Réessayez.',
  },

  // ---- The console's conversation list: loading, a failed read, none yet, no match ----
  'agentConversations.loading': { en: 'Loading conversations', fr: 'Chargement des conversations' },
  'agentConversations.loadFailedLabel': { en: 'Couldn’t load', fr: 'Échec du chargement' },
  'agentConversations.loadFailed': {
    en: 'Couldn’t load conversations',
    fr: 'Impossible de charger les conversations',
  },
  'agentConversations.loadFailedBody': {
    en: 'The list could not be loaded. Try again.',
    fr: 'La liste n’a pas pu être chargée. Réessayez.',
  },
  'agentConversations.retry': { en: 'Retry', fr: 'Réessayer' },
  'agentConversations.empty': {
    en: 'No conversations yet',
    fr: 'Aucune conversation pour l’instant',
  },
  'agentConversations.emptyBody': {
    en: 'Conversations appear here once a user talks to this agent.',
    fr: 'Les conversations apparaissent ici dès qu’un utilisateur parle à cet agent.',
  },
  'agentConversations.noMatchLabel': { en: 'No results', fr: 'Aucun résultat' },
  'agentConversations.noMatch': {
    en: 'No conversation matches',
    fr: 'Aucune conversation ne correspond',
  },
  'agentConversations.noMatchBody': {
    en: 'No conversation matches “{query}”.',
    fr: 'Aucune conversation ne correspond à « {query} ».',
  },
  'agentConversations.reset': { en: 'Reset', fr: 'Réinitialiser' },
  /** The thread beside the list: nothing picked yet, loading, a failed read. */
  'agentConversations.idleLabel': {
    en: 'No conversation selected',
    fr: 'Aucune conversation choisie',
  },
  'agentConversations.idle': { en: 'Select a conversation', fr: 'Choisissez une conversation' },
  'agentConversations.idleBody': {
    en: 'Pick one from the list to read its messages.',
    fr: 'Choisissez-en une dans la liste pour lire ses messages.',
  },
  'agentConversations.threadLoading': {
    en: 'Loading conversation',
    fr: 'Chargement de la conversation',
  },
  'agentConversations.threadFailed': {
    en: 'Couldn’t load the conversation',
    fr: 'Impossible de charger la conversation',
  },
  'agentConversations.threadFailedBody': {
    en: 'The messages could not be loaded. Try again.',
    fr: 'Les messages n’ont pas pu être chargés. Réessayez.',
  },
  ...AI_CHAT_UI_STRINGS,
  ...CONTROL_UI_STRINGS,
  ...CONSOLE_UI_STRINGS,
  ...RECORD_SHEET_UI_STRINGS,
  ...SURFACE_UI_STRINGS,
}
