/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The French twin of `developers.ts`: the API, MCP and schema surfaces.
//
// Exact key parity with `developers.ts`, in its key order. The rules every French
// string here follows (voice, no-break spaces) are in `fr.ts`, which merges
// the four.

export default {
  'admin.api.heading': 'API',
  'admin.api.blurb':
    'Ton app expose une API REST générée depuis sa config. Chaque table devient un ensemble de points d’accès CRUD. Voici l’essentiel pour démarrer, plus la référence interactive complète.',
  'admin.api.access.heading': 'Accès',
  'admin.api.baseUrl.heading': 'URL de base',
  'admin.api.auth.heading': 'Authentification',
  'admin.api.auth.blurb':
    'Session Better Auth (cookie de connexion). Une requête envoyée depuis ce navigateur, connecté en tant qu’administrateur, est authentifiée automatiquement.',
  'admin.api.keys.heading': 'Clés API',
  'admin.api.keys.blurb':
    'Un script n’a pas de session de navigateur. Donne-lui plutôt une clé de longue durée et envoie-la dans l’en-tête x-api-key.',
  'admin.api.keys.link': 'Gérer les clés',
  'admin.api.examples.heading': 'Exemples de requêtes',
  'admin.api.examples.note':
    'Le verbe et le chemin suffisent ; la référence interactive détaille les paramètres, les corps de requête et les réponses de chaque point d’accès.',
  'admin.api.examples.httpList':
    '# Lister « $record.label »\nGET  /api/tables/$record.name/records',
  'admin.api.examples.httpCreate':
    '# Créer un enregistrement dans « $record.exampleTableLabel »\nPOST /api/tables/$record.exampleTable/records',
  'admin.api.examples.curlListComment':
    '# Lister « $record.exampleTableLabel » (la session admin de ce navigateur authentifie l’appel)',
  'admin.api.examples.jsListComment':
    '// Lister « $record.exampleTableLabel » depuis ce navigateur (le cookie de session est inclus)',
  'admin.api.examples.httpListAny':
    'GET  /api/tables/{table}/records      # Lister les enregistrements d’une table',
  'admin.api.examples.httpCreateAny':
    'POST /api/tables/{table}/records      # Créer un enregistrement',
  'admin.api.examples.curlListAnyComment':
    '# Lister les enregistrements d’une table (la session admin de ce navigateur authentifie l’appel)',
  'admin.api.examples.jsListAnyComment':
    '// Lister les enregistrements d’une table depuis ce navigateur (le cookie de session est inclus)',
  'admin.api.createUser.heading': 'Créer un utilisateur',
  'admin.api.createUser.blurb':
    'Crée un compte avec l’API admin de Better Auth, ou avec le serveur MCP. Choisis un mot de passe fort ; la personne le change après sa première connexion.',
  'admin.api.createUser.comment': '# POST /api/auth/admin/create-user — créer un compte',
  'admin.api.reference.heading': 'Référence interactive',
  'admin.api.reference.blurb':
    'Parcours chaque point d’accès, essaie des requêtes et lis les schémas dans la référence interactive (Scalar).',
  'admin.api.reference.link': 'Ouvrir la référence interactive',

  'admin.mcp.heading': 'MCP',
  'admin.mcp.blurb':
    'Connecte ton IA (Claude, Cursor…) à cette instance via MCP. Émets un identifiant, colle la config dans ton client, et ton IA atteint les outils ci-dessous — lecture et écriture de données, actions et automatisations.',
  'admin.mcp.endpoint.heading': 'Point d’accès MCP',
  'admin.mcp.endpoint.blurb':
    'Ton serveur MCP est monté à cette adresse. Colle-la telle quelle dans la config de ton client IA.',
  'admin.mcp.endpoint.filename': 'Point d’accès',
  'admin.mcp.credential.heading': 'Émettre un identifiant',
  'admin.mcp.credential.blurb':
    'Enregistre un client MCP pour obtenir un identifiant. La réponse renvoie un « client_id » et un « client_secret » à coller dans ton client IA. Lance-la connecté en tant qu’admin — sans session, le point d’accès répond 401, et « $SOVRIUM_SESSION » porte ton cookie de connexion.',
  'admin.mcp.credential.comment':
    '# POST /api/auth/oauth2/register — émettre un identifiant MCP (RFC 7591)',
  'admin.mcp.credential.anonymous':
    'Claude Desktop, Cursor et ChatGPT Dev Mode s’enregistrent eux-mêmes avant qu’aucune session de navigateur n’existe. Pour le leur permettre, mets « SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true » — l’enregistrement accepte alors n’importe quel appelant, plafonné à 20 par minute et par IP.',
  'admin.mcp.config.heading': 'Configuration de référence',
  'admin.mcp.config.filename': 'Config du client MCP',
  'admin.mcp.config.blurb':
    'La config MCP à coller dans ton client, avec le point d’accès déjà réglé sur l’adresse de cette instance.',
  'admin.mcp.tools.heading': 'Outils disponibles',
  'admin.mcp.tools.region': 'Outils MCP disponibles',
  'admin.mcp.tools.data': 'Données',
  'admin.mcp.tools.actions': 'Actions',
  'admin.mcp.tools.automations': 'Automatisations',
  'admin.mcp.tools.empty': 'Aucun outil exposé pour l’instant',
  'admin.mcp.tools.emptyHint':
    'Ajoute « aiAccess » à une table, une action ou une automatisation manuelle dans ta config d’app pour l’exposer ici comme outil MCP.',

  // ── Journal des versions (`/changelog`) ─────────────────────────────────
  'admin.changelog.heading': 'Journal des versions',
  'admin.changelog.blurb':
    'Chaque démarrage enregistré par cette instance, du plus récent au plus ancien, et ce qui a changé entre eux.',
  'admin.changelog.ledger.region': 'Journal des démarrages',
  'admin.changelog.ledger.blurb':
    'Une ligne par démarrage dont la version ou la configuration différait du précédent.',
  'admin.changelog.ledger.search': 'Rechercher une version',
  'admin.changelog.ledger.empty': 'Aucun démarrage enregistré pour l’instant.',
  'admin.changelog.ledger.noMatch': 'Aucun démarrage ne correspond à cette recherche.',
  'admin.changelog.current': 'en cours',
  'admin.changelog.current.heading': 'Configuration telle qu’elle a démarré',
  'admin.changelog.current.declarations': 'déclarations',
  'admin.changelog.toCurrent': 'Lire la configuration telle qu’elle a démarré',
  'admin.changelog.back': 'Retour au journal',

  // ── Un démarrage (`/changelog/:hash`) ───────────────────────────────────
  'admin.changelog.one.heading': 'Version',
  'admin.changelog.one.blurb':
    'Un démarrage enregistré : ce qu’il a appliqué à ta base, et en quoi sa configuration différait du démarrage précédent.',
  'admin.changelog.boot.region': 'Fiche du démarrage',
  'admin.changelog.boot.heading': 'Démarrage',
  'admin.changelog.field.version': 'Version',
  'admin.changelog.field.bootedAt': 'Démarré le',
  'admin.changelog.field.bootedBy': 'Lancé par',
  'admin.changelog.field.engine': 'Moteur',
  'admin.changelog.field.previousEngine': 'Moteur précédent',
  'admin.changelog.field.config': 'Config',
  'admin.changelog.field.previousConfig': 'Config précédente',
  'admin.changelog.diff.heading': 'Différences de configuration',
  'admin.changelog.diff.baseline':
    'Le premier démarrage enregistré n’a rien avant lui à comparer : il ne porte donc aucune différence.',
  'admin.changelog.diff.pruned':
    'Le démarrage qui précédait celui-ci a été effacé par la rétention : il ne reste rien à comparer.',
  'admin.changelog.diff.redaction':
    'Les deux côtés de cette comparaison sont des démarrages qui ont eu lieu. Les secrets ont été masqués avant leur enregistrement. Exporte-la pour en lire les lignes.',
  'admin.changelog.ddl.heading': 'Tables modifiées',
  'admin.changelog.ddl.empty':
    'Aucune table modifiée : le moteur n’a rien déduit à appliquer depuis cette configuration.',
  'admin.changelog.migrations.heading': 'Migrations moteur',
  'admin.changelog.migrations.empty': 'Aucune : le moteur n’a pas changé.',

  // ── La configuration telle qu’elle a démarré (`?view=current`) ──────────
  'admin.schema.heading': 'Schéma',
  'admin.schema.declared.heading': 'Configuration déclarée',
  'admin.schema.declared.region': 'Configuration déclarée',
  'admin.schema.declared.empty': 'Cette config ne déclare encore rien.',
  'admin.schema.raw.heading': 'Déclarations par famille',
  'admin.schema.raw.summary': 'Exporte la configuration pour lire ou partager le document entier.',
  'admin.schema.nav.region': 'Configuration',
  'admin.schema.nav.overview': 'Vue d’ensemble',
  'admin.schema.nav.rootKeys': 'Clés racine',
  'admin.schema.overview.body':
    'Ce avec quoi ce serveur a démarré, décodé et expurgé. Choisis une clé racine pour lire une famille, ou exporte la configuration entière ci-dessous.',
  'admin.schema.counts.tables': 'Tables',
  'admin.schema.counts.pages': 'Pages',
  'admin.schema.counts.forms': 'Formulaires',
  'admin.schema.counts.automations': 'Automatisations',
  'admin.schema.counts.agents': 'Agents',
  'admin.schema.counts.buckets': 'Buckets',
  'admin.schema.counts.connections': 'Connexions',

  'admin.locked.audit.schema.readOnlyNotice':
    'Modifie ton fichier de config d’app et redémarre pour changer quoi que ce soit ici. La console lit la configuration qui tourne ; elle ne l’écrit jamais.',
  'admin.locked.audit.schema.redactionNotice':
    'La configuration depuis laquelle cette instance a démarré, exactement telle qu’elle tourne. Les identifiants sont expurgés avant la construction de la page.',
  'admin.locked.audit.mcp.exposureNotice':
    'Tu décides de ce que ton IA peut faire : rien n’est exposé par défaut.',

  'admin.schema.readOnly.heading': 'La configuration vit dans le code',
} as const
