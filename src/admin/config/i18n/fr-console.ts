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
  'admin.welcome.heroRegion': 'Demander ou chercher',
  'admin.welcome.noAi': 'Aucun fournisseur d’IA configuré — cherche dans l’app à la place.',
  // Le déclencheur de la palette côté héros, nommé À PART de celui de la barre
  // latérale : Bienvenue est la seule surface où les deux sont à l’écran, et
  // ils portaient le même nom. La barre latérale garde le verbe seul — c’est
  // l’affordance permanente de la console — et le héros nomme sa cible, dans
  // les mots de la légende juste en dessous.
  'admin.welcome.searchHero': 'Rechercher dans l’app',

  // Les destinations reprennent mot pour mot le vocabulaire du fil d’Ariane :
  // une exécution s’appelle « Exécutions » ici comme ailleurs, sinon
  // l’opérateur·ice a deux noms pour une seule console.
  'admin.welcome.pulse.region': 'Ce qui demande ton attention',
  'admin.welcome.pulse.heading': 'Depuis le démarrage de cette instance',
  'admin.welcome.pulse.failedRuns': 'exécutions en échec',
  'admin.welcome.pulse.failedRuns.where': 'Exécutions →',
  'admin.welcome.pulse.variablesUnset': 'variables requises non définies',
  'admin.welcome.pulse.variablesUnset.where': 'Environnement →',
  'admin.welcome.pulse.tokensExpired': 'jetons expirés',
  'admin.welcome.pulse.tokensExpired.where': 'Connexions →',
  'admin.welcome.pulse.invitationsPending': 'invitations en attente',
  'admin.welcome.pulse.invitationsPending.where': 'Utilisateurs →',
  'admin.welcome.pulse.recentSubmissions': 'nouvelles réponses',
  'admin.welcome.pulse.recentSubmissions.where': 'Réponses →',
  'admin.welcome.pulse.automationsPaused': 'automatisations en pause',
  'admin.welcome.pulse.automationsPaused.where': 'Exécutions →',

  'admin.welcome.counts.region': 'Ce que cette app déclare',
  'admin.welcome.counts.heading': 'Ce que cette app déclare',

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
  'admin.profile.password.submit': 'Changer',
  'admin.profile.password.saved': 'Mot de passe changé.',
  'admin.profile.password.failed':
    'Impossible de changer ton mot de passe — vérifie ton mot de passe actuel.',

  'admin.profile.language.label': 'Langue',
  'admin.profile.language.hint': 'Suit ton compte sur tous les navigateurs où tu te connectes.',
  'admin.profile.language.formRegion': 'Changer la langue de la console',
  'admin.profile.language.submit': 'Enregistrer',
  'admin.profile.language.saved': 'Langue enregistrée.',
  'admin.profile.language.savedDetail':
    'Langue enregistrée. La console bascule à ta prochaine page.',
  'admin.profile.language.failed': 'Impossible d’enregistrer ta langue.',

  'admin.profile.notifications.label': 'Notifications',
  'admin.profile.notifications.hint': 'Chaque e-mail d’alerte renvoie ici, où tu les désactives.',
  'admin.profile.notifications.submit': 'Enregistrer',
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
  'admin.apiKeys.region': 'Tes clés API',
  'admin.apiKeys.loading': 'Chargement de tes clés API…',

  'admin.env.heading': 'Environnement',
  'admin.env.blurb':
    'Les variables que cette app déclare, et si cette instance a résolu chacune d’elles. Les valeurs ne sont jamais affichées.',
  'admin.env.callout.heading': 'Les valeurs vivent dans l’environnement de déploiement',
  'admin.env.declared.heading': 'Variables déclarées',
  'admin.env.declared.region': 'Variables d’environnement déclarées',
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
  'admin.login.submit': 'Se connecter',
  'admin.login.pending': 'Connexion…',
  'admin.login.forgotLink': 'Mot de passe oublié ?',

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
    'Définis une variable là où tu fais tourner cette instance, puis redémarre. La console rapporte ce qui a été résolu ; elle ne stocke ni ne révèle jamais une valeur.',
} as const
