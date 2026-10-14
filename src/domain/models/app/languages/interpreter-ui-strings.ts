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
  /**
   * A row action's inline select editor whose options resolved to none — the
   * source it reads is empty. `{label}` is the editor's own label, so the same
   * hint serves a roles picker and a groups picker alike.
   */
  'datatable.rowEditNoOptions': {
    en: 'No {label} to choose from',
    fr: 'Aucun choix disponible pour {label}',
  },
  /**
   * A row action's inline LIST editor (`multiple`) opened on a row that does
   * not carry the list at all — the server could not read it. The editor
   * offers no preset and no save: saving an unknown list would replace it.
   */
  'datatable.rowEditUnreadable': {
    en: 'The current {label} could not be read',
    fr: 'Impossible de lire la valeur actuelle de {label}',
  },

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
  /** The name field a passkeys list draws on each row to rename a key. */
  'datatable.passkeyName': { en: 'Passkey name', fr: 'Nom de la clé d’accès' },
  /** An empty grid's message, when the author declares no `emptyMessage`. */
  'datatable.noRecords': { en: 'No records found', fr: 'Aucun enregistrement' },

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
  'datatable.pagination.firstLabel': { en: 'First page', fr: 'Première page' },
  'datatable.pagination.lastLabel': { en: 'Last page', fr: 'Dernière page' },
  /** The polite count an infinite grid keeps, and its keyboard fallback. */
  'datatable.pagination.loaded': {
    en: '{loaded} of {total} loaded',
    fr: '{loaded} sur {total} chargés',
  },
  'datatable.pagination.loadMore': { en: 'Load more', fr: 'Charger plus' },
  /**
   * The accessible name of a row's `…` actions menu trigger: its column's
   * header (else `label`) and the row's first field value (else `row`).
   */
  'datatable.rowActions.open': { en: '{label} for {row}', fr: '{label} pour {row}' },
  'datatable.rowActions.label': { en: 'Actions', fr: 'Actions' },
  'datatable.rowActions.row': { en: 'row {number}', fr: 'ligne {number}' },
  /** A faceted filter: the count past two checked values, the clear item, the no-match line. */
  'datatable.facet.selected': { en: 'selected', fr: 'sélectionnés' },
  'datatable.facet.clear': { en: 'Clear filters', fr: 'Effacer les filtres' },
  'datatable.facet.empty': { en: 'No results found.', fr: 'Aucun résultat.' },
  /** The sort builder's two directions, in words. */
  'datatable.sort.ascending': { en: 'Ascending', fr: 'Croissant' },
  'datatable.sort.descending': { en: 'Descending', fr: 'Décroissant' },

  // ---- Forms ----
  'form.create': { en: 'Create', fr: 'Créer' },
  'form.update': { en: 'Update', fr: 'Mettre à jour' },
  /** A hosted form's submit button when `display.submitLabel` is not declared. */
  'form.submit': { en: 'Submit', fr: 'Envoyer' },
  /** A record form's submit, and a `crud` update, while its save is in flight. */
  'form.saving': { en: 'Saving…', fr: 'Enregistrement…' },
  /**
   * A hosted form's submit and Next, an endpoint form's submit and a `fetch`
   * button, while in flight, when no `pendingLabel` is declared.
   */
  'form.sending': { en: 'Sending…', fr: 'Envoi…' },
  /** A `crud` delete button that declares no `content`. */
  'form.delete': { en: 'Delete', fr: 'Supprimer' },
  /** A `crud` delete button while in flight, when no `pendingLabel` is declared. */
  'form.deleting': { en: 'Deleting…', fr: 'Suppression…' },
  /** An `automation` button while in flight, when no `pendingLabel` is declared. */
  'action.running': { en: 'Running…', fr: 'Exécution…' },
  'form.required': { en: 'This field is required', fr: 'Ce champ est obligatoire' },
  'form.requiredNamed': { en: '{label} is required', fr: 'Le champ {label} est obligatoire' },
  /** A hosted form's default `onError` message. */
  'form.submissionFailed': { en: 'Submission failed.', fr: "L'envoi a échoué." },
  'form.operationFailed': { en: 'Operation failed', fr: "L'opération a échoué" },
  /** The Clear control's visible text (edit form and editable drawer). */
  'form.clear': { en: 'Clear', fr: 'Effacer' },
  /** The edit form's Clear control, accessible name. */
  'form.clearNamed': { en: 'Clear {label}', fr: 'Effacer {label}' },
  /** A hosted form's save-and-resume action, beside its submit (`saveAndResume`). */
  'form.saveForLater': { en: 'Save and continue later', fr: 'Enregistrer et continuer plus tard' },
  'form.saveForLaterEmail': { en: 'Your email address', fr: 'Votre adresse e-mail' },
  'form.saveForLaterSend': { en: 'Send me the link', fr: "M'envoyer le lien" },
  'form.saveForLaterSent': {
    en: 'Your answers are saved. A link to continue has been sent to your email address.',
    fr: 'Vos réponses sont enregistrées. Un lien pour continuer a été envoyé à votre adresse e-mail.',
  },
  'form.saveForLaterFailed': {
    en: 'Your answers could not be saved. Check the email address and try again.',
    fr: "Vos réponses n'ont pas pu être enregistrées. Vérifiez l'adresse e-mail et réessayez.",
  },
  /** A resume link that is expired, already used or unknown — never which one. */
  'form.resumeUnavailable': {
    en: 'Your saved answers are no longer available.',
    fr: 'Vos réponses enregistrées ne sont plus disponibles.',
  },
  /** The private edit link shown after a submission (`editAfterSubmit`). */
  'form.editAnswers': { en: 'Edit your answers', fr: 'Modifier vos réponses' },
  /** A multi-step hosted form's step navigation. */
  'form.previous': { en: 'Previous', fr: 'Précédent' },
  'form.next': { en: 'Next', fr: 'Suivant' },
  /** A multi-step hosted form's progress line, updated as the reader moves between steps. */
  'form.stepOf': { en: 'Step {current} of {total}', fr: 'Étape {current} sur {total}' },
  /** The progress line's accessible name. */
  'form.stepProgress': { en: 'Step progress', fr: 'Progression' },
  /** An attachment field's `recordAudio` control, at rest and while recording. */
  'form.recordAudio': { en: 'Record audio', fr: 'Enregistrer un audio' },
  'form.stopRecording': { en: 'Stop recording', fr: 'Arrêter l’enregistrement' },
  /** A picked file the field's `allowedFileTypes` refuse; `{type}` is its type, or its name. */
  'form.fileTypeNotAccepted': {
    en: 'File type not accepted: {type}',
    fr: 'Type de fichier refusé : {type}',
  },
  /** A picked file over the field's `maxFileSize`. */
  'form.fileTooLarge': {
    en: 'File size {size} exceeds maximum of {max}',
    fr: 'Le fichier pèse {size}, au-delà du maximum de {max}',
  },

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
  /** A dialog with no `title`: its accessible name. */
  'dialog.label': { en: 'Dialog', fr: 'Boîte de dialogue' },

  // ---- File preview: the toolbar and the fallback line ----
  /** The toolbar's accessible name; `{name}` is the file name. */
  'filePreview.toolbar': { en: '{name} tools', fr: 'Outils pour {name}' },
  'filePreview.download': { en: 'Download', fr: 'Télécharger' },
  'filePreview.open': { en: 'Open', fr: 'Ouvrir' },
  'filePreview.zoom': { en: 'Zoom', fr: 'Agrandir' },
  'filePreview.rotate': { en: 'Rotate', fr: 'Pivoter' },
  /** A file the stage cannot draw. `{name}` is the file name. */
  'filePreview.cannotShow': {
    en: '{name} cannot be shown here. Download it to open it.',
    fr: '{name} ne peut pas être affiché ici. Téléchargez-le pour l’ouvrir.',
  },

  // ---- Auth forms: default field labels, submit and in-flight words ----
  'auth.email': { en: 'Email', fr: 'E-mail' },
  'auth.password': { en: 'Password', fr: 'Mot de passe' },
  /** The error summary an auth form inserts above its fields after a refused submit. */
  'auth.fixErrors': {
    en: 'Please fix the following errors:',
    fr: 'Corrigez les erreurs suivantes :',
  },
  /** An auth form's submit, per method, when the action declares no `submitLabel`. */
  'auth.submit.login': { en: 'Sign In', fr: 'Se connecter' },
  'auth.submit.signup': { en: 'Sign Up', fr: 'Créer un compte' },
  'auth.submit.logout': { en: 'Log Out', fr: 'Se déconnecter' },
  'auth.submit.resetPassword': {
    en: 'Send Reset Link',
    fr: 'Envoyer le lien de réinitialisation',
  },
  'auth.submit.setNewPassword': {
    en: 'Set New Password',
    fr: 'Définir le nouveau mot de passe',
  },
  'auth.submit.enableTwoFactor': {
    en: 'Turn on two-step verification',
    fr: 'Activer la vérification en deux étapes',
  },
  'auth.submit.disableTwoFactor': {
    en: 'Turn off two-step verification',
    fr: 'Désactiver la vérification en deux étapes',
  },
  'auth.submit.regenerateBackupCodes': { en: 'Regenerate codes', fr: 'Régénérer les codes' },
  'auth.submit.acceptInvitation': { en: 'Accept invitation', fr: 'Accepter l’invitation' },
  'auth.submit.declineInvitation': { en: 'Decline', fr: 'Refuser' },
  'auth.submit.createApiKey': { en: 'Create key', fr: 'Créer la clé' },
  'auth.submit.revokeOtherSessions': {
    en: 'Sign out of other devices',
    fr: 'Se déconnecter des autres appareils',
  },
  'auth.submit.linkAccount': { en: 'Connect', fr: 'Connecter' },
  'auth.submit.unlinkAccount': { en: 'Disconnect', fr: 'Déconnecter' },
  /**
   * An auth form's submit while in flight, when the action declares no
   * `pendingLabel`. A reset link reads `form.sending`, a new password
   * `form.saving`, and a two-step code `auth.pending.verifyTwoFactor`.
   */
  'auth.pending.login': { en: 'Signing in…', fr: 'Connexion…' },
  'auth.pending.signup': { en: 'Creating account…', fr: 'Création du compte…' },
  'auth.pending.logout': { en: 'Logging out…', fr: 'Déconnexion…' },
  'auth.pending.verifyTwoFactor': { en: 'Verifying…', fr: 'Vérification…' },

  // ---- Default auth emails (no `auth.emailTemplates` entry) ----
  // Read in the recipient's stored language, else the app's default language,
  // else English. `{app}` is the app's name.
  'email.greeting': { en: 'Hi {name},', fr: 'Bonjour {name},' },
  'email.greetingAnonymous': { en: 'Hi,', fr: 'Bonjour,' },
  'email.greetingThere': { en: 'Hi there,', fr: 'Bonjour,' },
  'email.linkFallback': {
    en: "If the button doesn't work, copy and paste this link into your browser:",
    fr: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
  },
  'email.linkExpires': {
    en: 'This link will expire in {expiry}.',
    fr: 'Ce lien expire dans {expiry}.',
  },
  'email.expiry.minutes10': { en: '10 minutes', fr: '10 minutes' },
  'email.expiry.hour1': { en: '1 hour', fr: '1 heure' },
  'email.expiry.hours24': { en: '24 hours', fr: '24 heures' },
  'email.requestedNotice': {
    en: "This email was sent by {app}. If you didn't request this, please ignore this email.",
    fr: 'Cet e-mail a été envoyé par {app}. Si vous n’êtes pas à l’origine de cette demande, ignorez-le.',
  },
  'email.resetPassword.subject': {
    en: 'Reset your {app} password',
    fr: 'Réinitialisez votre mot de passe {app}',
  },
  'email.resetPassword.intro': {
    en: 'We received a request to reset your password for your {app} account.',
    fr: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte {app}.',
  },
  'email.resetPassword.cta': {
    en: 'Click the button below to reset your password:',
    fr: 'Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :',
  },
  'email.resetPassword.button': { en: 'Reset Password', fr: 'Réinitialiser le mot de passe' },
  'email.resetPassword.textCta': {
    en: 'Reset your password by visiting this link:',
    fr: 'Réinitialisez votre mot de passe en ouvrant ce lien :',
  },
  'email.resetPassword.ignore': {
    en: "If you didn't request a password reset, you can safely ignore this email.",
    fr: 'Si vous n’avez pas demandé de réinitialisation, ignorez cet e-mail.',
  },
  'email.verification.subject': {
    en: 'Verify your {app} email address',
    fr: 'Confirmez votre adresse e-mail {app}',
  },
  'email.verification.intro': {
    en: 'Welcome to {app}! Please verify your email address to complete your registration.',
    fr: 'Bienvenue sur {app} ! Confirmez votre adresse e-mail pour terminer votre inscription.',
  },
  'email.verification.cta': {
    en: 'Click the button below to verify your email:',
    fr: 'Cliquez sur le bouton ci-dessous pour confirmer votre adresse :',
  },
  'email.verification.button': { en: 'Verify Email', fr: 'Confirmer l’adresse' },
  'email.verification.textCta': {
    en: 'Verify your email by visiting this link:',
    fr: 'Confirmez votre adresse en ouvrant ce lien :',
  },
  'email.verification.ignore': {
    en: "If you didn't create an account with {app}, you can safely ignore this email.",
    fr: 'Si vous n’avez pas créé de compte sur {app}, ignorez cet e-mail.',
  },
  'email.magicLink.subject': { en: 'Sign in to {app}', fr: 'Connexion à {app}' },
  'email.magicLink.body': {
    en: 'Click here to sign in to {app}:',
    fr: 'Cliquez ici pour vous connecter à {app} :',
  },
  'email.magicLink.button': { en: 'Sign In', fr: 'Se connecter' },
  'email.invitation.subject': {
    en: 'You are invited to join {app}',
    fr: 'Invitation à rejoindre {app}',
  },
  'email.invitation.invited': {
    en: '{inviter} invited you to join {app}.',
    fr: '{inviter} vous invite à rejoindre {app}.',
  },
  /** The HTML part's call to action; `{link}` is the link, drawn around `email.invitation.here`. */
  'email.invitation.htmlCta': {
    en: 'Click {link} to set your password and accept the invitation.',
    fr: 'Choisissez votre mot de passe et {link}.',
  },
  'email.invitation.here': { en: 'here', fr: 'acceptez l’invitation' },
  'email.invitation.textCta': {
    en: 'Click the link below to set your password and accept the invitation:',
    fr: 'Ouvrez le lien ci-dessous pour choisir votre mot de passe et accepter l’invitation :',
  },
  'email.invitation.singleUse': {
    en: 'This link is single-use.',
    fr: 'Ce lien ne fonctionne qu’une fois.',
  },

  // ---- Two-step enrolment: the scan screen and the recovery codes ----
  'twoFactor.qrTitle': {
    en: 'QR code for your authenticator app',
    fr: 'QR code pour votre application d’authentification',
  },
  'twoFactor.keyHint': { en: 'Or enter this key:', fr: 'Ou saisissez cette clé :' },
  'twoFactor.code': { en: 'Verification code', fr: 'Code de vérification' },
  'twoFactor.verify': { en: 'Verify', fr: 'Vérifier' },
  'twoFactor.recoveryCodes': { en: 'Recovery codes', fr: 'Codes de récupération' },
  'twoFactor.codesSaved': { en: 'I have saved these codes', fr: 'J’ai enregistré ces codes' },
  'twoFactor.done': { en: 'Done', fr: 'Terminé' },
  /** A password sign-in whose account still owes its second step. */
  'twoFactor.pendingSignIn': {
    en: 'Two-step verification is on — enter your code to finish signing in',
    fr: 'La vérification en deux étapes est activée — saisissez votre code pour terminer la connexion',
  },
  /** A code page with no sign-in waiting for its code, or one that lapsed. */
  'twoFactor.attemptExpired': {
    en: 'Your sign-in has expired — start again.',
    fr: 'Votre connexion a expiré — recommencez.',
  },
  /** That notice's link back to the sign-in page. */
  'twoFactor.signInAgain': { en: 'Back to sign in', fr: 'Retour à la connexion' },

  // ---- Passkeys: the one-button forms ----
  'passkey.add': { en: 'Add a passkey', fr: 'Ajouter une clé d’accès' },
  'passkey.signIn': { en: 'Sign in with a passkey', fr: 'Se connecter avec une clé d’accès' },

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

/**
 * Keys the engine no longer draws anywhere, kept in the catalogue for one
 * release so an override of one still validates. `sovrium validate` and the
 * server at startup print an `engine-key-retired` notice for each override
 * written under the prefix; the next release removes the key from the
 * catalogue and its entry here together.
 */
export const RETIRED_ENGINE_KEYS: readonly string[] = ['filePreview.cannotShow']

/** Platform default language for interpreter strings when none is resolved. */
export const DEFAULT_INTERPRETER_LANG = 'en'
