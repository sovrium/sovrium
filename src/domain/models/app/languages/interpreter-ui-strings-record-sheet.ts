/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of a record sheet's header and tabs: Previous and
 * Next through the list that opened it, the link to the record's own page, the
 * navigation's name, the record's place in the list, the tab names, and the
 * words of an attachment's drop zone. Part
 * of {@link INTERPRETER_UI_STRINGS} through the components table; kept apart
 * only so no file outgrows its ceiling. An author renames any key under
 * `sovrium.<key>`.
 */
export const RECORD_SHEET_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  /** A sheet's navigation: the step back through the list that opened it. */
  'recordDrawer.previous': { en: 'Previous', fr: 'Précédent' },
  /** A sheet's navigation: the step forward. */
  'recordDrawer.next': { en: 'Next', fr: 'Suivant' },
  /** A sheet's navigation: the link to the record's own page. */
  'recordDrawer.openFullPage': { en: 'Open full page', fr: 'Ouvrir la page complète' },
  /** The name a sheet's navigation landmark is announced by. */
  'recordDrawer.navigation': {
    en: 'Record navigation',
    fr: 'Navigation entre les enregistrements',
  },
  /** A sheet's header: where its record stands in the list that opened it. */
  'recordDrawer.position': { en: '{position} of {count}', fr: '{position} sur {count}' },
  /** A sheet's tabs: the record's fields, its history, its thread and who holds it. */
  'recordDrawer.tabDetails': { en: 'Details', fr: 'Détails' },
  'recordDrawer.tabActivity': { en: 'Activity', fr: 'Activité' },
  'recordDrawer.tabComments': { en: 'Comments', fr: 'Commentaires' },
  'recordDrawer.tabAccess': { en: 'Access', fr: 'Accès' },
  /** An attachment's drop zone; `{browse}` is the button that opens the file chooser. */
  'recordDrawer.dropFiles': {
    en: 'Drop files or {browse}',
    fr: 'Déposez des fichiers ou {browse}',
  },
  'recordDrawer.browse': { en: 'browse', fr: 'parcourez' },
  /** The families a drop zone names when its bucket takes every file of one. */
  'fileKind.image': { en: 'images', fr: 'images' },
  'fileKind.video': { en: 'videos', fr: 'vidéos' },
  'fileKind.audio': { en: 'audio', fr: 'audio' },
  'fileKind.text': { en: 'text files', fr: 'fichiers texte' },
  /** The button of a link picker that lists the linked table's records. */
  'recordDrawer.showOptions': { en: 'Show {label} options', fr: 'Afficher les options de {label}' },
  /** A save the records API refuses as not found or forbidden: the same words for both. */
  'recordDrawer.saveRefused': {
    en: 'You can’t change this record, or it no longer exists.',
    fr: 'Vous ne pouvez pas modifier cet enregistrement, ou il n’existe plus.',
  },
}
