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
  'admin.tables.heading': 'Enregistrements',
  'admin.tables.blurb':
    'Parcours et modifie les enregistrements de tes tables. Choisis une table pour ouvrir sa grille — cherche, trie, filtre, puis ouvre un enregistrement pour le modifier.',
  'admin.tables.blurbTable':
    'Cherche, trie et filtre les enregistrements de cette table. Ouvre une ligne pour la modifier.',
  'admin.tables.toolbar': 'Contrôles des enregistrements',
  'admin.tables.search': 'Chercher dans les lignes',
  'admin.tables.export': 'Exporter en CSV',
  'admin.tables.import': 'Importer un CSV',

  'admin.buckets.heading': 'Fichiers',
  'admin.buckets.blurb':
    'Parcours les fichiers stockés dans tes buckets. Choisis un bucket pour ouvrir son explorateur — cherche, trie, filtre par type, puis télécharge un fichier.',
  'admin.buckets.blurbBucket': 'Les fichiers rangés dans ce bucket.',
  'admin.buckets.blurbSystem':
    'Les fichiers que Sovrium garde pour ton app : pièces jointes des enregistrements, exports et documents générés.',

  'admin.agents.heading': 'Conversations',
  'admin.agents.blurb':
    'Toutes les conversations que les gens ont eues avec cet agent. Ouvre-en une pour lire le fil complet.',
  'admin.agents.blurbSystem':
    'L’assistant de Sovrium pour cette app : il lit ta config et tes enregistrements pour répondre aux questions, sans jamais les modifier.',
  'admin.conversations.person': 'Personne',
  'admin.conversations.everyone': 'Tout le monde',
  'admin.conversations.period': 'Période',
  'admin.conversations.allTime': 'Depuis le début',
  'admin.conversations.last7': '7 derniers jours',
  'admin.conversations.last30': '30 derniers jours',
  'admin.conversations.last90': '90 derniers jours',
  'admin.conversations.search': 'Rechercher…',
  'admin.conversations.searchLabel': 'Rechercher des conversations',
  'admin.conversations.toolbar': 'Contrôles des conversations',
  'admin.agents.viewer': 'Conversations de l’agent',
  'admin.agents.header.conversations': 'conversations',
  'admin.agents.header.model': 'Modèle',
  'admin.agents.header.tools': 'Outils',

  'admin.forms.heading': 'Réponses',
  'admin.forms.blurb':
    'Passe en revue les réponses que tu as reçues, formulaire par formulaire. Choisis un formulaire pour parcourir sa boîte de réception, ouvrir une réponse, ou tout exporter en CSV.',
  'admin.forms.blurbForm':
    'Ce que les gens ont envoyé par ce formulaire. Ouvre une réponse pour la lire.',

  'admin.connections.heading': 'Connexions',
  'admin.connections.blurb':
    'Inspecte les connexions de ton app aux services externes et l’état de leurs jetons : actif, bientôt expiré, expiré, ou à reconnecter. Les connexions sont déclarées dans la config — ici, tu observes leur état réel.',
  'admin.connections.status.active': 'Actif',
  'admin.connections.status.expiringSoon': 'Bientôt expiré',
  'admin.connections.status.expired': 'Expiré',
  'admin.connections.status.reconnectNeeded': 'À reconnecter',
  'admin.connections.status.notConnected': 'Non connectée',
  'admin.connections.col.connection': 'Connexion',
  'admin.connections.col.type': 'Type',
  'admin.connections.col.status': 'Statut',
  'admin.connections.col.tokens': 'Jetons',
  'admin.connections.col.expiration': 'Expiration',
  'admin.connections.col.created': 'Créée le',
  'admin.connections.col.usedBy': 'Utilisée par',
  'admin.connections.col.lastUsed': 'Dernière utilisation',
  'admin.connections.col.lastError': 'Dernière erreur',
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
  'admin.organisation.heading': 'Accès',
  'admin.organisation.blurb':
    'Qui peut atteindre quoi dans cette app, et où l’accès est plus large qu’il ne devrait. Chaque constat nomme la règle à changer dans ta config.',
  'admin.organisation.tabs.region': 'Vues des accès',
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

  'admin.organisation.tabs.matrix': 'Matrice',
  'admin.organisation.findingsFact': 'constats',
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
  'admin.organisation.graph.flag': 'Nommé par un constat',

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
    'Les comptes et les invitations de ton app : le rôle, les groupes et le statut de chaque compte.',
  'admin.users.tabs.region': 'Sous-vues Utilisateurs',
  'admin.users.account.heading': 'Compte',
  'admin.users.account.blurb':
    'Un compte\u00a0: son rôle, ses groupes et son statut, les écritures qu’une administratrice peut y faire, et ce qu’il peut lire.',
  'admin.users.account.facts.region': 'Détails du compte',
  'admin.users.account.actions.region': 'Actions sur le compte',
  'admin.users.col.lastActive': 'Dernière activité',
  'admin.users.filter.role': 'Filtrer par rôle',
  'admin.users.filter.allRoles': 'Tous les rôles',
  'admin.users.filter.status': 'Filtrer par statut',
  'admin.users.filter.allStatuses': 'Tous les statuts',
  'admin.users.account.created': 'Créé le',
  'admin.users.account.lastSignIn': 'Dernière connexion',
  'admin.users.account.sessions': 'Sessions actives',
  'admin.users.account.twoFactor': 'Double authentification',
  'admin.users.account.signInMethods': 'Modes de connexion',
  'admin.users.account.danger.region': 'Bannir ou supprimer',
  'admin.users.account.danger.heading': 'Bannir ou supprimer ce compte',
  'admin.users.account.danger.body':
    'Bannir déconnecte cette personne et l’empêche de se reconnecter jusqu’à ce que tu lèves le bannissement. Supprimer efface le compte, sans retour possible.',
  'admin.users.account.danger.self':
    'C’est ton compte. Pour le bannir ou le supprimer, demande à un autre admin.',
  'admin.users.account.roles.region': 'Rôles assignables',
  'admin.users.account.roles.heading': 'Rôles assignables',
  'admin.users.account.roles.source': 'depuis ton fichier de config',
  'admin.users.account.access.region': 'Accès',
  'admin.users.account.access.heading': 'Accès',
  'admin.users.account.access.body':
    'Ce que cette personne peut lire et écrire, avec l’accès derrière chaque ligne. Les accès se modifient par l’API, le seed ou les automatisations, jamais ici.',
  'admin.users.account.access.grid': 'Autorisations',
  'admin.users.account.access.reach': 'Organisation › Portée',

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
  'admin.automations.metrics.showFailed': 'Voir les exécutions en échec',
  'admin.automations.metrics.successRate': 'Taux de réussite',
  'admin.automations.cancel': 'Annuler',

  'admin.links.heading': 'Liens',
  'admin.links.blurb':
    'Vois comment tes liens courts performent, et ouvre celui que tu veux changer. Les chiffres viennent du même magasin de clics que lit la surface Analytique ; le catalogue ci-dessous liste chaque lien que cette instance sert, qu’il ait été déclaré dans la config ou créé ici.',

  'admin.agents.region': 'Conversations',
  'admin.agents.loading': 'Chargement des conversations…',
  'admin.automations.region': 'Automatisations',
  'admin.buckets.browser.region': 'Explorateur de fichiers',
  'admin.buckets.layout': 'Affichage',
  'admin.buckets.layout.list': 'Liste',
  'admin.buckets.layout.grid': 'Grille',
  'admin.buckets.upload.failed': 'Impossible d’envoyer {file}.',
  // The three rules keys keep a space at each end: they sit between other
  // elements of one line, and the spaces are what separate the words for a
  // screen reader (the line's flex gap is not text).
  'admin.buckets.public': 'Public',
  'admin.connections.region': 'Connexions',
  'admin.forms.metrics.region': 'Indicateurs du formulaire',
  'admin.forms.submissions.region': 'Réponses',
  'admin.users.metrics.region': 'Indicateurs des utilisateurs',
  'admin.users.region': 'Utilisateurs',
  'admin.invitations.form.region': 'Inviter un coéquipier',
  'admin.invitations.form.blurb': 'Cette personne reçoit un e-mail avec un lien pour rejoindre.',
  'admin.invitations.sent': 'Invitation envoyée à $response.user.email',
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

  'admin.automations.catalog.col.automation': 'Automatisation',
  'admin.automations.catalog.col.trigger': 'Déclencheurs',
  'admin.automations.catalog.col.state': 'État',
  'admin.automations.catalog.col.paused': 'En pause',
  'admin.automations.catalog.state.active': 'Active',
  'admin.automations.catalog.state.paused': 'En pause',
  'admin.automations.catalog.state.disabled': 'Désactivée dans la config',
  'admin.automations.catalog.action.pause': 'Mettre en pause',
  'admin.automations.catalog.action.resume': 'Reprendre',
  'admin.automations.catalog.pause.title': 'Mettre cette automatisation en pause\u00a0?',
  'admin.automations.catalog.pause.message':
    'Les nouvelles exécutions s’arrêtent jusqu’à la reprise. Une exécution déjà en cours n’est pas annulée.',
  'admin.automations.catalog.pause.toast': '$record.name mise en pause',
  'admin.automations.catalog.pause.failed': 'Impossible de mettre $record.name en pause.',
  'admin.automations.catalog.pause.retry': 'Réessayer',
  'admin.automations.catalog.resume.toast': 'Automatisation reprise',
  'admin.automations.catalog.empty': 'Aucune automatisation',

  'admin.automations.runs.heading': 'Historique des exécutions',
  'admin.automations.runs.filter.allAutomations': 'Toutes les automatisations',
  'admin.automations.runs.filter.automation': 'Filtrer par automatisation',
  'admin.automations.runs.filter.trigger': 'Filtrer par déclencheur',
  'admin.automations.runs.filter.allTriggers': 'Tous les déclencheurs',
  'admin.automations.runs.filter.allStatuses': 'Tous les statuts',
  'admin.automations.runs.filter.status': 'Filtrer par statut',
  'admin.automations.runs.filter.period': 'Filtrer par période',
  'admin.automations.runs.filter.anyTime': 'Toute la période',
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
  'admin.automations.runs.col.stepCount': 'Étapes',
  'admin.automations.runs.col.record': 'Enregistrement',
  'admin.automations.runs.col.attempt': 'Tentative',
  'admin.automations.runs.col.error': 'Erreur',
  'admin.automations.runs.action.record': 'Ouvrir l’enregistrement',
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
  'admin.automations.runs.detail.field.duration': 'Durée',
  'admin.automations.runs.detail.field.attempt': 'Tentative',
  'admin.automations.runs.detail.facts.title': 'Exécution',
  'admin.automations.runs.detail.facts.description':
    'Ce qui l’a lancée, comment elle s’est terminée et combien de temps elle a pris.',
  'admin.automations.runs.detail.failure': 'Échec',
  'admin.automations.runs.detail.failure.next': 'Corrige la cause, puis relance cette exécution.',
  'admin.automations.runs.detail.failure.connections': 'Voir les connexions',
  'admin.automations.runs.detail.failure.env': 'Voir l’environnement',
  'admin.automations.runs.detail.defect.title':
    'Sovrium a arrêté cette exécution sur une erreur interne',
  'admin.automations.runs.detail.defect.description':
    'C’est une panne de Sovrium, pas de la configuration de ton app. Relancer peut échouer de la même façon.',
  'admin.automations.runs.detail.status.defect': 'Échec · erreur interne',
  'admin.automations.runs.detail.failure.stepTitle':
    'Cette exécution a échoué à l’une de ses étapes',
  'admin.automations.runs.detail.failure.stepTitleNamed':
    'Étape $record.failedStep.number en échec · $record.failedStep.label',
  'admin.automations.runs.detail.otherRuns': 'Autres exécutions de',
  'admin.automations.runs.detail.dataInOut': 'Données en entrée et en sortie',
  'admin.automations.runs.detail.showTrigger': 'Voir les données du déclencheur',
  'admin.automations.runs.detail.definedAs': 'Définie dans ta config sous le nom',
  'admin.automations.runs.detail.changeThere': '. Change-la là-bas, puis redémarre l’app.',
  'admin.automations.runs.detail.log': 'Journal',
  'admin.automations.runs.detail.dataIn': 'Données en entrée',
  'admin.automations.runs.detail.dataOut': 'Données en sortie',
  'admin.automations.runs.detail.steps': 'Étapes',
  'admin.automations.runs.detail.trigger': 'Déclencheur',
  'admin.automations.runs.detail.trigger.description':
    'Ce qui a lancé cette exécution, tel que la première étape l’a reçu.',
  'admin.automations.runs.detail.triggerData': 'Données du déclencheur',
  'admin.automations.runs.detail.outcome': 'Résultat',
  'admin.automations.runs.detail.noOutput': 'Cette étape n’a rien renvoyé.',
  'admin.automations.runs.detail.back': 'Retour aux exécutions',
  'admin.automations.runs.detail.retry': 'Relancer',
  'admin.automations.runs.detail.retry.title': 'Confirmer la relance',
  'admin.automations.runs.detail.retry.message':
    'L’automatisation s’exécute de nouveau, comme une nouvelle exécution. Celle-ci reste telle quelle.',
  'admin.automations.runs.detail.retry.toast': 'Relance lancée',
  'admin.automations.runs.detail.retry.error': 'L’exécution n’a pas été relancée.',

  'admin.forms.openForm': 'Ouvrir le formulaire',
  'admin.forms.tabs.region': 'Sous-vues Réponses',
  'admin.forms.trend.region': 'Réponses dans le temps',
  'admin.forms.dropOff.heading': 'Abandon par étape',
  'admin.forms.dropOff.singlePage': 'Sans objet : formulaire d’une seule page',
  'admin.forms.reveal': 'Afficher les réponses',
  'admin.forms.answers': 'Réponses',
  'admin.forms.status.received': 'Reçue',
  'admin.forms.status.processing': 'En cours',
  'admin.forms.status.processed': 'Traitée',
  'admin.forms.status.failed': 'En échec',
  'admin.forms.status.spam': 'Indésirable',
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
    'Ce lien est déclaré dans ton fichier de config. Change-le là-bas et redémarre l’app ; la console ne modifie jamais ta config.',

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
    'rendu avec ses données d’exemple, comme une automatisation l’envoie.',
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
    'Mesuré par ce processus depuis son démarrage ; les compteurs sont remis à zéro quand il redémarre. Les notes lisent le Content-Length de chaque réponse via l’en-tête X-Eco-Index — ce n’est pas un score Lighthouse ou EcoIndex.fr, qui inspectent la page rendue. Les notes ne sont enregistrées que tant que ECO_INDEX_HEADER est activé. Le taux de succès ne compte que les rendus proposés au cache : les requêtes authentifiées et dynamiques le contournent, donc une instance sans trafic anonyme affiche — plutôt qu’un taux.',
  'admin.locked.audit.footprint.storageProvenance':
    'Les trois plus gros consommateurs, mesurés à la demande. Chaque ligne nomme l’instrument derrière son chiffre, parce qu’une taille sans origine déclarée ne se distingue pas d’une taille que personne n’a prise. Une taille vide signifie que la sonde était indisponible — un zéro signifie que la ressource a été mesurée et qu’elle est vide.',
  'admin.locked.audit.footprint.configurationProvenance':
    'Lu depuis l’environnement à chaque requête, donc un changement prend effet au rafraîchissement suivant. La configuration est déclarée, pas mesurée : elle décrit comment cette instance est réglée, pas ce qu’elle a émis.',
} as const
