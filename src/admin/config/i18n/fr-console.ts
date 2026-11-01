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
  'admin.welcome.intro':
    'Bienvenue[, $session.name]. Ce qui demande ton attention, et ce que cette app déclare.',
  'admin.welcome.instance.heading': 'Instance',
  'admin.welcome.instance.description': 'Ce sur quoi tourne cette instance',
  'admin.welcome.instance.version': 'Version',
  'admin.welcome.instance.database': 'Base de données',
  'admin.welcome.instance.storage': 'Stockage des fichiers',
  'admin.welcome.instance.ai': 'Fournisseur d’IA',
  'admin.welcome.instance.uptime': 'En ligne depuis',
  'admin.welcome.instance.aiNone': 'Non utilisé',
  'admin.welcome.instance.healthy': 'En bonne santé',
  'admin.welcome.instance.degraded': 'Dégradé',
  'admin.welcome.instance.versionLink': 'Lire les notes de cette version',
  'admin.welcome.ask.title': 'Pose une question sur cette app',
  'admin.welcome.ask.description':
    'Réponses tirées des données et de la configuration de cette app. Lecture seule. Aussi dans ⌘K.',
  'admin.invitation.heading': 'Rejoindre la console',
  'admin.invitation.headingMember': 'Rejoindre $app.label',
  'admin.invitation.landsAdmin': 'Une fois que tu as rejoint, tu arrives dans la console.',
  'admin.invitation.landsMember':
    'Une fois que tu as rejoint, tu arrives dans $app.label. La console est réservée aux admins.',
  'admin.invitation.invitedYouTo': 't’invite sur',
  'admin.invitation.signInAs': 'Tu te connecteras avec',
  'admin.invitation.submit': 'Choisir un mot de passe et rejoindre',
  'admin.invitation.asRole': 'comme',
  'admin.invitation.worksUntil': 'Cette invitation est valable jusqu’au',
  'admin.invitation.unusable.heading': 'Ce lien d’invitation ne fonctionne plus',
  'admin.invitation.unusable.body':
    'Il a peut-être expiré ou déjà servi. Demande à la personne qui t’a invité·e de t’en envoyer un nouveau.',
  'admin.invitation.unusable.signIn': 'Aller à la connexion',
  'admin.internalError.heading': 'Cette page n’a pas pu se charger',
  'admin.internalError.body':
    'Sovrium a rencontré une erreur interne en la dessinant. Tes données sont intactes. Recharge la page ; si ça échoue encore, signale-le pour qu’il soit corrigé.',
  'admin.notFound.heading': 'Page introuvable',
  'admin.notFound.body':
    'Rien dans cette console ne répond à cette adresse. La section n’existe peut-être pas dans cette app, ou le lien est périmé.',
  'admin.notFound.back': 'Revenir à la vue d’ensemble',
  'admin.notFound.toApp': 'Aller à l’app',

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
  'admin.welcome.pulse.allClear': 'Rien ne demande ton attention pour l’instant.',

  'admin.welcome.counts.region': 'Ce que cette app déclare',
  'admin.welcome.counts.heading': 'Ce que cette app déclare',
  'admin.welcome.counts.description':
    'Une carte apparaît pour chaque fonctionnalité que ta config déclare.',
  'admin.welcome.figures.region': 'Chiffres clés',
  'admin.welcome.figures.runs': 'Exécutions, dernières 24 h',
  'admin.welcome.figures.runs.sub': 'en échec depuis le démarrage de cette instance',
  'admin.welcome.figures.submissions': 'Réponses',
  'admin.welcome.figures.submissions.sub': 'depuis le démarrage de cette instance',
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
    'S’applique dès que tu choisis, sur tous les navigateurs où tu te connectes.',
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
  'admin.gdpr.blurb': 'Exporte ce que cette instance garde sur toi, ou efface ton compte.',
  'admin.profile.blurb': 'Ton nom, ta connexion et tes préférences dans cette console.',
  'admin.gdpr.identity.heading': 'Mon identité',
  'admin.gdpr.export.heading': 'Exporter mes données',
  'admin.gdpr.export.submit': 'Générer l’export',
  'admin.gdpr.export.failed': 'Impossible de préparer ton export. Rien n’a été envoyé.',
  'admin.gdpr.export.retry': 'Réessayer',
  'admin.gdpr.erase.heading': 'Effacer mon compte',
  'admin.gdpr.erase.submit': 'Demander l’effacement',
  'admin.gdpr.erase.confirm.title': 'Effacer ton compte ?',
  'admin.gdpr.erase.confirm.message':
    'Programmé dans 7 jours. Tu peux annuler d’ici là depuis cette page. Ensuite, ton compte et tes données sont supprimés pour de bon. Ils ne peuvent pas être restaurés.',
  'admin.gdpr.erase.confirm.input': 'Saisis ton adresse e-mail pour confirmer',
  'admin.gdpr.erase.confirm.affirm': 'Demander l’effacement',
  'admin.gdpr.erase.confirm.dismiss': 'Annuler',
  'admin.gdpr.pending.region': 'Demandes en cours',
  'admin.gdpr.pending.account': 'Compte',
  'admin.gdpr.pending.due': 'Échéance',
  'admin.gdpr.pending.actions': 'Actions',
  'admin.gdpr.pending.empty': 'Aucune demande d’effacement en cours.',
  'admin.gdpr.pending.empty.guidance':
    'Une demande faite ci-dessus s’affiche ici jusqu’à son exécution ou son annulation.',
  'admin.gdpr.pending.cancel': 'Annuler l’effacement',
  'admin.gdpr.pending.confirm.title': 'Annuler ta demande d’effacement ?',
  'admin.gdpr.pending.confirm.message':
    'Ton compte et tes données restent. Tu pourras redemander l’effacement plus tard.',
  'admin.gdpr.pending.confirm.affirm': 'Annuler l’effacement',
  'admin.gdpr.pending.confirm.dismiss': 'Retour',
  'admin.gdpr.account.label': 'Ton compte',
  'admin.gdpr.account.hint': 'Change ton nom, ton e-mail, ton mot de passe, ta photo ou ta langue.',
  'admin.gdpr.profileLink': 'Ouvrir Mon profil',

  'admin.report.heading': 'Signaler un problème',
  'admin.report.description':
    'Quelque chose ne va pas dans Sovrium ? Ouvre un ticket prérempli sur GitHub, rédigé en anglais. Rien n’est envoyé tant que tu ne l’as pas soumis.',
  'admin.report.installation.heading': 'Un nouveau signalement',
  'admin.report.installation.body':
    'Un signalement vierge, avec la version, le canal d’installation, la base de données et le système de cette installation déjà remplis. Décris ce que tu as vu et ce que tu attendais.',
  'admin.report.latest.heading': 'La dernière erreur interne',
  'admin.report.latest.body':
    'La dernière panne de Sovrium que ce serveur a conservée, avec ses détails déjà remplis.',
  'admin.apiKeys.heading': 'Clés API',
  'admin.apiKeys.region': 'Tes clés API',
  'admin.apiKeys.loading': 'Chargement de tes clés API…',

  'admin.env.heading': 'Environnement',

  'admin.auditLog.heading': 'Journal d’audit',

  'admin.auditLog.blurb':
    'Qui a lu ou modifié quoi sur cette instance, quand, et par quel accès. En lecture seule, du plus récent au plus ancien.',

  'admin.auditLog.region': 'Journal d’audit',

  'admin.auditLog.filter.transport': 'Accès',

  'admin.auditLog.filter.allTransports': 'Tous les accès',

  'admin.auditLog.filter.resource': 'Ressource',

  'admin.auditLog.filter.allResources': 'Toutes les ressources',
  'admin.auditLog.filter.actor': 'Auteur',
  'admin.auditLog.filter.allActors': 'Tous les auteurs',
  'admin.auditLog.filter.action': 'Action',
  'admin.auditLog.filter.allActions': 'Toutes les actions',
  'admin.auditLog.filter.period': 'Filtrer par période',
  'admin.auditLog.filter.anyTime': 'Toute la période',
  'admin.auditLog.search': 'Rechercher dans le journal d’audit',

  'admin.auditLog.col.time': 'Heure',

  'admin.auditLog.col.actor': 'Auteur',

  'admin.auditLog.col.action': 'Action',
  'admin.auditLog.action.account.deletion.scheduled': 'A programmé la suppression d’un compte',
  'admin.auditLog.action.account.deletion.requested': 'A demandé la suppression d’un compte',
  'admin.auditLog.action.account.deletion.deferred': 'A annulé la suppression d’un compte',
  'admin.auditLog.action.account.deletion.purged': 'A supprimé un compte pour de bon',
  'admin.auditLog.action.config.version.queried': 'A lu la version de la config',
  'admin.auditLog.action.config.schema.queried': 'A lu le schéma de la config',
  'admin.auditLog.action.config.env.queried': 'A lu l’environnement',
  'admin.auditLog.action.config.design.queried': 'A lu le design system',
  'admin.auditLog.action.table.overview.queried': 'A lu l’aperçu des tables',
  'admin.auditLog.action.table.record.created': 'A créé un enregistrement',
  'admin.auditLog.action.table.record.updated': 'A modifié un enregistrement',
  'admin.auditLog.action.table.record.deleted': 'A supprimé un enregistrement',
  'admin.auditLog.action.table.record.button.invoked': 'A appuyé sur un bouton d’enregistrement',
  'admin.auditLog.action.bucket.list.queried': 'A lu les buckets',
  'admin.auditLog.action.bucket.overview.queried': 'A lu l’aperçu des buckets',
  'admin.auditLog.action.bucket.files.queried': 'A lu les fichiers d’un bucket',
  'admin.auditLog.action.bucket.file.uploaded': 'A envoyé un fichier',
  'admin.auditLog.action.form.list.queried': 'A lu les formulaires',
  'admin.auditLog.action.form.detail.queried': 'A lu un formulaire',
  'admin.auditLog.action.form.submission.list.queried': 'A lu les réponses d’un formulaire',
  'admin.auditLog.action.form.submission.detail.queried': 'A lu une réponse',
  'admin.auditLog.action.form.submission.bulk.queried': 'A lu plusieurs réponses',
  'admin.auditLog.action.form.submission.body.revealed': 'A révélé les réponses d’une soumission',
  'admin.auditLog.action.form.submission.bodies.revealed':
    'A révélé les réponses de plusieurs soumissions',
  'admin.auditLog.action.form.analytics.queried': 'A lu l’analytique d’un formulaire',
  'admin.auditLog.action.form.export.queried': 'A exporté les réponses d’un formulaire',
  'admin.auditLog.action.user.overview.queried': 'A lu l’aperçu des utilisateurs',
  'admin.auditLog.action.user.role.changed': 'A changé un rôle',
  'admin.auditLog.action.user.impersonation.started': 'A commencé à agir en tant qu’utilisateur',
  'admin.auditLog.action.user.impersonation.stopped': 'A arrêté d’agir en tant qu’utilisateur',
  'admin.auditLog.action.user.banned': 'A banni un compte',
  'admin.auditLog.action.user.unbanned': 'A levé un bannissement',
  'admin.auditLog.action.user.password.set': 'A défini un mot de passe',
  'admin.auditLog.action.user.groups.changed': 'A changé des groupes',
  'admin.auditLog.action.scim.user.created': 'A provisionné un compte',
  'admin.auditLog.action.scim.user.updated': 'A modifié un compte provisionné',
  'admin.auditLog.action.scim.user.deactivated': 'A désactivé un compte provisionné',
  'admin.auditLog.action.scim.user.reactivated': 'A réactivé un compte provisionné',
  'admin.auditLog.action.scim.group.members.updated': 'A modifié les membres d’un groupe',
  'admin.auditLog.action.automation.overview.queried': 'A lu l’aperçu des automatisations',
  'admin.auditLog.action.automation.runs.list.queried': 'A lu les exécutions',
  'admin.auditLog.action.automation.runs.detail.queried': 'A lu une exécution',
  'admin.auditLog.action.automation.paused': 'A mis en pause une automatisation',
  'admin.auditLog.action.automation.resumed': 'A relancé une automatisation',
  'admin.auditLog.action.automation.auto_paused': 'Automatisation mise en pause d’elle-même',
  'admin.auditLog.action.agent.conversation.list.queried': 'A lu les conversations d’un agent',
  'admin.auditLog.action.agent.conversation.detail.queried': 'A lu une conversation',
  'admin.auditLog.action.agent.list.queried': 'A lu les agents',
  'admin.auditLog.action.agent.detail.queried': 'A lu un agent',
  'admin.auditLog.action.connection.list.queried': 'A lu les connexions',
  'admin.auditLog.action.connection.detail.queried': 'A lu une connexion',
  'admin.auditLog.action.link.created': 'A créé un lien',
  'admin.auditLog.action.link.updated': 'A redirigé un lien',
  'admin.auditLog.action.link.deleted': 'A supprimé un lien',
  'admin.auditLog.action.link.disabled': 'A désactivé un lien',
  'admin.auditLog.action.link.enabled': 'A réactivé un lien',
  'admin.auditLog.action.design.share.created': 'A partagé le design system',
  'admin.auditLog.action.design.share.revoked': 'A révoqué un partage du design system',
  'admin.auditLog.copyResourceId': 'Copier l’ID de la ressource',
  'admin.auditLog.count.one': '{count} événement',
  'admin.auditLog.count.other': '{count} événements',
  'admin.auditLog.filter.showReads': 'Afficher les lectures',

  'admin.auditLog.col.resource': 'Ressource',
  'admin.auditLog.col.resourceId': 'Identifiant',

  'admin.auditLog.col.result': 'Résultat',

  'admin.auditLog.col.transport': 'Accès',

  'admin.auditLog.result.success': 'Réussi',

  'admin.auditLog.result.failure': 'Échoué',

  'admin.auditLog.transport.configfile': 'Fichier de config',

  'admin.auditLog.transport.env': 'Environnement',

  'admin.auditLog.transport.api': 'API',

  'admin.auditLog.transport.mcp': 'MCP',

  'admin.auditLog.transport.restore': 'Restauration',

  'admin.auditLog.resource.user': 'Compte',

  'admin.auditLog.resource.config': 'Config',

  'admin.auditLog.resource.table': 'Table',

  'admin.auditLog.resource.record': 'Enregistrement',

  'admin.auditLog.resource.form': 'Formulaire',

  'admin.auditLog.resource.submission': 'Réponse',

  'admin.auditLog.resource.automation': 'Automatisation',

  'admin.auditLog.resource.automationRun': 'Exécution',

  'admin.auditLog.resource.agent': 'Agent',

  'admin.auditLog.resource.bucket': 'Bucket',

  'admin.auditLog.resource.link': 'Lien',

  'admin.auditLog.resource.connection': 'Connexion',

  'admin.auditLog.resource.group': 'Groupe',

  'admin.auditLog.resource.designShare': 'Partage du design',

  'admin.auditLog.empty':
    'Aucun événement pour l’instant. Chaque lecture et chaque modification d’un admin s’inscrit ici au moment où elle a lieu.',

  'admin.auditLog.noMatch':
    'Aucun événement ne correspond à ces filtres. Retire un filtre pour en voir plus.',

  'admin.auditLog.entry.title': 'Événement d’audit',

  'admin.auditLog.entry.details': 'Détails',
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
    'Déclarée dans ton fichier de config. Change-la là-bas, puis redéploie.',
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
  'admin.login.signedOut': 'Déconnexion effectuée.',
  'admin.login.submit': 'Se connecter',
  'admin.login.pending': 'Connexion…',
  'admin.login.cloudSignIn': 'Se connecter avec Sovrium Cloud',
  'admin.login.orEmail': 'Ou avec ton e-mail',
  'admin.login.credentialError.title': 'L’e-mail ou le mot de passe ne correspond pas.',
  'admin.login.credentialError.description': 'Vérifie les deux, ou réinitialise ton mot de passe.',
  'admin.login.credentialError.descriptionWithoutMail':
    'Vérifie les deux, ou demande à un admin de réinitialiser ton mot de passe.',
  'admin.login.credentialError.recovery': 'réinitialise ton mot de passe',

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
  'admin.resetPassword.missing.heading': 'Ce lien est absent ou a expiré.',
  'admin.resetPassword.missing.blurb':
    'Un lien de réinitialisation ne sert qu’une fois et expire au bout d’une heure.',
  'admin.resetPassword.missing.ask': 'En demander un nouveau',

  'admin.auth.backToSignIn': 'Retour à la connexion',

  'admin.locked.audit.gdpr.exportScope':
    'Télécharge une archive JSON de tes données (profil, enregistrements que tu as créés, réponses de formulaire, activité).',
  'admin.locked.audit.gdpr.erasureNotice':
    'Programmé dans 7 jours. Tu peux annuler d’ici là depuis cette page.',
  'admin.locked.audit.gdpr.erasureFinal':
    'Ensuite, ton compte et tes données sont supprimés pour de bon. Ils ne peuvent pas être restaurés.',
  'admin.locked.audit.apiKeys.scopeNotice':
    'Identifiants de longue durée pour les scripts et les services qui appellent cette instance en ton nom. Présente-en un dans l’en-tête x-api-key. Une clé porte ton propre rôle — elle ne peut jamais faire plus que toi.',
  'admin.locked.audit.env.secrecyNotice':
    'Définis une variable dans l’environnement où tu fais tourner cette instance, puis redémarre. La console rapporte ce qui a été résolu ; elle ne stocke ni ne révèle jamais une valeur.',
} as const
