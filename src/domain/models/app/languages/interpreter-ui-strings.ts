/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Built-in catalog of INTERPRETER-provided UI strings — chrome Sovrium renders
 * itself (not app-author content). Keyed by translation key, then by 2-letter
 * language code. English is the platform default and is, word for word, the
 * literal each surface falls back to when it receives no resolved string — so
 * an English app renders exactly what it did before the key existed. An author
 * overrides any key here under the reserved {@link ENGINE_KEY_PREFIX} —
 * `languages.translations[<lang>]['sovrium.form.submit']` — so a key of the
 * author's own that shares a catalogue name never renames engine chrome (see
 * `resolveInterpreterString`).
 *
 * `{name}` marks a value substituted at render time (`fillPlaceholders`).
 *
 * The key list and its wording are ratified in the internationalization user
 * story; a string added to one of these surfaces belongs there first.
 */
export const INTERPRETER_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- Data table: create affordance and dialog / inline-editor controls ----
  'datatable.newRecord': { en: 'New record', fr: 'Nouvel enregistrement' },
  /** Create-record dialog footer + inline editor commit (data-table island). */
  'datatable.save': { en: 'Save', fr: 'Enregistrer' },
  /**
   * Create-record dialog footer + inline-editor dismissal.
   *
   * NOT the destructive confirm gate — that has its own `confirmGate.*` keys
   * below, so an author can rename "cancel the edit I was making" without also
   * renaming "do not delete this record". The two read alike and mean different
   * things; sharing one key would leave the second un-nameable.
   */
  'datatable.cancel': { en: 'Cancel', fr: 'Annuler' },

  // ---- Data table: toolbar ----
  'datatable.import': { en: 'Import', fr: 'Importer' },
  'datatable.filter': { en: 'Filter', fr: 'Filtrer' },
  'datatable.sort': { en: 'Sort', fr: 'Trier' },
  'datatable.columns': { en: 'Columns', fr: 'Colonnes' },
  'datatable.export': { en: 'Export', fr: 'Exporter' },
  'datatable.exportSelected': { en: 'Export selected', fr: 'Exporter la sélection' },
  'datatable.refresh': { en: 'Refresh', fr: 'Actualiser' },
  'datatable.density': { en: 'Density', fr: 'Densité' },
  'datatable.group': { en: 'Group', fr: 'Regrouper' },
  'datatable.groupNone': { en: 'None', fr: 'Aucun' },
  'datatable.settings': { en: 'Settings', fr: 'Paramètres' },
  'datatable.saveView': { en: 'Save view', fr: 'Enregistrer la vue' },
  'datatable.views': { en: 'Views', fr: 'Vues' },
  'datatable.viewGrid': { en: 'Grid', fr: 'Grille' },
  'datatable.viewCalendar': { en: 'Calendar', fr: 'Calendrier' },
  'datatable.addRow': { en: 'New row', fr: 'Nouvelle ligne' },
  /** The toolbar search box's placeholder, when the author declares none. */
  'datatable.search': { en: 'Search...', fr: 'Rechercher…' },
  /** The toolbar search box's accessible name, when the author declares no placeholder. */
  'datatable.searchLabel': { en: 'Search', fr: 'Rechercher' },

  // ---- Data table: pager ----
  'datatable.pagination.range': { en: '{from}–{to} of {total}', fr: '{from}–{to} sur {total}' },
  'datatable.pagination.empty': { en: 'No results', fr: 'Aucun résultat' },
  'datatable.pagination.page': { en: 'Page {page} of {count}', fr: 'Page {page} sur {count}' },
  'datatable.pagination.previous': { en: 'Previous', fr: 'Précédent' },
  'datatable.pagination.previousLabel': { en: 'Previous page', fr: 'Page précédente' },
  'datatable.pagination.next': { en: 'Next', fr: 'Suivant' },
  'datatable.pagination.nextLabel': { en: 'Next page', fr: 'Page suivante' },
  'datatable.pagination.pageSize': { en: '{size} / page', fr: '{size} / page' },
  'datatable.pagination.pageSizeLabel': { en: 'Page size', fr: 'Lignes par page' },

  // ---- Forms ----
  'form.create': { en: 'Create', fr: 'Créer' },
  'form.update': { en: 'Update', fr: 'Mettre à jour' },
  /** A hosted form's submit button when `display.submitLabel` is not declared. */
  'form.submit': { en: 'Submit', fr: 'Envoyer' },
  'form.saving': { en: 'Saving...', fr: 'Enregistrement…' },
  'form.required': { en: 'This field is required', fr: 'Ce champ est obligatoire' },
  'form.requiredNamed': { en: '{label} is required', fr: 'Le champ {label} est obligatoire' },
  /** A hosted form's default `onError` message. */
  'form.submissionFailed': { en: 'Submission failed.', fr: "L'envoi a échoué." },
  'form.operationFailed': { en: 'Operation failed', fr: "L'opération a échoué" },
  /** The Clear control's visible text (edit form and editable drawer). */
  'form.clear': { en: 'Clear', fr: 'Effacer' },
  /** The edit form's Clear control, accessible name. */
  'form.clearNamed': { en: 'Clear {label}', fr: 'Effacer {label}' },

  // ---- Comments ----
  'comments.write': { en: 'Write a comment', fr: 'Écrire un commentaire' },
  'comments.placeholder': { en: 'Write a comment...', fr: 'Écrire un commentaire…' },
  'comments.submit': { en: 'Submit comment', fr: 'Publier le commentaire' },
  'comments.posting': { en: 'Posting…', fr: 'Publication…' },
  'comments.empty': { en: 'Comment cannot be empty', fr: 'Le commentaire ne peut pas être vide' },
  'comments.reply': { en: 'Reply', fr: 'Répondre' },
  'comments.replyPlaceholder': { en: 'Write a reply…', fr: 'Écrire une réponse…' },
  'comments.submitReply': { en: 'Submit reply', fr: 'Publier la réponse' },
  'comments.postingReply': { en: 'Posting reply…', fr: 'Publication de la réponse…' },
  'comments.replyEmpty': { en: 'Reply cannot be empty', fr: 'La réponse ne peut pas être vide' },
  'comments.sort': { en: 'Sort', fr: 'Trier' },
  'comments.sortLabel': { en: 'Sort comments', fr: 'Trier les commentaires' },
  'comments.newest': { en: 'Newest first', fr: "Plus récents d'abord" },
  'comments.oldest': { en: 'Oldest first', fr: "Plus anciens d'abord" },
  'comments.mention.label': { en: 'Mention someone', fr: "Mentionner quelqu'un" },
  'comments.mention.noMatches': { en: 'No matches', fr: 'Aucun résultat' },
  'comments.mention.loading': { en: 'Searching…', fr: 'Recherche…' },
  'comments.mention.loadFailed': {
    en: 'Could not load people',
    fr: 'Impossible de charger les personnes',
  },
  'comments.mention.unknownUser': { en: '@unknown user', fr: '@utilisateur inconnu' },

  // ---- Search and list ----
  /** A search box's placeholder when the author declares none. */
  'search.placeholder': { en: 'Search...', fr: 'Rechercher…' },
  'list.loading': { en: 'Loading list...', fr: 'Chargement de la liste…' },
  'list.loadFailed': {
    en: 'Failed to load list items: {error}',
    fr: 'Impossible de charger la liste : {error}',
  },

  // ---- Rate-limited records read (KPI, list, data table) ----
  'rateLimit.message': {
    en: 'Too many requests. Wait a moment, then retry.',
    fr: 'Trop de requêtes. Patientez un instant, puis réessayez.',
  },
  'rateLimit.retry': { en: 'Retry', fr: 'Réessayer' },

  // ---- Destructive confirm gate ----
  /**
   * The AFFIRM affordance. Used when the gate's `confirm` config declares no
   * `confirmLabel` and the trigger carries no text to borrow.
   */
  'confirmGate.confirm': { en: 'Confirm', fr: 'Confirmer' },
  /**
   * The DISMISS affordance. This is the string that was a hard-coded French
   * `'Annuler'` on every console confirm dialog in an app of any language,
   * rendered beside an English confirm label the author HAD supplied.
   */
  'confirmGate.cancel': { en: 'Cancel', fr: 'Annuler' },
  /** The default PROMPT, used when an action declares `confirm: true` rather than a message. */
  'confirmGate.message': { en: 'Confirm this action?', fr: 'Confirmer cette action ?' },

  // ---- Record drawer ----
  /** Default accessible name (when the author declares no title). */
  'recordDrawer.title': { en: 'Record details', fr: "Détail de l'enregistrement" },
  'recordDrawer.save': { en: 'Save', fr: 'Enregistrer' },
  /** Close affordance — an icon button, so this IS its whole name. */
  'recordDrawer.close': { en: 'Close', fr: 'Fermer' },
  /** A related section's inline create, refused by the records endpoint. */
  'recordDrawer.relatedCreateFailed': {
    en: 'The record could not be created.',
    fr: "L'enregistrement n'a pas pu être créé.",
  },
  /**
   * A drawer addressed to a record it cannot show — one that does not exist,
   * or one its reader may not read; the same words for both.
   */
  'recordDrawer.notFound': {
    en: 'This record could not be found.',
    fr: 'Cet enregistrement est introuvable.',
  },
  /** The relationship picker's clear control. */
  'recordDrawer.clearRelation': { en: 'Clear {label}', fr: 'Effacer {label}' },

  // ---- Dialog ----
  /** A dialog's header close button — an icon button, so this IS its whole name. */
  'dialog.close': { en: 'Close', fr: 'Fermer' },
  /** A dialog holding a form: the Cancel beside the form's submit. */
  'dialog.cancel': { en: 'Cancel', fr: 'Annuler' },

  // ---- Command palette: the create-record dialog ----
  /** The dialog's heading and accessible name. */
  'commandPalette.createTitle': {
    en: 'New {table} record',
    fr: 'Nouvel enregistrement dans {table}',
  },
  'commandPalette.create': { en: 'Create', fr: 'Créer' },
  'commandPalette.cancel': { en: 'Cancel', fr: 'Annuler' },
}

/**
 * The reserved prefix an author writes an engine key under:
 * `languages.translations[<lang>]['sovrium.<key>']`. A bare key is the author's
 * own vocabulary and never renames engine chrome.
 */
export const ENGINE_KEY_PREFIX = 'sovrium.'

/**
 * The keys a release read under their BARE name, before the prefix existed —
 * the whole catalogue as of 0.29.1. For these, and only these, the resolver
 * still reads the bare name when the prefixed one is absent in the same
 * language, and `sovrium validate` / the server at startup print an
 * `engine-key-unprefixed` notice for each occurrence. Every other key is read
 * under the prefix only: none ever shipped bare, so no app depends on it.
 */
export const LEGACY_BARE_ENGINE_KEYS: readonly string[] = [
  'datatable.newRecord',
  'datatable.save',
  'datatable.cancel',
  'confirmGate.confirm',
  'confirmGate.cancel',
  'confirmGate.message',
  'recordDrawer.title',
  'recordDrawer.save',
  'recordDrawer.close',
  'recordDrawer.relatedCreateFailed',
]

/** Platform default language for interpreter strings when none is resolved. */
export const DEFAULT_INTERPRETER_LANG = 'en'
