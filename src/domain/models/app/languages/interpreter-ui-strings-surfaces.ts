/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of the last app-facing surfaces that drew English
 * words of their own: the pickers' shared words and the searchable select's
 * empty result, the grid's live notice, fill handle, refusal, editor names and
 * conflict notice (the CSV import's words are `interpreter-ui-strings-csv-import`),
 * the refusals a hosted form receives, the
 * account forms, the comment thread's controls and the presence indicator, the
 * rich-text toolbar and slash menu, the dictation button and a chart's folded
 * remainder, and the grid's new row and pickers. Part
 * of {@link INTERPRETER_UI_STRINGS} through the components table; kept apart
 * only so no file outgrows its ceiling. English is today's literal word for
 * word, French is built in, and an author renames any key under
 * `sovrium.<key>`.
 */
export const SURFACE_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- The record pickers (grid, form, standalone) and the user picker ----
  'picker.searching': { en: 'Searching…', fr: 'Recherche…' },
  'picker.noMatchingRecords': {
    en: 'No matching records',
    fr: 'Aucun enregistrement correspondant',
  },
  'picker.loadFailed': {
    en: 'Could not load records',
    fr: 'Impossible de charger les enregistrements',
  },
  'picker.unconfigured': {
    en: 'This field declares no related table',
    fr: 'Ce champ ne déclare aucune table liée',
  },
  'picker.loadMore': { en: 'Load more', fr: 'Afficher plus' },
  /** `{linked}` links out of the field's `{max}`. */
  'picker.linkCount': { en: '{linked} of {max} linked', fr: '{linked} sur {max} liés' },
  /** A paged picker's next page, `{count}` candidates still to show. */
  'picker.loadMoreCount': { en: 'Load {count} more', fr: 'Afficher {count} de plus' },
  /** A complete list: `{shown}` candidates shown out of `{total}` matching. */
  'picker.candidateCount': { en: '{shown} of {total}', fr: '{shown} sur {total}' },
  'picker.noMatchingPeople': { en: 'No matching people', fr: 'Aucune personne correspondante' },
  'picker.directoryFailed': {
    en: 'Could not load the directory',
    fr: 'Impossible de charger l’annuaire',
  },
  'select.noResults': { en: 'No results', fr: 'Aucun résultat' },

  // ---- The grid: live notice, fill handle and its refusal, editors, conflict ----
  'datatable.liveDisconnected': {
    en: 'Live updates are disconnected — reconnecting. This view may not show the latest changes.',
    fr: 'Les mises à jour en direct sont interrompues — reconnexion en cours. Cette vue peut ne pas afficher les dernières modifications.',
  },
  'datatable.fillHandle': { en: 'Drag to fill', fr: 'Faire glisser pour remplir' },
  /** `{reason}` is one refusal, as `datatable.takesNumber` words it. */
  'datatable.fillRefused': {
    en: '{reason} — that column was left unchanged.',
    fr: '{reason} — cette colonne n’a pas été modifiée.',
  },
  'datatable.dismiss': { en: 'Dismiss', fr: 'Fermer' },
  /** The new row's invitation in a picked or a written column; `{label}` is its name, lowercased. */
  'datatable.addRow.pick': { en: 'Pick {label}…', fr: 'Choisir {label}…' },
  'datatable.addRow.write': { en: 'Write {label}…', fr: 'Rédiger {label}…' },
  /** The grid's link picker: `{table}` is the linked table as configured, `{field}` its display column. */
  'datatable.picker.search': { en: 'Search {table}', fr: 'Rechercher dans {table}' },
  'datatable.picker.searchBy': { en: 'Search by {field}', fr: 'Rechercher par {field}' },
  'datatable.picker.searchPeople': { en: 'Search people', fr: 'Rechercher des personnes' },
  'datatable.picker.searchByName': { en: 'Search by name', fr: 'Rechercher par nom' },
  'datatable.picker.linkedRecords': { en: 'Linked records', fr: 'Enregistrements liés' },
  'datatable.picker.people': { en: 'People', fr: 'Personnes' },
  /** `{label}` is the column's display name. */
  'datatable.takesNumber': { en: '{label} takes a number', fr: '{label} attend un nombre' },
  'datatable.takesYesNo': { en: '{label} takes yes or no', fr: '{label} attend oui ou non' },
  /** A cell editor's name; `{field}` is the column's display name. */
  'datatable.editField': { en: 'Edit {field}', fr: 'Modifier {field}' },
  'datatable.noOptions': {
    en: 'This field declares no options to choose from',
    fr: 'Ce champ ne propose aucune option',
  },
  /** `{fields}` names the overwritten field(s); `{writer}` who wrote over them. */
  'datatable.conflict': {
    en: 'Your pending change to field {fields} was overwritten by {writer}. The latest server value is now shown.',
    fr: 'Votre modification en attente du champ {fields} a été écrasée par {writer}. La dernière valeur du serveur est maintenant affichée.',
  },
  'datatable.conflictFields': {
    en: 'Your pending change to fields {fields} was overwritten by {writer}. The latest server value is now shown.',
    fr: 'Votre modification en attente des champs {fields} a été écrasée par {writer}. La dernière valeur du serveur est maintenant affichée.',
  },
  'datatable.anotherUser': { en: 'another user', fr: 'un autre utilisateur' },
  'datatable.dismissConflict': {
    en: 'Dismiss conflict notification',
    fr: 'Fermer la notification de conflit',
  },

  // ---- A hosted form's server refusals, by the refusal's `error` slug ----
  'forms.limitReached': {
    en: 'This form has reached its submission limit',
    fr: 'Ce formulaire a atteint son nombre maximal de réponses.',
  },
  'forms.closed': {
    en: 'This form is no longer accepting submissions',
    fr: 'Ce formulaire n’accepte plus de réponses.',
  },
  'forms.notYetOpen': {
    en: 'This form is not accepting submissions yet',
    fr: 'Ce formulaire n’accepte pas encore de réponses.',
  },
  'forms.rateLimited': {
    en: 'Too many submissions — try again shortly',
    fr: 'Trop d’envois — réessayez dans quelques instants.',
  },
  'forms.rejected': { en: 'This submission was rejected', fr: 'Cet envoi a été refusé.' },

  // ---- The account forms: second step, a new key, a mailed link ----
  'auth.trustDevice': { en: 'Trust this device', fr: 'Faire confiance à cet appareil' },
  'auth.recoveryCode': { en: 'Recovery code', fr: 'Code de récupération' },
  'auth.keyName': { en: 'Name', fr: 'Nom' },
  'auth.resetSent': {
    en: 'Check your email — a reset link has been sent',
    fr: 'Vérifiez vos e-mails — un lien de réinitialisation vous a été envoyé',
  },
  'auth.magicLinkSent': {
    en: 'Check your email — a sign-in link has been sent',
    fr: 'Vérifiez vos e-mails — un lien de connexion vous a été envoyé',
  },
  'apiKeys.copyOnce': {
    en: 'Copy this key now — it will not be shown again.',
    fr: 'Copiez cette clé maintenant — elle ne sera plus affichée.',
  },
  'apiKeys.copiedConfirm': { en: 'I have copied this key', fr: 'J’ai copié cette clé' },

  // ---- The comment thread's own controls, and who is reading the page ----
  'comments.edit': { en: 'Edit', fr: 'Modifier' },
  'comments.delete': { en: 'Delete', fr: 'Supprimer' },
  'comments.editLabel': { en: 'Edit comment', fr: 'Modifier le commentaire' },
  'comments.save': { en: 'Save', fr: 'Enregistrer' },
  'comments.cancel': { en: 'Cancel', fr: 'Annuler' },
  'comments.confirm': { en: 'Confirm', fr: 'Confirmer' },
  'comments.deleteLabel': { en: 'Delete comment', fr: 'Supprimer le commentaire' },
  /** `{author}` is the comment's author, as the thread names them. */
  'comments.deleteQuestion': {
    en: 'Are you sure you want to delete this comment by {author}?',
    fr: 'Voulez-vous vraiment supprimer ce commentaire de {author} ?',
  },
  'comments.oneReply': { en: '1 reply', fr: '1 réponse' },
  'comments.replies': { en: '{count} replies', fr: '{count} réponses' },
  'comments.anonymous': { en: 'Anonymous', fr: 'Anonyme' },
  /** The guest form's labels, the empty thread with no `emptyText` and the thread's accessible name. */
  'comments.guestName': { en: 'Name', fr: 'Nom' },
  'comments.guestEmail': { en: 'Email', fr: 'E-mail' },
  'comments.guestComment': { en: 'Comment', fr: 'Commentaire' },
  'comments.noComments': { en: 'No comments yet', fr: 'Aucun commentaire pour le moment' },
  'comments.sectionLabel': { en: 'Comments', fr: 'Commentaires' },
  'presence.label': { en: 'Users viewing this page', fr: 'Personnes consultant cette page' },

  // ---- The rich-text toolbar, its link prompt and its slash menu ----
  'richText.toolbar': { en: 'Formatting', fr: 'Mise en forme' },
  'richText.bold': { en: 'Bold', fr: 'Gras' },
  'richText.italic': { en: 'Italic', fr: 'Italique' },
  'richText.strike': { en: 'Strikethrough', fr: 'Barré' },
  'richText.heading': { en: 'Heading', fr: 'Titre' },
  'richText.bulletList': { en: 'Bullet list', fr: 'Liste à puces' },
  'richText.orderedList': { en: 'Ordered list', fr: 'Liste numérotée' },
  'richText.codeBlock': { en: 'Code block', fr: 'Bloc de code' },
  'richText.blockquote': { en: 'Blockquote', fr: 'Citation' },
  'richText.link': { en: 'Link', fr: 'Lien' },
  'richText.image': { en: 'Insert image', fr: 'Insérer une image' },
  'richText.table': { en: 'Insert table', fr: 'Insérer un tableau' },
  'richText.rule': { en: 'Horizontal rule', fr: 'Ligne horizontale' },
  'richText.linkPrompt': { en: 'URL', fr: 'Adresse du lien' },
  'richText.noMatches': { en: 'No matches', fr: 'Aucun résultat' },
  /** The slash menu's own entries; its other entries are named as the toolbar names them. */
  'richText.slash.image': { en: 'Image', fr: 'Image' },
  'richText.slash.table': { en: 'Table', fr: 'Tableau' },
  /** `{max}` is the field's `maxLength`. */
  'richText.overLimit': {
    en: 'Content exceeds maximum of {max} characters',
    fr: 'Le contenu dépasse la limite de {max} caractères',
  },

  // ---- A chart's folded remainder, when the author named none ----
  'chart.other': { en: 'Other', fr: 'Autres' },
}
