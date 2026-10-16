/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of the controls that carry their own words: the
 * passkey, SSO and account-link forms, a hosted form's drop zone, user picker
 * and save bar, a record form's upload and delete states, the map, a kanban
 * column, the ⌘K palette, the date pickers, a typed confirmation, the split
 * pane, the record picker, the searchable select, the sidebar's empty list and
 * a chart's name when it has no title. Part of {@link INTERPRETER_UI_STRINGS}
 * through the components table; kept apart only so no file outgrows its
 * ceiling. English is today's literal word for word, French is built in, and
 * an author renames any key under `sovrium.<key>`.
 */
export const CONTROL_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- Passkey, SSO and account-link forms: what each one reports ----
  'passkey.added': { en: 'Passkey added', fr: 'Clé d’accès ajoutée' },
  'passkey.addFailed': {
    en: 'The passkey was not added. Please try again.',
    fr: 'La clé d’accès n’a pas été ajoutée. Veuillez réessayer.',
  },
  'passkey.signInFailed': {
    en: 'Sign in with a passkey failed. Please try again.',
    fr: 'La connexion avec une clé d’accès a échoué. Veuillez réessayer.',
  },
  'passkey.unsupported': {
    en: 'This browser cannot use passkeys.',
    fr: 'Ce navigateur ne prend pas en charge les clés d’accès.',
  },
  'sso.workEmail': { en: 'Work email', fr: 'E-mail professionnel' },
  'sso.continue': { en: 'Continue', fr: 'Continuer' },
  'sso.enterWorkEmail': {
    en: 'Enter your work email address.',
    fr: 'Saisissez votre adresse e-mail professionnelle.',
  },
  /** `{domain}` is the part of the address after the `@`. */
  'sso.noProvider': {
    en: 'No sign-in provider is set up for {domain}.',
    fr: 'Aucun fournisseur de connexion n’est configuré pour {domain}.',
  },
  'sso.signInFailed': {
    en: 'Sign in failed. Please try again.',
    fr: 'La connexion a échoué. Veuillez réessayer.',
  },
  'accountLink.failed': { en: 'Request failed', fr: 'La demande a échoué' },

  // ---- Hosted and record forms: drop zone, user picker, save bar, uploads, delete ----
  'form.dropFiles': {
    en: 'Drop files here or click to browse',
    fr: 'Déposez des fichiers ici ou cliquez pour parcourir',
  },
  'form.selectUser': { en: 'Select a user...', fr: 'Choisissez un utilisateur…' },
  'form.noUnsavedChanges': { en: 'No unsaved changes', fr: 'Aucune modification non enregistrée' },
  /** `{count}` is the number of fields changed: one, then several. */
  'form.unsavedChange': {
    en: '{count} unsaved change',
    fr: '{count} modification non enregistrée',
  },
  'form.unsavedChanges': {
    en: '{count} unsaved changes',
    fr: '{count} modifications non enregistrées',
  },
  'form.discard': { en: 'Discard', fr: 'Annuler les modifications' },
  /** A hosted form's default success toast. */
  'form.submitted': { en: 'Submitted.', fr: 'Envoyé.' },
  'form.uploading': { en: 'Uploading…', fr: 'Envoi en cours…' },
  'form.uploadComplete': { en: 'Upload complete', fr: 'Envoi terminé' },
  'form.uploadFailed': {
    en: 'File upload failed. Please try again.',
    fr: 'L’envoi du fichier a échoué. Veuillez réessayer.',
  },
  /** A record form's file field refusing a pick: `{size}` in megabytes, `{count}` files. */
  'form.uploadTypeRefused': {
    en: 'File type not allowed. Please choose a valid file.',
    fr: 'Ce type de fichier n’est pas autorisé. Choisissez un fichier valide.',
  },
  'form.uploadTooLarge': {
    en: 'File size exceeds the maximum of {size} MB.',
    fr: 'Le fichier dépasse la taille maximale de {size} Mo.',
  },
  'form.uploadTooMany': {
    en: 'Too many files — the maximum allowed is {count}.',
    fr: 'Trop de fichiers : le maximum autorisé est de {count}.',
  },
  'form.recordDeleted': {
    en: 'This record has been deleted.',
    fr: 'Cet enregistrement a été supprimé.',
  },
  'form.confirmPrompt': { en: 'Are you sure?', fr: 'Voulez-vous vraiment continuer ?' },
  /** `{label}` is the action's own label, as its button reads. */
  'form.confirmNamed': { en: 'Confirm {label}', fr: 'Confirmer : {label}' },
  'form.cancel': { en: 'Cancel', fr: 'Annuler' },

  // ---- Map: the tiles' corner line, the zoom controls and the list twin ----
  'map.label': { en: 'Map', fr: 'Carte' },
  'map.empty': { en: 'No locations to show.', fr: 'Aucun lieu à afficher.' },
  'map.noTiles': { en: 'No map tiles configured', fr: 'Aucun fond de carte configuré' },
  'map.tiles': { en: 'Map tiles', fr: 'Fond de carte' },
  'map.zoomIn': { en: 'Zoom in', fr: 'Zoom avant' },
  'map.zoomOut': { en: 'Zoom out', fr: 'Zoom arrière' },
  'map.locations': { en: 'Locations', fr: 'Lieux' },
  'map.open': { en: 'Open', fr: 'Ouvrir' },
  'map.close': { en: 'Close', fr: 'Fermer' },

  // ---- Kanban: a column with no card ----
  'kanban.empty': { en: 'No records', fr: 'Aucun enregistrement' },
  'kanban.loadMore': { en: 'Load More', fr: 'Charger plus' },
  'kanban.loaded': { en: '{loaded} of {total} loaded', fr: '{loaded} sur {total} chargés' },

  // ---- The ⌘K palette: its name, its search fields, its groups and its own actions ----
  'commandPalette.title': { en: 'Command palette', fr: 'Palette de commandes' },
  'commandPalette.search': { en: 'Search', fr: 'Rechercher' },
  'commandPalette.searchPlaceholder': { en: 'Search…', fr: 'Rechercher…' },
  'commandPalette.searchAll': {
    en: 'Search all your data',
    fr: 'Rechercher dans toutes vos données',
  },
  'commandPalette.commandPlaceholder': {
    en: 'Type a command or search…',
    fr: 'Saisissez une commande ou recherchez…',
  },
  'commandPalette.commandLabel': { en: 'Search commands', fr: 'Rechercher des commandes' },
  'commandPalette.empty': { en: 'No results found.', fr: 'Aucun résultat.' },
  'commandPalette.quickActions': { en: 'Quick actions', fr: 'Actions rapides' },
  'commandPalette.pages': { en: 'Pages', fr: 'Pages' },
  /** `{table}` is the table's plural label; `{page}` the page's title. */
  'commandPalette.createIn': {
    en: 'Create new record in {table}',
    fr: 'Créer un enregistrement dans {table}',
  },
  'commandPalette.goTo': { en: 'Go to {page}', fr: 'Aller à {page}' },
  'commandPalette.toggleDarkMode': { en: 'Toggle dark mode', fr: 'Basculer le mode sombre' },
  'commandPalette.darkModeOn': { en: 'Dark mode enabled', fr: 'Mode sombre activé' },
  'commandPalette.lightModeOn': { en: 'Light mode enabled', fr: 'Mode clair activé' },
  'commandPalette.startTyping': {
    en: 'Start typing to search records, submissions, files, automations and users.',
    fr: 'Commencez à taper pour rechercher des enregistrements, des réponses, des fichiers, des automatisations et des utilisateurs.',
  },
  'commandPalette.searching': { en: 'Searching…', fr: 'Recherche en cours…' },
  /** `{query}` is what the reader typed. */
  'commandPalette.noResultsFor': {
    en: 'No results for “{query}”',
    fr: 'Aucun résultat pour « {query} »',
  },

  // ---- Date pickers: the trigger with no label and the panel's name ----
  'datePicker.pick': { en: 'Pick a date', fr: 'Choisir une date' },
  'datePicker.choose': { en: 'Choose date', fr: 'Choisir la date' },
  'dateRangePicker.pick': { en: 'Pick a period', fr: 'Choisir une période' },
  'dateRangePicker.choose': { en: 'Choose a period', fr: 'Choisir la période' },
  /** The named periods down the left of the open panel. */
  'dateRangePicker.preset.today': { en: 'Today', fr: 'Aujourd’hui' },
  'dateRangePicker.preset.yesterday': { en: 'Yesterday', fr: 'Hier' },
  'dateRangePicker.preset.last-7-days': { en: 'Last 7 days', fr: '7 derniers jours' },
  'dateRangePicker.preset.last-30-days': { en: 'Last 30 days', fr: '30 derniers jours' },
  'dateRangePicker.preset.this-month': { en: 'This month', fr: 'Ce mois-ci' },
  'dateRangePicker.preset.last-month': { en: 'Last month', fr: 'Le mois dernier' },
  'dateRangePicker.preset.this-quarter': { en: 'This quarter', fr: 'Ce trimestre' },
  'dateRangePicker.preset.last-quarter': { en: 'Last quarter', fr: 'Le trimestre dernier' },
  'dateRangePicker.preset.this-year': { en: 'This year', fr: 'Cette année' },
  'dateRangePicker.preset.last-year': { en: 'Last year', fr: 'L’année dernière' },

  // ---- Small controls: typed confirmation, split pane, pickers, sidebar ----
  /** `{text}` is the text the reader must type. */
  'dialog.typeToConfirm': {
    en: 'To confirm, type “{text}”',
    fr: 'Pour confirmer, saisissez « {text} »',
  },
  'dialog.typeToConfirmAsked': {
    en: 'To confirm, type the text asked for',
    fr: 'Pour confirmer, saisissez le texte demandé',
  },
  'splitPane.label': { en: 'Split pane', fr: 'Panneaux' },
  'splitPane.resize': { en: 'Resize panels', fr: 'Redimensionner les panneaux' },
  'recordPicker.search': { en: 'Search records', fr: 'Rechercher des enregistrements' },
  'recordPicker.searchById': { en: 'Search by id', fr: 'Rechercher par identifiant' },
  'select.open': { en: 'Open options', fr: 'Ouvrir les options' },
  /** `{label}` is the select's own label. */
  'select.openNamed': { en: 'Open {label}', fr: 'Ouvrir {label}' },
  'select.placeholder': { en: 'Select...', fr: 'Choisir…' },
  'select.clear': { en: 'Clear', fr: 'Effacer' },
  'sidebar.empty': { en: 'No items.', fr: 'Aucun élément.' },
  'sidebar.loading': { en: 'Loading…', fr: 'Chargement…' },
  'sidebar.loadFailed': { en: "Couldn't load the list.", fr: 'Impossible de charger la liste.' },
  /** `{label}` is the entry's own label. */
  'sidebar.expand': { en: 'Expand {label}', fr: 'Déplier {label}' },
  'sidebar.collapse': { en: 'Collapse {label}', fr: 'Replier {label}' },

  // ---- A chart with no title, named by what it draws ----
  'chartName.bar': { en: 'Bar chart', fr: 'Graphique en barres' },
  'chartName.line': { en: 'Line chart', fr: 'Graphique en courbes' },
  'chartName.area': { en: 'Area chart', fr: 'Graphique en aires' },
  'chartName.scatter': { en: 'Scatter chart', fr: 'Nuage de points' },
  'chartName.pie': { en: 'Pie chart', fr: 'Graphique en secteurs' },
  'chartName.donut': { en: 'Donut chart', fr: 'Graphique en anneau' },
  'chartName.radar': { en: 'Radar chart', fr: 'Graphique radar' },
  'chartName.radial': { en: 'Radial chart', fr: 'Graphique radial' },
}
