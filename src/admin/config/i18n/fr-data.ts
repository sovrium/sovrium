/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The French twin of `data.ts`: the operator-data surfaces.
//
// Exact key parity with `data.ts`, in its key order. The rules every French
// string here follows (voice, no-break spaces) are in `fr.ts`, which merges
// the four.

export default {
  'admin.footprint.heading': 'Empreinte',
  'admin.footprint.blurb':
    'Ce que cette instance a consommé, et les leviers sous lesquels elle tourne. Chaque chiffre ci-dessous est soit mesuré par ce processus, soit déclaré par toi — chaque région dit lequel.',

  'admin.tables.heading': 'Enregistrements',
  'admin.tables.blurb':
    'Parcours et modifie les enregistrements de tes tables. Choisis une table pour ouvrir sa grille — cherche, trie, filtre, puis ouvre un enregistrement pour le modifier.',

  'admin.buckets.heading': 'Fichiers',
  'admin.buckets.blurb':
    'Parcours les fichiers stockés dans tes buckets. Choisis un bucket pour ouvrir son explorateur — cherche, trie, filtre par type, puis télécharge un fichier.',
  'admin.buckets.blurbBucket':
    'Les fichiers stockés dans ce bucket. Cherche, trie ou filtre par type, puis télécharge ou supprime un fichier.',
  'admin.buckets.blurbSystem':
    'Le bucket intégré. Il liste chaque document et chaque image joints à un enregistrement, avec le bucket, la table, l’enregistrement et le champ auxquels ils appartiennent, et stocke les pièces jointes dont le champ ne nomme aucun bucket.',

  'admin.agents.heading': 'Conversations',
  'admin.agents.blurb':
    'Toutes les conversations que tes utilisateurs ont eues avec cet agent. Ouvres-en une pour lire le fil complet.',
  'admin.agents.blurbSystem':
    'Les conversations avec l’agent Système intégré : l’assistant de Bienvenue, et toute discussion qui ne nomme aucun agent déclaré. Il lit les données de ton app sans jamais les modifier. Ouvres-en une pour lire le fil complet.',

  'admin.forms.heading': 'Réponses',
  'admin.forms.blurb':
    'Passe en revue les réponses que tu as reçues, formulaire par formulaire. Choisis un formulaire pour parcourir sa boîte de réception, ouvrir une réponse, ou tout exporter en CSV.',

  'admin.connections.heading': 'Connexions',
  'admin.connections.blurb':
    'Inspecte les connexions de ton app aux services externes et l’état de leurs jetons : actif, bientôt expiré, expiré, ou à reconnecter. Les connexions sont déclarées dans la config — ici, tu observes leur état réel.',
  'admin.connections.status.active': 'Actif',
  'admin.connections.status.expiringSoon': 'Bientôt expiré',
  'admin.connections.status.expired': 'Expiré',
  'admin.connections.status.reconnectNeeded': 'À reconnecter',
  'admin.connections.col.connection': 'Connexion',
  'admin.connections.col.provider': 'Fournisseur',
  'admin.connections.col.type': 'Type',
  'admin.connections.col.status': 'Statut',
  'admin.connections.col.tokens': 'Jetons',
  'admin.connections.col.expiration': 'Expiration',
  'admin.connections.col.created': 'Créée le',
  'admin.connections.col.actions': 'Actions',
  'admin.connections.type.apiKey': 'Clé d’API',
  'admin.connections.tokens.none': 'Aucun jeton',
  'admin.connections.tokens.one': '1 utilisateur',
  'admin.connections.tokens.two': '2 utilisateurs',
  'admin.connections.action.connect': 'Connecter',
  'admin.connections.action.reconnect': 'Reconnecter',
  'admin.connections.action.disconnect': 'Déconnecter',
  'admin.connections.action.disconnectConfirm': 'Révoquer les jetons de cette connexion ?',
  'admin.connections.search': 'Rechercher une connexion',
  'admin.connections.noMatch': 'Aucune connexion ne correspond à « {query} »',
  'admin.connections.empty': 'Aucune connexion',

  // ── Organisation (`/organisation`) ──────────────────────────────────────
  //
  // Le vocabulaire de sécurité en français, fixé une fois ici pour les cinq
  // vues : « droit » pour *grant*, « source de droits » pour *grant source*,
  // « barreau ouvert » pour *open rung* (le `*` de la config), « constat » pour
  // *finding*. Un terme par notion, comme en anglais.
  'admin.organisation.heading': 'Organisation',
  'admin.organisation.blurb':
    'Ce que cette application expose : les chemins d’écriture accessibles sans connexion, les ressources lisibles par tout le monde, et les endroits où une seule personne relie deux parties de l’app. La matrice croise chaque ressource avec chaque source de droits, où une absence se lit aussi nettement qu’un droit. La carte dessine la chaîne elle-même — qui agit, ce qui l’autorise, et ce que cela atteint. Les couloirs dessinent l’autre moitié, celle où personne n’agit : chaque automatisation et les étapes qu’elle exécute seule.',
  'admin.organisation.tabs.region': 'Vues de l’organisation',
  'admin.organisation.findings.region': 'Constats structurels',
  'admin.organisation.findings.blurb':
    'Trois vérifications structurelles sur la configuration avec laquelle ce serveur tourne, refaites à chaque ouverture de la page. Rien n’est stocké et rien ne s’acquitte — un constat disparaît quand la configuration qui l’a causé change.',
  'admin.organisation.matrix.region': 'Matrice des droits',
  'admin.organisation.matrix.blurb':
    'Chaque ressource face à chaque source de droits, classées par privilège, le barreau ouvert en dernier. Une case est un droit, une case vide n’en est aucun — la moitié qu’une liste de constats ne peut pas montrer, parce que les trois vérifications rapportent ce qui est exposé et jamais ce qui est hors d’atteinte.',
  'admin.organisation.map.region': 'Carte des accès',
  'admin.organisation.map.blurb':
    'La chaîne que la matrice replie : les personnes et les agents qui agissent, les rôles, les équipes et le barreau ouvert qui les autorisent, et les ressources qu’ils atteignent — dessinés de gauche à droite, une ligne par droit. Sélectionner un élément suit sa chaîne et estompe ce qu’il ne touche pas. Le tableau en dessous porte les mêmes nœuds et les mêmes droits en texte.',
  'admin.organisation.processes.region': 'Couloirs d’automatisation',
  'admin.organisation.processes.blurb':
    'Ce qui tourne sans personne devant : chaque automatisation en couloir, et les étapes qu’elle parcourt, dans l’ordre où elle les parcourt. Un couloir en pointillés est en pause ; un couloir gris est désactivé dans la configuration. Le tableau en dessous porte les mêmes couloirs et les mêmes étapes en texte.',

  'admin.organisation.tabs.findings': 'Constats',
  'admin.organisation.tabs.matrix': 'Matrice',
  'admin.organisation.tabs.map': 'Carte',
  'admin.organisation.tabs.reach': 'Portée',
  'admin.organisation.tabs.processes': 'Processus',

  'admin.organisation.degraded.heading': 'Une partie du graphe n’a pas pu être lue.',
  'admin.organisation.degraded.body':
    'Les constats qui dépendent de la source non lue manquent, plutôt qu’ils n’existent pas : cette liste est donc incomplète. Regarde le journal du serveur pour l’erreur.',

  'admin.organisation.matrix.label':
    'Les ressources par source de droits. Le tableau en dessous porte les mêmes droits en texte.',
  'admin.organisation.matrix.empty':
    'Rien à croiser. Cette app ne déclare aucune ressource, ou aucun rôle, aucune équipe et aucun droit ouvert qui pourrait les atteindre.',
  'admin.organisation.matrix.flag': 'Par le barreau ouvert',

  'admin.organisation.map.label':
    'Qui atteint quoi, et par quel droit. Le tableau en dessous porte les mêmes nœuds et les mêmes droits en texte.',
  'admin.organisation.map.empty':
    'Rien à cartographier. Cette app ne déclare personne qui agit, aucune source de droits, ou aucune ressource qu’ils pourraient atteindre.',
  'admin.organisation.map.column.principals': 'Qui agit',
  'admin.organisation.map.column.grantSources': 'Sources de droits',
  'admin.organisation.map.column.resources': 'Ressources',

  'admin.organisation.processes.label':
    'Chaque automatisation en couloir, avec les étapes qu’elle y exécute. Le tableau en dessous porte les mêmes couloirs et les mêmes étapes en texte.',
  'admin.organisation.processes.empty':
    'Rien ne tourne tout seul. Cette app ne déclare aucune automatisation.',
  'admin.organisation.processes.lane': 'Automatisation',
  'admin.organisation.processes.stations': 'Étapes, dans l’ordre',

  'admin.organisation.reach.region': 'Le graphe d’accès en texte',
  'admin.organisation.reach.blurb':
    'Chaque relation du graphe, une par ligne — les mêmes faits que dessinent la carte et la grille, triables et copiables. Trie par Voie pour voir ce que le barreau ouvert atteint.',
  'admin.organisation.reach.things': 'Éléments',
  'admin.organisation.reach.relationships': 'Relations',
  'admin.organisation.reach.from': 'Source',
  'admin.organisation.reach.kind': 'Relation',
  'admin.organisation.reach.to': 'Cible',
  'admin.organisation.reach.ops': 'Permet',
  'admin.organisation.reach.route': 'Voie',
  'admin.organisation.reach.openRung': 'Barreau ouvert',
  'admin.organisation.reach.kind.member': 'tient le rôle',
  'admin.organisation.reach.kind.grant': 'reçoit',
  'admin.organisation.reach.kind.trigger': 'peut déclencher',
  'admin.organisation.reach.kind.escalation': 'escalade vers',
  'admin.organisation.reach.kind.step': 'puis',
  'admin.organisation.reach.empty':
    'Aucune relation. Rien dans cette app n’accorde quoi que ce soit à qui que ce soit.',

  // Position structurelle. Les quatre libellés sont des VERBES conjugués à la
  // troisième personne, parce qu’ils se lisent avec le nom de la personne à
  // gauche : « Léa Fontaine · Détient 2 · Atteint 14 ». Un substantif
  // (« Détentions ») casserait cette lecture, qui est toute la raison d’être
  // de la grille.
  'admin.organisation.reach.position.heading': 'Position structurelle',
  'admin.organisation.reach.position.holds': 'Détient',
  'admin.organisation.reach.position.reaches': 'Atteint',
  'admin.organisation.reach.position.writes': 'Modifie',
  'admin.organisation.reach.position.duplicateRoutes': 'Voies en double',

  // Restrictions déclarées, sous la grille de la Matrice.
  //
  // `scope` se dit « Axe » et non « Portée » : « Portée » est déjà le libellé
  // de l’onglet Reach juste à côté (`admin.organisation.tabs.reach`), et deux
  // sens pour un mot sur une même page est exactement ce qu’un glossaire
  // partagé doit empêcher. L’anglais garde « Scope », le mot du contrat.
  'admin.organisation.exceptions.heading': 'Là où une case ne dit pas tout',
  'admin.organisation.exceptions.resource': 'Ressource',
  'admin.organisation.exceptions.scope': 'Axe',
  'admin.organisation.exceptions.scope.field': 'Colonnes',
  'admin.organisation.exceptions.scope.row': 'Lignes',
  'admin.organisation.exceptions.op': 'Opération',
  'admin.organisation.exceptions.field': 'Champ',
  'admin.organisation.exceptions.rung': 'Accordé à',
  'admin.organisation.exceptions.rung.everyone': 'Tout le monde',
  'admin.organisation.exceptions.rung.anySession': 'Toute personne connectée',
  'admin.organisation.exceptions.rung.roles': 'Rôles nommés',
  'admin.organisation.exceptions.detail': 'Détail',
  'admin.organisation.exceptions.empty': 'Aucune restriction déclarée.',

  'admin.users.heading': 'Utilisateurs',
  'admin.users.blurb':
    'Gère les comptes de ton app : cherche un utilisateur, ajuste son rôle ou ses groupes, ou suspends son accès. La création de compte passe par l’API admin (voir Développeurs → API).',
  'admin.users.tabs.region': 'Sous-vues Utilisateurs',
  'admin.users.account.heading': 'Compte',
  'admin.users.account.blurb':
    'Un compte\u00a0: son rôle, ses groupes et son statut, les écritures qu’une administratrice peut y faire, et ce que la console ne sait pas encore en montrer.',
  'admin.users.account.region': 'Compte',
  'admin.users.account.back': 'Retour aux utilisateurs',
  'admin.users.account.roles.region': 'Rôles assignables',
  'admin.users.account.roles.heading': 'Rôles assignables',
  'admin.users.account.roles.body':
    'Tous les rôles que cette app peut assigner, lus dans sa configuration. Les rôles sont déclarés dans auth.roles[]\u00a0; la console les lit et ne les écrit jamais.',
  'admin.users.account.gaps.region': 'Non montré ici',
  'admin.users.account.gaps.heading': 'Non montré ici',
  'admin.users.account.gaps.sessions.heading': 'Sessions ouvertes',
  'admin.users.account.gaps.sessions.body':
    'Fermer toutes les sessions se fait ci-dessus, dans les actions de la ligne. Les lister, non\u00a0: le point d’accès qui les renvoie répond à un POST, et une lecture de console est un GET.',
  'admin.users.account.gaps.activity.heading': 'Dernière activité',
  'admin.users.account.gaps.activity.body':
    'L’annuaire renvoie id, e-mail, nom, rôle, statut et groupes. Un instant de dernière activité par compte demande une jointure sur la table des sessions, qu’aucune lecture ne fait.',

  'admin.invitations.heading': 'Invitations',
  'admin.invitations.blurb':
    'Invite quelqu’un sur cette app, vois quelles invitations sont encore en attente, et reprends-en une avant qu’elle soit acceptée.',

  'admin.pages.heading': 'Analytique',
  'admin.pages.blurb':
    'Mesure l’audience de tes pages sur les 30 derniers jours : vues, visiteurs et sessions, la tendance dans le temps, les pages les plus vues, d’où vient le trafic, avec quoi il navigue, et le journal brut des événements.',
  'admin.pages.blurbDisabled':
    'Mesure l’audience de tes pages — vues, visiteurs, sessions et leurs sources. L’analytique est désactivée pour cette app ; active-la pour commencer à collecter.',
  'admin.pages.tabs.region': 'Sous-vues Analytique',

  'admin.automations.heading': 'Exécutions',
  'admin.automations.blurb':
    'Toutes les exécutions de cette app, et les automatisations dont elles viennent. Mets-en une en pause pour arrêter son exécution sans changer ta config ; une automatisation désactivée dans ta config d’app ne peut être réactivée que là.',
  'admin.automations.tabs.region': 'Sous-vues Exécutions',
  'admin.automations.metrics.region': 'Indicateurs des exécutions',
  'admin.automations.tabs.history': 'Historique',
  'admin.automations.tabs.automations': 'Automatisations',
  'admin.automations.metrics.automations': 'Automatisations',
  'admin.automations.metrics.runs24h': 'Exécutions (24\u00a0h)',
  'admin.automations.metrics.failures24h': 'Échecs (24\u00a0h)',
  'admin.automations.metrics.successRate': 'Taux de réussite',
  'admin.automations.cancel': 'Annuler',

  'admin.links.heading': 'Liens',
  'admin.links.blurb':
    'Vois comment tes liens courts performent, et ouvre celui que tu veux changer. Les chiffres viennent du même magasin de clics que lit la surface Analytique ; le catalogue ci-dessous liste chaque lien que cette instance sert, qu’il ait été déclaré dans la config ou créé ici.',

  'admin.agents.region': 'Conversations',
  'admin.agents.loading': 'Chargement des conversations…',
  'admin.automations.region': 'Automatisations',
  'admin.buckets.browser.region': 'Explorateur de fichiers',
  'admin.buckets.upload.region': 'Envoyer un fichier',
  'admin.connections.region': 'Connexions',
  'admin.forms.metrics.region': 'Indicateurs du formulaire',
  'admin.forms.submissions.region': 'Réponses',
  'admin.users.metrics.region': 'Indicateurs des utilisateurs',
  'admin.users.region': 'Utilisateurs',
  'admin.invitations.form.region': 'Inviter un coéquipier',
  'admin.invitations.pending.region': 'Invitations en attente',

  'admin.tables.empty.heading': 'Aucune table',
  'admin.tables.empty.body':
    'Cette app ne déclare encore aucune table. Ajoutes-en une dans ta config d’app pour commencer à capturer des enregistrements.',
  'admin.tables.empty.hint': 'Ajoute une table d’abord — les enregistrements suivront.',
  'admin.forms.empty.heading': 'Aucun formulaire',
  'admin.forms.empty.body':
    'Cette app ne déclare encore aucun formulaire. Ajoutes-en un dans ta config d’app pour commencer à recevoir des réponses.',
  'admin.forms.empty.hint': 'Aucun formulaire pour l’instant — la boîte de réception suivra.',
  'admin.automations.empty.heading': 'Aucune automatisation',
  'admin.automations.empty.body':
    'Cette app ne déclare encore aucune automatisation. Ajoutes-en une dans ta config d’app pour voir ses exécutions apparaître ici.',
  'admin.automations.empty.hint': 'Aucune automatisation pour l’instant — donc rien à exécuter.',

  'admin.automations.catalog.reason': 'Motif de la pause',
  'admin.automations.catalog.reason.automatic': 'Automatique, après des échecs répétés',
  'admin.automations.catalog.col.automation': 'Automatisation',
  'admin.automations.catalog.col.trigger': 'Déclencheurs',
  'admin.automations.catalog.col.state': 'État',
  'admin.automations.catalog.col.pausedBy': 'Mise en pause par',
  'admin.automations.catalog.col.pausedAt': 'Mise en pause le',
  'admin.automations.catalog.state.active': 'Active',
  'admin.automations.catalog.state.paused': 'En pause',
  'admin.automations.catalog.state.disabled': 'Désactivée dans la config',
  'admin.automations.catalog.action.pause': 'Mettre en pause',
  'admin.automations.catalog.action.resume': 'Reprendre',
  'admin.automations.catalog.pause.title': 'Mettre cette automatisation en pause\u00a0?',
  'admin.automations.catalog.pause.message':
    'Les nouvelles exécutions s’arrêtent jusqu’à la reprise. Une exécution déjà en cours n’est pas annulée.',
  'admin.automations.catalog.pause.toast': 'Automatisation mise en pause',
  'admin.automations.catalog.resume.toast': 'Automatisation reprise',
  'admin.automations.catalog.empty': 'Aucune automatisation',

  'admin.automations.runs.heading': 'Historique des exécutions',
  'admin.automations.runs.scope':
    'Affiche les 25 exécutions les plus récentes. La recherche et les filtres interrogent toutes les exécutions et renvoient les 25 correspondances les plus récentes.',
  'admin.automations.runs.filter.all': 'Toutes',
  'admin.automations.runs.filter.automation': 'Filtrer par automatisation',
  'admin.automations.runs.filter.trigger': 'Filtrer par déclencheur',
  'admin.automations.runs.filter.allTriggers': 'Tous',
  'admin.automations.runs.filter.status': 'Filtrer par statut',
  'admin.automations.runs.status.success': 'Réussie',
  'admin.automations.runs.status.failed': 'Échouée',
  'admin.automations.runs.status.partial': 'Partielle',
  'admin.automations.runs.status.waitingApproval': 'En attente de validation',
  'admin.automations.runs.status.waitingDelay': 'En attente de reprise',
  'admin.automations.runs.status.rejected': 'Refusée',
  'admin.automations.runs.status.cancelled': 'Annulée',
  'admin.automations.runs.status.retriesExhausted': 'Tentatives épuisées',
  'admin.automations.runs.status.timedOut': 'Expirée',
  'admin.automations.runs.status.queued': "En file d'attente",
  'admin.automations.runs.status.running': 'En cours',
  'admin.automations.runs.status.skipped': 'Ignorée',
  'admin.automations.runs.step.filtered': 'Filtrée',
  'admin.automations.runs.step.waiting': 'En attente',
  'admin.automations.runs.col.automation': 'Automatisation',
  'admin.automations.runs.col.trigger': 'Déclencheur',
  'admin.automations.runs.col.status': 'Statut',
  'admin.automations.runs.col.started': 'Démarrée',
  'admin.automations.runs.col.duration': 'Durée',
  'admin.automations.runs.action.view': 'Voir l’exécution',
  'admin.automations.runs.search': 'Rechercher des exécutions',
  'admin.automations.runs.empty': 'Aucune exécution',
  'admin.automations.runs.noMatch': 'Aucune exécution ne correspond à «\u00a0{query}\u00a0»',
  'admin.automations.runs.detail.configuredInCode':
    'Configurée dans le code, pas ici. Modifie la configuration de l’app puis redémarre.',
  'admin.automations.runs.detail.blurb':
    'Une exécution : ce qu’elle a reçu, et ce que chaque étape a fait et journalisé.',
  'admin.automations.runs.detail.noLogs': 'Cette étape n’a rien journalisé.',
  'admin.automations.runs.detail.field.automation': 'Automatisation',
  'admin.automations.runs.detail.field.status': 'Statut',
  'admin.automations.runs.detail.field.trigger': 'Déclencheur',
  'admin.automations.runs.detail.field.started': 'Démarrée',
  'admin.automations.runs.detail.field.finished': 'Terminée',
  'admin.automations.runs.detail.field.duration': 'Durée (ms)',
  'admin.automations.runs.detail.field.attempt': 'Tentative',
  'admin.automations.runs.detail.failure': 'Échec',
  'admin.automations.runs.detail.log': 'Journal',
  'admin.automations.runs.detail.dataIn': 'Données en entrée',
  'admin.automations.runs.detail.dataOut': 'Données en sortie',
  'admin.automations.runs.detail.steps': 'Étapes',
  'admin.automations.runs.detail.back': 'Retour aux exécutions',
  'admin.automations.runs.detail.retry': 'Relancer',
  'admin.automations.runs.detail.retry.title': 'Confirmer la relance',
  'admin.automations.runs.detail.retry.message':
    'L’automatisation s’exécute de nouveau, comme une nouvelle exécution. Celle-ci reste telle quelle.',
  'admin.automations.runs.detail.retry.toast': 'Relance lancée',
  'admin.automations.runs.detail.retry.error': 'L’exécution n’a pas été relancée.',

  'admin.forms.openForm': 'Ouvrir le formulaire',
  'admin.forms.conversion.heading': 'Taux de conversion',
  'admin.forms.conversion.why':
    'Le taux de conversion demande un compteur de vues — Sovrium ne le mesure pas encore.',
  'admin.forms.tabs.region': 'Sous-vues Réponses',
  'admin.forms.trend.region': 'Réponses dans le temps',
  'admin.forms.gaps.region': 'Chiffres pas encore mesurés',
  'admin.forms.gaps.heading': 'Pas encore mesuré',
  'admin.forms.metric.unmeasured': 'pas mesuré',
  'admin.forms.duration.heading': 'Temps de remplissage moyen',
  'admin.forms.duration.why':
    'Chronométrer une réponse demande le moment où le formulaire a été ouvert ; seul celui où elle est arrivée est enregistré.',
  'admin.forms.attachments.heading': 'Pièces jointes',
  'admin.forms.attachments.why':
    'Les compter demande de lire les données de chaque réponse, ce que la requête d’agrégat évite volontairement pour rester légère.',
  'admin.forms.dropOff.heading': 'Abandon par étape',
  'admin.forms.dropOff.why':
    'Savoir où quelqu’un s’est arrêté demande une trace des étapes atteintes ; un formulaire multi-étapes ne stocke que ce qu’il a reçu.',
  'admin.forms.export.region': 'Exporter en CSV',
  'admin.forms.scope':
    'Affiche les 25 réponses les plus récentes. La recherche interroge toutes les réponses et renvoie les 25 correspondances les plus récentes.',

  'admin.pages.metrics.region': 'Indicateurs d’audience',
  'admin.pages.trend.region': 'Tendance de l’audience',
  'admin.pages.top.region': 'Pages les plus vues',
  'admin.pages.acquisition.heading': 'Acquisition',
  'admin.pages.referrers.region': 'Principaux référents',
  'admin.pages.campaigns.region': 'Campagnes',
  'admin.pages.technology.heading': 'Technologie',
  'admin.pages.devices.region': 'Types d’appareil',
  'admin.pages.browsers.region': 'Navigateurs',
  'admin.pages.os.region': 'Systèmes d’exploitation',
  'admin.pages.events.heading': 'Journal des événements',
  'admin.pages.disabled.region': 'Analytique non activée',
  'admin.pages.disabled.heading': 'L’analytique n’est pas activée',
  'admin.pages.disabled.body':
    'Active l’analytique dans ta config d’app (analytics) pour mesurer l’audience, les visiteurs et les sessions de tes pages.',
  'admin.pages.disabled.hint': 'Rien à mesurer tant que l’analytique n’est pas activée.',

  'admin.links.period.region': 'Période',
  'admin.links.period.24h': '24 h',
  'admin.links.period.7d': '7 j',
  'admin.links.period.30d': '30 j',
  'admin.links.metrics.region': 'Indicateurs des liens',
  'admin.links.trend.region': 'Tendance des clics',
  'admin.links.catalog.region': 'Catalogue des liens',
  'admin.links.unavailable.region': 'Indicateurs des liens indisponibles',
  'admin.links.unavailable.heading': 'Les mesures de clics ne sont pas disponibles',
  'admin.links.unavailable.body':
    'Les clics sur les liens sont enregistrés par le moteur d’analytique intégré. Active l’analytique dans ta config d’app pour les mesurer — le catalogue ci-dessous fonctionne dans les deux cas.',
  'admin.links.definition.heading': 'Définition',
  'admin.links.definition.region': 'Définition du lien',
  'admin.links.qr.region': 'Code QR',
  'admin.links.qr.download': 'Télécharger le SVG',
  'admin.links.audience.heading': 'Audience',
  'admin.links.referrers.region': 'Référents',
  'admin.links.devices.region': 'Appareils',
  'admin.links.campaigns.region': 'Campagnes',
  'admin.links.clickLog.heading': 'Journal des clics',
  'admin.links.clickLog.region': 'Journal des clics',
  'admin.links.definition.full': 'Définition complète',
  'admin.links.create.region': 'Nouveau lien',
  'admin.links.create.heading': 'Nouveau lien',
  'admin.links.create.body':
    'Un slug et sa destination. Le titre, les paramètres de campagne et l’expiration se règlent sur la page du lien, une fois qu’il existe.',
  'admin.links.manage.region': 'Gérer ce lien',
  'admin.links.manage.heading': 'Gérer',
  'admin.links.manage.repoint': 'Rediriger ce lien',
  'admin.links.manage.config.heading': 'Déclaré dans la configuration',
  'admin.links.manage.config.body':
    'Ce lien est déclaré dans app.links[]. Modifie le fichier de configuration et redémarre pour le changer ; la console n’écrit jamais la configuration.',

  'admin.templates.heading': 'Modèles',
  'admin.templates.blurb':
    'Les documents et e-mails que tes automatisations remplissent. Ouvre-en un pour le voir rempli avec ses données d’exemple. Un modèle se modifie dans la configuration, jamais ici.',
  'admin.templates.list.region': 'Modèles déclarés',
  'admin.templates.row.readBy': 'Lu par',
  'admin.templates.row.sample': 'Données d’exemple',
  'admin.templates.row.noSample': 'Sans données d’exemple',
  'admin.templates.empty.title': 'Aucun modèle',
  'admin.templates.empty.body':
    'Cette application ne déclare aucun modèle. Un modèle est un fichier HTML, SVG, texte, Word, Excel ou PowerPoint qu’une automatisation remplit avec des données : une facture, une planche d’étiquettes, un e-mail de relance.',
  'admin.templates.empty.hint':
    'Déclares-en un dans assets, dans la configuration, avec sampleData pour le prévisualiser ici.',
  'admin.templates.preview.blurb':
    'Ce modèle rendu avec ses données d’exemple, par le même moteur qu’une automatisation.',
  'admin.templates.preview.document':
    'Rempli avec ses données d’exemple, comme le rend une automatisation. Les scripts et les images distantes ne se chargent pas ici.',
  'admin.templates.preview.email':
    'Affiché tel que email/send le distribue : règles de style intégrées aux éléments, bloc style retiré.',
  'admin.templates.noSample.title': 'Pas de données d’exemple',
  'admin.templates.noSample.body':
    'Ce modèle ne déclare pas de sampleData : ses champs s’affichent vides. Ajoute sampleData à cet asset dans la configuration pour le prévisualiser rempli.',
  'admin.templates.file.title': 'Ce modèle produit un fichier',
  'admin.templates.file.body':
    'Les modèles Word, Excel et PowerPoint produisent un fichier : il n’y a rien à afficher dans le navigateur. Pour le rendre avec ses données d’exemple, lance cette commande dans le dossier du projet :',

  'admin.footprint.measured.heading': 'Mesuré',
  'admin.footprint.storage.heading': 'Stockage',
  'admin.footprint.storage.region': 'Consommateurs de stockage',
  'admin.footprint.configuration.heading': 'Configuration',
  'admin.footprint.levers.region': 'Leviers éco',
  'admin.footprint.rgesn.blurb':
    'L’écoconception est une pratique de conception, pas un état d’exécution, donc elle n’est pas notée ici. La façon dont le moteur se mesure au référentiel français est publiée une fois, pour toutes les installations :',
  'admin.footprint.rgesn.link': 'Comment Sovrium se situe face au RGESN 2024',

  'admin.locked.audit.footprint.measuredProvenance':
    'Mesuré par ce processus depuis son démarrage ; les compteurs sont remis à zéro quand il redémarre. Les notes lisent le Content-Length de chaque réponse via l’en-tête X-Eco-Index — ce n’est pas un score Lighthouse ou EcoIndex.fr, qui inspectent la page rendue. Mets ECO_INDEX_HEADER=on pour les enregistrer. Le taux de succès ne compte que les rendus proposés au cache : les requêtes authentifiées et dynamiques le contournent, donc une instance sans trafic anonyme affiche — plutôt qu’un taux.',
  'admin.locked.audit.footprint.storageProvenance':
    'Les trois plus gros consommateurs, mesurés à la demande. Chaque ligne nomme l’instrument derrière son chiffre, parce qu’une taille sans origine déclarée ne se distingue pas d’une taille que personne n’a prise. Une taille vide signifie que la sonde était indisponible — un zéro signifie que la ressource a été mesurée et qu’elle est vide.',
  'admin.locked.audit.footprint.configurationProvenance':
    'Lu depuis l’environnement à chaque requête, donc un changement prend effet au rafraîchissement suivant. La configuration est déclarée, pas mesurée : elle décrit comment cette instance est réglée, pas ce qu’elle a émis.',
} as const
