/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The French twin of `console.ts`: the overview, the account cluster and the
// auth surfaces.
//
// Exact key parity with `console.ts`, in its key order. The rules every French
// string here follows (voice, no-break spaces) are in `fr.ts`, which merges
// the four.

export default {
  'admin.field.email': 'Adresse e-mail',
  'admin.field.password': 'Mot de passe',
  'admin.field.displayName': 'Nom affiché',
  'admin.field.newPassword': 'Nouveau mot de passe',
  'admin.field.newEmail': 'Nouvelle adresse e-mail',
  'admin.field.currentPassword': 'Mot de passe actuel',

  // Segment optionnel : les crochets ne survivent que si le `$session.` qu’ils
  // contiennent se résout. Avec un nom, « Bienvenue, Ada Lovelace » ; sans nom,
  // et pour une visite anonyme, « Bienvenue » tout court — la virgule s’en va
  // avec le nom auquel elle appartient.
  'admin.welcome.heading': 'Bienvenue[, $session.name]',
  'admin.welcome.intro': 'Ce qui t’attend, et ce que cette app déclare.',
  'admin.welcome.ask.title': 'Pose une question sur cette app',
  'admin.welcome.ask.description':
    'Réponses tirées des données et de la configuration de cette app. Lecture seule. Aussi dans ⌘K.',
  'admin.invitation.heading': 'Rejoindre la console',
  'admin.invitation.invitedYouTo': 't’invite sur',
  'admin.invitation.signInAs': 'Tu te connecteras avec',
  'admin.invitation.submit': 'Choisir un mot de passe et rejoindre',
  'admin.invitation.asRole': 'comme',
  'admin.invitation.worksUntil': 'Cette invitation est valable jusqu’au',
  'admin.invitation.unusable.heading': 'Ce lien d’invitation ne fonctionne plus',
  'admin.invitation.unusable.body':
    'Il a peut-être expiré ou déjà servi. Demande à la personne qui t’a invité·e de t’en envoyer un nouveau.',
  'admin.invitation.unusable.signIn': 'Aller à la connexion',
  'admin.notFound.heading': 'Page introuvable',
  'admin.notFound.body':
    'Rien dans cette console ne répond à cette adresse. La section n’existe peut-être pas dans cette app, ou le lien est périmé.',
  'admin.notFound.back': 'Revenir à la vue d’ensemble',

  // Les destinations reprennent mot pour mot le vocabulaire du fil d’Ariane :
  // une exécution s’appelle « Exécutions » ici comme ailleurs, sinon
  // l’opérateur·ice a deux noms pour une seule console.
  'admin.welcome.pulse.region': 'Ce qui demande ton attention',
  'admin.welcome.pulse.heading': 'À traiter',
  'admin.welcome.pulse.since': 'Depuis le démarrage de cette instance',
  'admin.welcome.pulse.failedRuns': 'Exécutions en échec',
  'admin.welcome.pulse.failedRuns.action': 'Voir les exécutions',
  'admin.welcome.pulse.variablesUnset': 'Variables requises non définies',
  'admin.welcome.pulse.variablesUnset.action': 'Voir l’environnement',
  'admin.welcome.pulse.tokensExpired': 'Connexions à reconnecter',
  'admin.welcome.pulse.tokensExpired.action': 'Voir les connexions',
  'admin.welcome.pulse.invitationsPending': 'Invitations en attente',
  'admin.welcome.pulse.invitationsPending.action': 'Voir les utilisateurs',
  'admin.welcome.pulse.recentSubmissions': 'Nouvelles réponses',
  'admin.welcome.pulse.recentSubmissions.action': 'Voir les réponses',
  'admin.welcome.pulse.findingsCount': 'Constats',
  'admin.welcome.pulse.findingsCount.action': 'Examiner les constats',
  'admin.welcome.pulse.allClear': 'Rien à signaler',
  'admin.welcome.pulse.allClear.body':
    'Aucune exécution en échec, aucune variable manquante, aucune connexion à reconnecter, rien en attente.',

  'admin.welcome.counts.region': 'Ce que cette app déclare',
  'admin.welcome.counts.heading': 'Ce que cette app déclare',
  'admin.welcome.counts.description':
    'Une ligne apparaît quand la configuration déclare la fonctionnalité.',
  'admin.welcome.figures.region': 'Chiffres clés',
  'admin.welcome.figures.runs': 'Exécutions, dernières 24 h',
  'admin.welcome.figures.runs.sub': 'en échec depuis le démarrage de cette instance',
  'admin.welcome.figures.submissions': 'Réponses',
  'admin.welcome.figures.submissions.sub': 'depuis le démarrage de cette instance',
  'admin.welcome.figures.accounts': 'Comptes',
  'admin.welcome.figures.storage': 'Fichiers stockés',
  'admin.welcome.runsChart.region': 'Exécutions, 7 derniers jours',
  'admin.welcome.runsChart.runs': 'Exécutions',
  'admin.welcome.runsChart.failures': 'En échec',

  'admin.profile.identity.region': 'Ton compte',
  'admin.profile.rows.region': 'Réglages du compte',

  'admin.profile.picture.label': 'Photo',
  'admin.profile.picture.hint': 'PNG, JPEG ou WebP. 5 Mo maximum.',
  'admin.profile.picture.upload': 'Changer',
  'admin.profile.picture.remove': 'Retirer',
  'admin.profile.picture.removeConfirm.title': 'Retirer ta photo ?',
  'admin.profile.picture.removeConfirm.message':
    'La console affichera tes initiales à la place. Tu peux en déposer une nouvelle à tout moment.',
  'admin.profile.picture.removeConfirm.confirm': 'Retirer',
  'admin.profile.picture.removeConfirm.cancel': 'La garder',
  'admin.profile.picture.uploaded': 'Photo mise à jour.',
  'admin.profile.picture.uploadFailed':
    'Ce fichier a été refusé. Utilise un PNG, un JPEG ou un WebP de moins de 5 Mo.',
  'admin.profile.picture.removed': 'Photo retirée.',
  'admin.profile.picture.removeFailed': 'Impossible de retirer ta photo.',

  'admin.profile.displayName.hint': 'Affiché à côté de ton activité dans la console.',
  'admin.profile.displayName.formRegion': 'Changer ton nom affiché',
  'admin.profile.displayName.submit': 'Enregistrer',
  'admin.profile.displayName.saved': 'Nom enregistré.',
  'admin.profile.displayName.failed': 'Impossible d’enregistrer ton nom.',

  'admin.profile.email.hint':
    'Ne change qu’après que tu as suivi le lien de vérification envoyé à la nouvelle adresse.',
  'admin.profile.email.formRegion': 'Changer ton adresse e-mail',
  'admin.profile.email.submit': 'Envoyer le lien',
  'admin.profile.email.sent': 'Lien de vérification envoyé.',
  'admin.profile.email.sentDetail':
    'Lien de vérification envoyé. Ton adresse change une fois que tu l’as suivi.',
  'admin.profile.email.failed': 'Impossible d’envoyer le lien.',

  'admin.profile.password.formRegion': 'Changer ton mot de passe',
  'admin.profile.password.submit': 'Changer le mot de passe',
  'admin.profile.password.saved': 'Mot de passe changé.',
  'admin.profile.password.failed':
    'Impossible de changer ton mot de passe — vérifie ton mot de passe actuel.',

  'admin.profile.language.label': 'Langue',
  'admin.profile.language.hint':
    'Enregistrée sur ton compte, elle te suit sur tous les navigateurs. Tant que tu n’en enregistres pas, chaque navigateur garde la sienne.',
  'admin.profile.language.formRegion': 'Changer la langue de la console',
  'admin.profile.language.saved': 'Langue enregistrée.',
  'admin.profile.language.savedDetail':
    'Langue enregistrée. La console bascule à ta prochaine page.',
  'admin.profile.language.failed': 'Impossible d’enregistrer ta langue.',

  'admin.profile.notifications.label': 'Notifications',
  'admin.profile.notifications.hint': 'Chaque e-mail d’alerte renvoie ici, où tu les désactives.',
  'admin.profile.notifications.saved': 'Préférence enregistrée.',
  'admin.profile.notifications.failed': 'Impossible d’enregistrer la préférence.',
  'admin.profile.notifications.automationAlerts.label': 'Alertes d’automatisation',
  'admin.profile.notifications.automationAlerts.hint':
    'M’écrire quand une automatisation échoue, est interrompue, mise en pause ou relancée.',
  'admin.profile.notifications.automationAlerts.formRegion': 'Changer tes alertes d’automatisation',
  'admin.profile.notifications.weeklyDigest.label': 'Résumé hebdomadaire',
  'admin.profile.notifications.weeklyDigest.hint':
    'M’écrire chaque semaine ce qui a tourné, ce qui a échoué et comment les données ont évolué.',
  'admin.profile.notifications.weeklyDigest.formRegion': 'Changer ton résumé hebdomadaire',

  'admin.profile.cloud.label': 'Sovrium Cloud',
  'admin.profile.cloud.connect': 'Connecter le compte Sovrium Cloud',
  'admin.profile.cloud.disconnect': 'Déconnecter le compte Sovrium Cloud',
  'admin.profile.data.label': 'Tes données',
  'admin.profile.data.hint':
    'Exporte tout ce que cette instance détient sur toi, ou efface ton compte.',
  'admin.profile.gdprLink': 'Ouvrir Mes données',

  'admin.gdpr.heading': 'Mes données (RGPD)',
  'admin.gdpr.blurb':
    'Ce que cette instance détient sur toi, et comment le récupérer ou l’effacer.',
  'admin.gdpr.identity.heading': 'Mon identité',
  'admin.gdpr.export.heading': 'Exporter mes données',
  'admin.gdpr.export.submit': 'Générer l’export',
  'admin.gdpr.export.failed': 'Impossible de préparer ton export. Rien n’a été envoyé.',
  'admin.gdpr.export.retry': 'Réessayer',
  'admin.gdpr.erase.heading': 'Effacer mon compte',
  'admin.gdpr.erase.submit': 'Demander l’effacement',
  'admin.gdpr.erase.confirm.title': 'Confirmer l’effacement',
  'admin.gdpr.erase.confirm.message':
    'Cette action est définitive et irréversible. Saisis ton adresse e-mail pour confirmer l’effacement de ton compte.',
  'admin.gdpr.erase.confirm.input': 'Saisis ton adresse e-mail',
  'admin.gdpr.erase.confirm.affirm': 'Effacer',
  'admin.gdpr.erase.confirm.dismiss': 'Annuler',
  'admin.gdpr.pending.region': 'Demandes en cours',
  'admin.gdpr.pending.account': 'Compte',
  'admin.gdpr.pending.due': 'Échéance',
  'admin.gdpr.pending.actions': 'Actions',
  'admin.gdpr.pending.empty': 'Aucune demande d’effacement en cours.',
  'admin.gdpr.pending.cancel': 'Annuler',
  'admin.gdpr.pending.confirm.title': 'Confirmer l’annulation',
  'admin.gdpr.pending.confirm.message':
    'Annuler ta demande d’effacement de compte ? Ton compte ne sera pas supprimé.',
  'admin.gdpr.pending.confirm.affirm': 'Confirmer l’annulation',
  'admin.gdpr.pending.confirm.dismiss': 'Retour',
  'admin.gdpr.account.label': 'Ton compte',
  'admin.gdpr.account.hint': 'Change ton nom, ton e-mail, ton mot de passe, ta photo ou ta langue.',
  'admin.gdpr.profileLink': 'Ouvrir Mon profil',

  'admin.apiKeys.heading': 'Clés API',
  'admin.apiKeys.readScope': 'Cette clé lit ce que tu peux lire.',
  'admin.apiKeys.region': 'Tes clés API',
  'admin.apiKeys.loading': 'Chargement de tes clés API…',

  'admin.env.heading': 'Environnement',
  'admin.env.search': 'Rechercher une variable',
  'admin.env.filter.status': 'Filtrer par statut',
  'admin.env.filter.allStatuses': 'Tous les statuts',
  'admin.env.filter.required': 'Filtrer par obligation',
  'admin.env.filter.allRequirements': 'Obligatoires et facultatives',
  'admin.env.col.variable': 'Variable',
  'admin.env.col.required': 'Obligatoire',
  'admin.env.col.status': 'Statut',
  'admin.env.col.source': 'Source',
  'admin.env.empty': 'Cette app ne déclare aucune variable d’environnement.',
  'admin.env.noMatch': 'Aucune variable ne correspond. Efface la recherche ou un filtre.',
  'admin.env.blurb':
    'Les variables que cette app déclare, et si cette instance a résolu chacune d’elles. Les valeurs ne sont jamais affichées.',
  'admin.env.callout.heading': 'Les valeurs vivent dans l’environnement de déploiement',
  'admin.env.declared.heading': 'Variables déclarées',
  'admin.env.declared.region': 'Variables d’environnement déclarées',
  'admin.env.usedBy': 'Utilisée par',
  'admin.env.requiredUnset':
    'est obligatoire et n’est pas définie. Définis-la là où tu exécutes cette instance, puis redémarre.',
  'admin.env.unused': 'Inutilisée',
  'admin.env.required': 'Obligatoire',
  'admin.env.optional': 'Facultative',
  'admin.env.set': 'Définie',
  'admin.env.notSet': 'Non définie',
  'admin.env.fromEnvironment': 'Depuis l’environnement',
  'admin.env.fromDefault': 'Depuis la valeur par défaut déclarée',

  'admin.decisions.heading': 'Décisions',
  'admin.decisions.blurb':
    'Les décisions d’architecture que cette application déclare, et ce que chacune concernait.',
  'admin.decisions.register.region': 'Registre des décisions',
  'admin.decisions.provenance':
    'Déclarées dans app.ts. On les change là-bas et on redéploie, jamais ici.',
  'admin.decisions.one.heading': 'Décision',
  'admin.decisions.one.blurb':
    'Une décision du registre : la situation, le choix, et ce qui en découle.',
  'admin.decisions.back': 'Retour aux décisions',
  'admin.decisions.record.heading': 'Fiche',
  'admin.decisions.record.region': 'Fiche de la décision',
  'admin.decisions.part.context': 'Contexte',
  'admin.decisions.part.decision': 'Décision',
  'admin.decisions.part.consequences': 'Conséquences',
  'admin.decisions.field.status': 'Statut',
  'admin.decisions.field.date': 'Date',
  'admin.decisions.field.deciders': 'Décideurs',
  'admin.decisions.field.supersedes': 'Remplace',
  'admin.decisions.field.supersededBy': 'Remplacée par',
  'admin.decisions.field.touches': 'Concerne',
  'admin.decisions.field.source': 'Source',

  // Le verbe une seule fois, et c’est l’app de la personne qui est nommée —
  // jamais la nôtre. Ce que ça remplace ouvrait les deux lignes sur la même
  // formule et appelait la chose « ton app Sovrium » : le moteur avant l’app,
  // l’inverse de ce que fait le reste de la console. La fin de la phrase est
  // composée côté page (`pages/login.ts`), parce qu’un `$app.` ne se résout
  // pas dans une valeur traduite.
  'admin.login.heading': 'Connexion',
  'admin.login.blurb': 'La console d’exploitation de ',
  'admin.login.sessionEnded': 'Ta session a pris fin — connecte-toi pour continuer.',
  'admin.login.submit': 'Se connecter',
  'admin.login.pending': 'Connexion…',
  'admin.login.cloudSignIn': 'Se connecter avec Sovrium Cloud',
  'admin.login.orEmail': 'Ou avec ton e-mail',

  'admin.forgotPassword.heading': 'Mot de passe oublié',
  'admin.forgotPassword.blurb':
    'Saisis ton adresse e-mail. On t’envoie un lien pour définir un nouveau mot de passe.',
  'admin.forgotPassword.submit': 'Envoyer le lien',
  'admin.forgotPassword.pending': 'Envoi…',
  'admin.forgotPassword.expiry':
    'Le lien expire au bout d’une heure. Tu peux en demander un autre à tout moment.',

  'admin.resetPassword.heading': 'Nouveau mot de passe',
  'admin.resetPassword.blurb':
    'Choisis un nouveau mot de passe. Il remplace l’ancien immédiatement.',
  'admin.resetPassword.submit': 'Enregistrer le mot de passe',
  'admin.resetPassword.pending': 'Enregistrement…',
  'admin.resetPassword.singleUse':
    'Ce lien ne fonctionne qu’une seule fois. Demandes-en un nouveau si tu en as besoin.',

  'admin.auth.backToSignIn': 'Retour à la connexion',

  'admin.locked.audit.gdpr.exportScope':
    'Télécharge une archive JSON de tes données (profil, enregistrements que tu as créés, réponses de formulaire, activité).',
  'admin.locked.audit.gdpr.erasureNotice':
    'L’effacement est définitif et irréversible. Après un délai de grâce de 7 jours, ton compte et tes données sont supprimés pour de bon — ils ne peuvent pas être restaurés depuis la corbeille.',
  'admin.locked.audit.apiKeys.scopeNotice':
    'Identifiants de longue durée pour les scripts et les services qui appellent cette instance en ton nom. Présente-en un dans l’en-tête x-api-key. Une clé porte ton propre rôle — elle ne peut jamais faire plus que toi.',
  'admin.locked.audit.env.secrecyNotice':
    'Définis une variable dans l’environnement où tu fais tourner cette instance, puis redémarre. La console rapporte ce qui a été résolu ; elle ne stocke ni ne révèle jamais une valeur.',
} as const
