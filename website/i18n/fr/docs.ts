/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const docs: Record<string, string> = {
  'docs.banner.title': 'Sovrium v0.1.0 — Développement actif',
  'docs.banner.body':
    'Ce projet est en cours de développement actif. Les APIs, le format de configuration et les fonctionnalités peuvent changer entre les versions.',
  'docs.sidebar.toggle': 'Menu',
  'docs.toc.heading': 'Sur cette page',
  'docs.sidebar.section.getStarted': 'Pour commencer',
  'docs.sidebar.section.appSchema': 'Schéma applicatif',
  'docs.sidebar.section.references': 'Références',
  'docs.sidebar.jsonSchema': 'JSON Schema',
  'docs.sidebar.llmReference': 'Référence LLM',
  'docs.sidebar.roadmap': 'Feuille de route',
  'docs.sidebar.contributing': 'Contribuer',
  'docs.sidebar.license': 'Licence',
  'docs.sidebar.introduction': 'Introduction',
  'docs.sidebar.introduction.href': '/fr/docs',
  'docs.sidebar.installation': 'Installation',
  'docs.sidebar.installation.href': '/fr/docs/installation',
  'docs.sidebar.quickStart': 'Démarrage rapide',
  'docs.sidebar.quickStart.href': '/fr/docs/quick-start',
  'docs.sidebar.overview': 'Vue d’ensemble',
  'docs.sidebar.overview.href': '/fr/docs/overview',
  'docs.sidebar.tables': 'Tables & Champs',
  'docs.sidebar.tables.href': '/fr/docs/tables',
  'docs.sidebar.theme': 'Thème',
  'docs.sidebar.theme.href': '/fr/docs/theme',
  'docs.sidebar.pages': 'Pages & Composants',
  'docs.sidebar.pages.href': '/fr/docs/pages',
  'docs.sidebar.auth': 'Authentification',
  'docs.sidebar.auth.href': '/fr/docs/auth',
  'docs.sidebar.languages': 'Langues',
  'docs.sidebar.languages.href': '/fr/docs/languages',
  'docs.sidebar.analytics': 'Analytiques',
  'docs.sidebar.analytics.href': '/fr/docs/analytics',
  'docs.sidebar.apiReference': 'Référence API',
  'docs.sidebar.apiReference.href': '/fr/docs/api-reference',
  'docs.introduction.meta.title': 'Introduction - Docs Sovrium',
  'docs.introduction.meta.description':
    'Découvrez ce qu’est Sovrium, pourquoi il existe, et comment il vous permet de créer des applications complètes à partir d’un seul fichier de configuration.',
  'docs.installation.meta.title': 'Installation - Docs Sovrium',
  'docs.installation.meta.description':
    'Installez Sovrium via Bun et créez votre premier fichier de configuration en YAML ou JSON.',
  'docs.quickStart.meta.title': 'Démarrage rapide - Docs Sovrium',
  'docs.quickStart.meta.description':
    'Construisez votre première application Sovrium en quelques minutes avec YAML ou TypeScript. Installez, configurez et démarrez le serveur.',
  'docs.overview.meta.title': 'Vue d’ensemble du schéma - Docs Sovrium',
  'docs.overview.meta.description':
    'Référence complète des 10 propriétés racine du schéma applicatif Sovrium. Définissez modèles de données, authentification, pages, thèmes et analytiques.',
  'docs.tables.meta.title': 'Tables & Champs - Docs Sovrium',
  'docs.tables.meta.description':
    'Définissez vos modèles de données avec 41 types de champs, relations et permissions RBAC.',
  'docs.theme.meta.title': 'Thème - Docs Sovrium',
  'docs.theme.meta.description':
    'Personnalisez couleurs, polices, espacement, ombres, animations et points de rupture.',
  'docs.pages.meta.title': 'Pages & Composants - Docs Sovrium',
  'docs.pages.meta.description':
    'Construisez des pages rendues côté serveur avec 62 types de composants, métadonnées SEO et i18n.',
  'docs.auth.meta.title': 'Authentification - Docs Sovrium',
  'docs.auth.meta.description':
    'Configurez stratégies d’authentification, rôles, 2FA et modèles d’e-mail.',
  'docs.languages.meta.title': 'Langues - Docs Sovrium',
  'docs.languages.meta.description':
    'Ajoutez le support multi-langue avec la syntaxe de traduction $t: et la configuration des locales.',
  'docs.analytics.meta.title': 'Analytiques - Docs Sovrium',
  'docs.analytics.meta.description':
    'Activez des analytiques respectueuses de la vie privée, sans cookies, avec rétention et sessions configurables.',
  'docs.apiReference.meta.title': 'Référence API - Docs Sovrium',
  'docs.apiReference.meta.description':
    'Référence complète de l’API REST Sovrium. Parcourez 55+ endpoints pour les tables, enregistrements, vues, activité, analytiques et authentification.',
  'docs.apiReference.title': 'Référence API',
  'docs.apiReference.description':
    'Sovrium expose une API REST complète pour gérer les tables, enregistrements, vues, journaux d’activité, analytiques et authentification. Tous les endpoints acceptent et retournent du JSON.',
  'docs.apiReference.earlyPreview.title': 'Accès anticipé',
  'docs.apiReference.earlyPreview.body':
    'L’API est en cours d’évolution. Les endpoints peuvent changer avant la v1.0.',
  'docs.apiReference.cta.title': 'Explorateur interactif d’API',
  'docs.apiReference.cta.description':
    'Testez les endpoints directement dans votre navigateur avec l’explorateur interactif Scalar.',
  'docs.apiReference.cta.button': 'Ouvrir l’explorateur interactif',
  'docs.apiReference.baseUrl.title': 'URL de base',
  'docs.apiReference.baseUrl.description':
    'Tous les endpoints sont relatifs à l’URL de base de votre instance Sovrium.',
  'docs.apiReference.health.title': 'Santé',
  'docs.apiReference.health.description': 'Endpoint de vérification de l’état du serveur.',
  'docs.apiReference.health.get': 'Vérifier l’état du serveur',
  'docs.apiReference.tables.title': 'Tables',
  'docs.apiReference.tables.description':
    'Consultez les définitions de tables, y compris les schémas de champs et les règles de permissions.',
  'docs.apiReference.tables.list': 'Lister toutes les tables',
  'docs.apiReference.tables.get': 'Obtenir une table par ID',
  'docs.apiReference.tables.permissions': 'Obtenir les permissions d’une table',
  'docs.apiReference.records.title': 'Enregistrements',
  'docs.apiReference.records.description':
    'CRUD complet, opérations par lot, cycle de vie de suppression douce, historique des révisions et commentaires.',
  'docs.apiReference.records.crud.title': 'CRUD',
  'docs.apiReference.records.list': 'Lister les enregistrements',
  'docs.apiReference.records.create': 'Créer un enregistrement',
  'docs.apiReference.records.get': 'Obtenir un enregistrement par ID',
  'docs.apiReference.records.update': 'Modifier un enregistrement',
  'docs.apiReference.records.delete': 'Supprimer un enregistrement (soft)',
  'docs.apiReference.records.batch.title': 'Opérations par lot',
  'docs.apiReference.records.batchCreate': 'Créer plusieurs enregistrements',
  'docs.apiReference.records.batchUpdate': 'Modifier plusieurs enregistrements',
  'docs.apiReference.records.batchDelete': 'Supprimer plusieurs enregistrements (soft)',
  'docs.apiReference.records.upsert': 'Créer ou modifier un enregistrement',
  'docs.apiReference.records.lifecycle.title': 'Corbeille & Historique',
  'docs.apiReference.records.trash': 'Lister les enregistrements supprimés',
  'docs.apiReference.records.restore': 'Restaurer un enregistrement',
  'docs.apiReference.records.batchRestore': 'Restaurer plusieurs enregistrements',
  'docs.apiReference.records.history': 'Obtenir l’historique des révisions',
  'docs.apiReference.records.comments.title': 'Commentaires',
  'docs.apiReference.records.commentsList': 'Lister les commentaires d’un enregistrement',
  'docs.apiReference.records.commentsCreate': 'Ajouter un commentaire',
  'docs.apiReference.records.commentsGet': 'Obtenir un commentaire par ID',
  'docs.apiReference.records.commentsUpdate': 'Modifier un commentaire',
  'docs.apiReference.records.commentsDelete': 'Supprimer un commentaire',
  'docs.apiReference.views.title': 'Vues',
  'docs.apiReference.views.description':
    'Vues préconfigurées qui filtrent, trient et regroupent les enregistrements d’une table.',
  'docs.apiReference.views.list': 'Lister les vues d’une table',
  'docs.apiReference.views.get': 'Obtenir une vue par ID',
  'docs.apiReference.views.records': 'Obtenir les enregistrements via une vue',
  'docs.apiReference.activity.title': 'Activité',
  'docs.apiReference.activity.description':
    'Journal d’audit des modifications sur toutes les tables.',
  'docs.apiReference.activity.list': 'Lister les entrées d’activité',
  'docs.apiReference.activity.get': 'Obtenir le détail d’une activité',
  'docs.apiReference.analyticsEndpoints.title': 'Analytiques',
  'docs.apiReference.analyticsEndpoints.description':
    'Analytiques d’utilisation respectueuses de la vie privée, sans cookies.',
  'docs.apiReference.analyticsEndpoints.collect': 'Enregistrer un événement de page vue',
  'docs.apiReference.analyticsEndpoints.overview': 'Obtenir l’aperçu analytique',
  'docs.apiReference.analyticsEndpoints.pages': 'Obtenir les pages les plus vues',
  'docs.apiReference.analyticsEndpoints.referrers': 'Obtenir les principaux référents',
  'docs.apiReference.analyticsEndpoints.devices': 'Obtenir la répartition par appareil',
  'docs.apiReference.analyticsEndpoints.campaigns': 'Obtenir les statistiques de campagnes',
  'docs.apiReference.auth.title': 'Authentification',
  'docs.apiReference.auth.description':
    'Gérée par Better Auth avec 28+ endpoints pour connexion, inscription, sessions, OAuth, 2FA et gestion des utilisateurs.',
  'docs.apiReference.auth.summary':
    'L’authentification est gérée par Better Auth et inclut la connexion email/mot de passe, les fournisseurs OAuth, la gestion des sessions, la réinitialisation de mot de passe, la vérification d’email, l’authentification à deux facteurs et les endpoints d’administration. Consultez la documentation de configuration ou explorez tous les endpoints dans l’explorateur interactif.',
  'docs.apiReference.auth.configLink': 'Configuration Auth →',
  'docs.apiReference.auth.scalarLink': 'Voir tous les endpoints auth dans l’explorateur ↗',
  'docs.apiReference.features.title': 'Fonctionnalités transversales',
  'docs.apiReference.features.description':
    'Capacités qui s’appliquent à tous les endpoints de l’API.',
  'docs.apiReference.openapi.title': 'Schéma OpenAPI',
  'docs.apiReference.openapi.description':
    'Téléchargez la spécification OpenAPI 3.1 pour l’utiliser avec n’importe quel client API ou générateur de code.',
  'docs.apiReference.openapi.download': 'Télécharger openapi.json',
  'docs.jsonSchema.meta.title': 'JSON Schema - Docs Sovrium',
  'docs.jsonSchema.meta.description':
    'Explorez le JSON Schema de configuration Sovrium. Naviguez interactivement, intégrez à votre éditeur et validez vos fichiers de configuration.',
  'docs.jsonSchema.title': 'JSON Schema',
  'docs.jsonSchema.description':
    'Le schéma applicatif Sovrium définit la structure complète de votre configuration. Publié en JSON Schema standard, il permet l’auto-complétion dans l’éditeur, la validation en temps réel et la vérification programmatique.',
  'docs.jsonSchema.cta.title': 'Explorateur interactif de schéma',
  'docs.jsonSchema.cta.description':
    'Parcourez le schéma complet visuellement avec le JSON Schema Viewer. Développez les propriétés, consultez les types et explorez les structures imbriquées.',
  'docs.jsonSchema.cta.button': 'Ouvrir l’explorateur',
  'docs.jsonSchema.explorer.title': 'Explorateur de schéma',
  'docs.jsonSchema.explorer.description':
    'Parcourez le schéma applicatif Sovrium de manière interactive. Développez les propriétés pour explorer les types, contraintes et structures imbriquées.',
  'docs.jsonSchema.explorer.openFull': 'Ouvrir dans un nouvel onglet',
  'docs.jsonSchema.explorer.rootTitle': 'Propriétés racine',
  'docs.jsonSchema.explorer.expandHint': 'Cliquez pour explorer le schéma complet →',
  'docs.jsonSchema.urls.title': 'URL du schéma',
  'docs.jsonSchema.urls.description':
    'Référencez le JSON Schema Sovrium par URL dans votre éditeur, pipeline CI ou scripts de validation.',
  'docs.jsonSchema.urls.versioned.title': 'Versionné (recommandé)',
  'docs.jsonSchema.urls.versioned.description':
    'Épinglez une version spécifique pour la stabilité en production. L’URL du schéma inclut la version exacte du package.',
  'docs.jsonSchema.urls.latest.title': 'Dernière version',
  'docs.jsonSchema.urls.latest.description':
    'Pointe toujours vers la version la plus récente. Pratique pour le développement, mais peut introduire des changements incompatibles.',
  'docs.jsonSchema.urls.download.versioned': 'Télécharger le schéma versionné',
  'docs.jsonSchema.urls.download.latest': 'Télécharger le schéma latest',
  'docs.jsonSchema.editor.title': 'Intégration éditeur',
  'docs.jsonSchema.editor.description':
    'Ajoutez le JSON Schema à votre éditeur pour l’auto-complétion, la documentation en ligne et la validation en temps réel de votre config Sovrium.',
  'docs.jsonSchema.editor.vscode.description':
    'VS Code supporte nativement le JSON Schema pour les fichiers JSON et YAML (avec l’extension YAML).',
  'docs.jsonSchema.editor.vscode.inline':
    'Option 1 : Ajouter $schema directement dans votre fichier de config',
  'docs.jsonSchema.editor.vscode.settings': 'Option 2 : Configurer dans settings.json de VS Code',
  'docs.jsonSchema.editor.jetbrains.description':
    'IntelliJ IDEA, WebStorm et les autres IDE JetBrains supportent nativement le mappage JSON Schema.',
  'docs.jsonSchema.editor.jetbrains.steps':
    'Allez dans Settings > Languages & Frameworks > Schemas and DTDs > JSON Schema Mappings. Cliquez + pour ajouter un mappage, collez l’URL du schéma ci-dessous et définissez le pattern de fichier correspondant à votre config (ex. app.yaml ou app.json).',
  'docs.jsonSchema.versioning.title': 'Versionnage',
  'docs.jsonSchema.versioning.description':
    'Le JSON Schema suit le versionnage sémantique aligné sur le package Sovrium.',
  'docs.jsonSchema.versioning.semver':
    'Chaque version de Sovrium publie un JSON Schema correspondant. Les changements incompatibles ne surviennent que lors des montées de version majeure.',
  'docs.jsonSchema.versioning.latest':
    'L’URL /schemas/latest/ est un alias qui redirige toujours vers la version la plus récente. Utilisez-le pour le développement.',
  'docs.jsonSchema.versioning.pin':
    'En production, épinglez une version spécifique pour éviter les changements de validation inattendus lors des mises à jour.',
  'docs.jsonSchema.validation.title': 'Validation programmatique',
  'docs.jsonSchema.validation.description':
    'Validez vos fichiers de configuration Sovrium contre le JSON Schema dans vos pipelines CI, hooks pre-commit ou scripts personnalisés.',
  'docs.jsonSchema.validation.intro':
    'Utilisez n’importe quelle bibliothèque de validation JSON Schema. L’exemple ci-dessous utilise Ajv, l’un des validateurs les plus populaires pour JavaScript/TypeScript.',
  'docs.jsonSchema.validation.tip.title': 'Intégration CI',
  'docs.jsonSchema.validation.tip.body':
    'Ajoutez la validation de schéma à votre pipeline CI pour détecter les erreurs de configuration avant le déploiement. L’URL du schéma peut être récupérée au moment du build ou intégrée à votre projet.',
  'docs.sidebar.jsonSchema.href': '/fr/docs/json-schema',
  'docs.introduction.header.title': 'Introduction',
  'docs.introduction.header.description':
    'Sovrium est une plateforme source-available, auto-hébergée, qui transforme un seul fichier de configuration en une application web complète.',
  'docs.introduction.what.title': 'Qu’est-ce que Sovrium ?',
  'docs.introduction.what.description':
    'Sovrium est une plateforme applicative pilotée par la configuration. Vous décrivez votre application dans un fichier YAML ou JSON — modèles de données, authentification, pages, thèmes, analytiques — et Sovrium la transforme en application web full-stack fonctionnelle.',
  'docs.introduction.what.detail':
    'Pas de code répétitif, pas de configuration de framework, pas de pipeline de build. Un seul fichier qui déclare ce que votre application doit être.',
  'docs.introduction.why.title': 'Pourquoi Sovrium ?',
  'docs.introduction.why.description':
    'La plupart des applications métier partagent les mêmes briques : tables de données, authentification, pages rendues côté serveur et système de design. Sovrium fournit tout cela clé en main, configuré via un seul schéma.',
  'docs.introduction.why.point1.title': 'Pas de dépendance fournisseur',
  'docs.introduction.why.point1.description':
    'Auto-hébergé sur votre infrastructure. Vos données restent les vôtres.',
  'docs.introduction.why.point2.title': 'Configuration plutôt que code',
  'docs.introduction.why.point2.description':
    'Déclarez ce dont vous avez besoin au lieu d’écrire du code répétitif. 41 types de champs, 62 types de composants, authentification intégrée.',
  'docs.introduction.why.point3.title': 'Complexité progressive',
  'docs.introduction.why.point3.description':
    'Commencez avec juste un nom. Ajoutez tables, thème, pages, auth et analytiques selon vos besoins.',
  'docs.introduction.why.point4.title': 'Source-available',
  'docs.introduction.why.point4.description':
    'Business Source License 1.1. Gratuit pour usage interne. Devient Apache 2.0 en 2029.',
  'docs.introduction.how.title': 'Comment ça marche',
  'docs.introduction.how.description':
    'Écrivez un fichier de configuration, lancez une commande, et obtenez une application fonctionnelle :',
  'docs.introduction.how.step1': 'Définissez votre schéma en YAML ou JSON',
  'docs.introduction.how.step2': 'Lancez sovrium start app.yaml',
  'docs.introduction.how.step3':
    'Obtenez une application full-stack avec tables, auth, pages et plus',
  'docs.introduction.next.title': 'Étapes suivantes',
  'docs.introduction.next.description':
    'Prêt à essayer ? Installez Sovrium et construisez votre première application en moins de 5 minutes.',
  'docs.introduction.help.title': 'Obtenir de l’aide',
  'docs.introduction.help.description':
    'Vous avez trouvé un bug, une question ou une demande de fonctionnalité ?',
  'docs.introduction.help.body':
    'Sovrium est open source. Si vous rencontrez un problème ou avez des idées d’amélioration, le meilleur moyen de nous contacter est via GitHub Issues.',
  'docs.introduction.help.link': 'Ouvrir une issue sur GitHub →',
  'docs.installation.header.title': 'Installation',
  'docs.installation.header.description':
    'Installez Sovrium globalement ou comme dépendance de projet avec Bun.',
  'docs.installation.prerequisites.title': 'Prérequis',
  'docs.installation.prerequisites.descriptionBefore': 'Sovrium nécessite ',
  'docs.installation.prerequisites.descriptionLink': 'Bun 1.3+',
  'docs.installation.prerequisites.descriptionAfter':
    '. Une base de données PostgreSQL 15+ est optionnelle, nécessaire uniquement pour la persistance des données (tables, auth).',
  'docs.installation.global.title': 'Installation globale',
  'docs.installation.global.description':
    'Installez Sovrium globalement pour utiliser la commande sovrium partout :',
  'docs.installation.project.title': 'Dépendance de projet',
  'docs.installation.project.description':
    'Ou ajoutez Sovrium comme dépendance dans un projet existant :',
  'docs.installation.verify.title': 'Vérifier l’installation',
  'docs.installation.verify.description':
    'Lancez la commande d’aide pour vérifier que Sovrium est installé correctement :',
  'docs.installation.config.title': 'Créer un fichier de config',
  'docs.installation.config.description':
    'Sovrium lit un fichier de configuration YAML ou JSON. Créez un app.yaml avec la config valide la plus simple :',
  'docs.installation.config.tip.title': 'YAML ou JSON',
  'docs.installation.config.tip.body':
    'Sovrium supporte les fichiers .yaml/.yml et .json. Le YAML est recommandé pour sa lisibilité.',
  'docs.installation.database.title': 'Configuration de la base de données',
  'docs.installation.database.description':
    'Si votre application utilise des tables ou l’auth, définissez la variable d’environnement DATABASE_URL :',
  'docs.installation.database.tip.title': 'Pas de base de données pour les sites statiques',
  'docs.installation.database.tip.body':
    'Si vous n’utilisez que pages et theme (pas de tables ni d’auth), Sovrium fonctionne sans base de données. Lancez sovrium build app.yaml pour générer un site statique.',
  'docs.quickStart.header.title': 'Démarrage rapide',
  'docs.quickStart.header.description':
    'Construisez votre première application Sovrium en quelques minutes. De zéro à une application fonctionnelle. Choisissez l’approche qui vous convient.',
  'docs.quickStart.chooseApproach': 'Choisissez votre approche',
  'docs.quickStart.chooseApproach.description':
    'Sovrium supporte deux formats de configuration. Le YAML est idéal pour la simplicité ; le TypeScript offre un typage complet et l’autocomplétion.',
  'docs.quickStart.yaml.title': 'Option A — YAML + CLI',
  'docs.quickStart.yaml.description':
    'Le chemin le plus simple. Installez le CLI Sovrium, écrivez un fichier YAML et démarrez le serveur :',
  'docs.quickStart.yaml.step1.title': 'Installer le CLI',
  'docs.quickStart.yaml.step1.description':
    'Installez Sovrium globalement avec Bun pour obtenir la commande sovrium.',
  'docs.quickStart.yaml.step2.title': 'Créer un fichier de config',
  'docs.quickStart.yaml.step2.description':
    'Créez un app.yaml avec la configuration valide la plus simple — juste un nom.',
  'docs.quickStart.yaml.step3.title': 'Ajouter des tables de données',
  'docs.quickStart.yaml.step3.description':
    'Définissez vos modèles de données avec des champs typés, des options et de la validation.',
  'docs.quickStart.yaml.step4.title': 'Démarrer le serveur',
  'docs.quickStart.yaml.step4.description':
    'Lancez le serveur de développement et visitez http://localhost:3000 pour voir votre application.',
  'docs.quickStart.ts.title': 'Option B — TypeScript + Bun',
  'docs.quickStart.ts.description':
    'Le chemin pour les utilisateurs avancés. Créez un projet Bun, ajoutez Sovrium comme dépendance et écrivez du code typé :',
  'docs.quickStart.ts.step1.title': 'Initialiser un projet',
  'docs.quickStart.ts.step1.description':
    'Créez un nouveau projet Bun avec bun init et entrez dans le répertoire.',
  'docs.quickStart.ts.step2.title': 'Ajouter Sovrium',
  'docs.quickStart.ts.step2.description': 'Installez Sovrium comme dépendance du projet.',
  'docs.quickStart.ts.step3.title': 'Écrire votre app',
  'docs.quickStart.ts.step3.description':
    'Ouvrez index.ts et importez la fonction start avec une configuration minimale.',
  'docs.quickStart.ts.step4.title': 'Ajouter des tables de données',
  'docs.quickStart.ts.step4.description':
    'Enrichissez la configuration avec des champs typés, des options et de la validation — avec autocomplétion complète.',
  'docs.quickStart.ts.step5.title': 'Lancer votre app',
  'docs.quickStart.ts.step5.description':
    'Exécutez index.ts avec Bun. Visitez http://localhost:3000 pour voir votre application.',
  'docs.quickStart.ts.tip.title': 'Pourquoi TypeScript ?',
  'docs.quickStart.ts.tip.body':
    'TypeScript offre l’autocomplétion pour chaque propriété, la validation à la compilation des types de champs, et toute la puissance de Bun comme runtime. Idéal pour les développeurs qui préfèrent le code aux fichiers de configuration.',
  'docs.quickStart.tip.title': 'Ajoutez au fur et à mesure',
  'docs.quickStart.tip.body':
    'Commencez petit avec juste des tables. Puis ajoutez progressivement theme, auth, pages et analytics selon vos besoins.',
  'docs.quickStart.whatsNext.title': 'Et ensuite ?',
  'docs.quickStart.whatsNext.description':
    'Maintenant que votre application tourne, explorez la référence du schéma pour ajouter plus de fonctionnalités :',
  'docs.quickStart.whatsNext.overview':
    'Vue d’ensemble du schéma — Les 10 propriétés racine expliquées',
  'docs.quickStart.whatsNext.tables': 'Tables & Champs — 41 types de champs, permissions, index',
  'docs.quickStart.whatsNext.theme': 'Thème — Couleurs, polices, espacement et jetons de design',
  'docs.quickStart.whatsNext.pages':
    'Pages — 62 types de composants pour des pages rendues côté serveur',
  'docs.overview.header.title': 'Vue d’ensemble du schéma',
  'docs.overview.header.description':
    'Référence complète du schéma applicatif Sovrium. Un objet de configuration déclaratif avec 10 propriétés racine.',
  'docs.overview.title': 'Structure du schéma',
  'docs.overview.description':
    'Une application Sovrium est un objet de configuration déclaratif avec 10 propriétés racine. Seul name est requis — tout le reste est optionnel, permettant une complexité progressive, d’un simple identifiant d’application à une application full-stack.',
  'docs.overview.footnote':
    'Les fichiers de configuration peuvent être écrits en YAML ou JSON. Exécutez sovrium start app.yaml pour lancer un serveur de développement, ou sovrium build app.yaml pour générer un site statique.',
  'docs.overview.tip.title': 'Complexité progressive',
  'docs.overview.tip.body':
    'Seul name est requis. Ajoutez tables, theme, pages, auth et d’autres sections au fur et à mesure.',
  'docs.rootProps.title': 'Propriétés racine',
  'docs.rootProps.description':
    'Le schéma applicatif a 10 propriétés racine. Seul name est requis.',
  'docs.rootProps.name.description':
    'Identifiant d’application suivant les conventions de nommage npm. Minuscules, max 214 caractères, supporte le format à portée (@scope/name).',
  'docs.rootProps.version.description':
    'Chaîne de versionnement sémantique 2.0.0 (ex. : 1.0.0, 2.0.0-beta.1). Supporte les pré-versions et les métadonnées de build.',
  'docs.rootProps.description.description':
    'Description d’application sur une seule ligne. Pas de retour à la ligne autorisé. Unicode et emojis supportés.',
  'docs.rootProps.tables.description':
    'Modèles de données avec 41 types de champs, relations, index, permissions et vues.',
  'docs.rootProps.theme.description':
    'Jetons de design : couleurs, polices, espacement, ombres, animations, points de rupture et rayons de bordure.',
  'docs.rootProps.pages.description':
    'Pages rendues côté serveur avec 62 types de composants, métadonnées SEO et support i18n.',
  'docs.rootProps.auth.description':
    'Stratégies d’authentification (email/mot de passe, lien magique, OAuth), rôles et authentification à deux facteurs.',
  'docs.rootProps.languages.description':
    'Support multilingue avec syntaxe de traduction $t:, détection du navigateur et persistance de la langue.',
  'docs.rootProps.components.description':
    'Templates UI réutilisables avec référencement $ref et substitution de $variable.',
  'docs.rootProps.analytics.description':
    'Analytiques respectueux de la vie privée, sans cookies, en première partie. Activez avec true par défaut ou configurez avec des options.',
  'docs.overview.details.title': 'Détails des propriétés',
  'docs.overview.details.description':
    'Règles et contraintes détaillées pour les trois propriétés racine scalaires : name, version et description.',
  'docs.overview.details.name.description':
    'Le nom de l’application suit les conventions de nommage npm. Il doit être en minuscules, URL-safe et unique dans votre déploiement.',
  'docs.overview.details.name.pattern':
    'Regex : ^(?:@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$. Lettres minuscules, chiffres, tirets, points.',
  'docs.overview.details.name.maxLength':
    '214 caractères maximum (incluant le préfixe @scope/ si à portée).',
  'docs.overview.details.name.scoped':
    'Supporte les packages à portée npm : @scope/name (ex. : @acme/dashboard).',
  'docs.overview.details.version.description':
    'Suit le Versionnement Sémantique 2.0.0 (semver.org). Format : MAJEUR.MINEUR.CORRECTIF avec pré-version et métadonnées de build optionnelles.',
  'docs.overview.details.description.body':
    'Un texte sur une seule ligne décrivant l’application. Affiché dans l’interface d’administration et les métadonnées.',
  'docs.overview.details.description.format':
    'Une seule ligne. Pas de retour à la ligne (\\n) autorisé.',
  'docs.overview.details.description.maxLength': '2000 caractères maximum.',
  'docs.overview.details.description.unicode':
    'Support complet d’Unicode incluant emojis et caractères spéciaux.',
  'docs.overview.formats.title': 'Formats de configuration',
  'docs.overview.formats.description':
    'Sovrium accepte les fichiers de configuration YAML et JSON. Le YAML est recommandé pour la lisibilité ; le JSON convient à la génération programmatique.',
  'docs.overview.formats.tip.title': 'YAML vs JSON',
  'docs.overview.formats.tip.body':
    'Le YAML supporte les commentaires, est plus lisible et nécessite moins de syntaxe. Utilisez le JSON pour générer les configs programmatiquement ou quand vos outils le préfèrent.',
  'docs.tables.title': 'Tables & Champs',
  'docs.tables.description':
    'Les tables définissent vos modèles de données. Chaque table a un id, un name, des fields, et des permissions, index et vues optionnels.',
  'docs.tables.structure.title': 'Structure d’une table',
  'docs.tables.structure.description':
    'Chaque table a un id, un name, un tableau de fields, et des permissions et index optionnels.',
  'docs.tables.tableProps.title': 'Propriétés de table',
  'docs.tables.tableProps.description':
    'Chaque table dans le tableau tables accepte les propriétés suivantes.',
  'docs.tables.tableProps.id': 'Identifiant entier unique de la table.',
  'docs.tables.tableProps.name':
    'Nom de la table. Lettres minuscules, chiffres et underscores (^[a-z][a-z0-9_]*). Max 63 caractères.',
  'docs.tables.tableProps.fields':
    'Tableau de définitions de champs. Au moins un champ est requis.',
  'docs.tables.tableProps.primaryKey':
    'Colonne(s) utilisée(s) comme clé primaire. Par défaut, une colonne id auto-générée.',
  'docs.tables.tableProps.indexes':
    'Tableau de définitions d’index pour les performances de requêtes et l’unicité.',
  'docs.tables.tableProps.uniqueConstraints': 'Tableau de contraintes d’unicité multi-colonnes.',
  'docs.tables.tableProps.foreignKeys':
    'Définitions explicites de clés étrangères pour l’intégrité référentielle inter-tables.',
  'docs.tables.tableProps.constraints':
    'Tableau de contraintes de vérification avec expressions SQL pour la validation des données.',
  'docs.tables.tableProps.views':
    'Vues enregistrées avec filtres, tri et champs visibles préconfigurés.',
  'docs.tables.tableProps.permissions':
    'Objet de permissions RBAC contrôlant les opérations create, read, update, delete et comment.',
  'docs.tables.tableProps.allowDestructive':
    'Booléen. Lorsque true, autorise les migrations de schéma destructrices (suppression de colonnes, changements de type). Par défaut : false.',
  'docs.tables.baseFields.title': 'Propriétés de base des champs',
  'docs.tables.baseFields.description':
    'Chaque champ a ces propriétés de base : id (entier unique), name (identifiant), type (un des 41 types), et optionnellement required, unique, indexed, description et defaultValue.',
  'docs.tables.baseFields.id': 'Identifiant entier unique du champ dans la table.',
  'docs.tables.baseFields.name':
    'Nom du champ utilisé comme identifiant de colonne. Minuscules, chiffres, underscores (^[a-z][a-z0-9_]*).',
  'docs.tables.baseFields.type':
    'Un des 41 types de champs disponibles (ex. : single-line-text, integer, checkbox).',
  'docs.tables.baseFields.required':
    'Booléen. Lorsque true, le champ doit avoir une valeur pour chaque enregistrement.',
  'docs.tables.baseFields.unique':
    'Booléen. Lorsque true, deux enregistrements ne peuvent pas avoir la même valeur.',
  'docs.tables.baseFields.indexed':
    'Booléen. Lorsque true, crée un index de base de données sur ce champ pour des requêtes plus rapides.',
  'docs.tables.baseFields.descriptionProp':
    'Description lisible optionnelle affichée comme infobulle dans l’interface.',
  'docs.tables.baseFields.defaultValue':
    'Valeur par défaut attribuée lorsqu’un enregistrement est créé sans spécifier ce champ.',
  'docs.tables.fieldTypes.title': '41 types de champs',
  'docs.tables.fieldTypes.description': 'Les types de champs sont organisés en 9 catégories :',
  'docs.tables.fieldTypes.text': 'Champs texte',
  'docs.tables.fieldTypes.text.description':
    'Champs pour le contenu textuel — des étiquettes courtes au texte riche formaté et aux chaînes structurées.',
  'docs.tables.fieldTypes.text.maxLength':
    'Nombre maximum de caractères pour les champs rich-text. Validé à la saisie.',
  'docs.tables.fieldTypes.text.fullTextSearch':
    'Booléen. Active l’indexation de recherche plein texte pour les champs rich-text et long-text.',
  'docs.tables.fieldTypes.text.barcodeFormat':
    'Format d’encodage du code-barres : CODE128, EAN13, QR, UPC, etc.',
  'docs.tables.fieldTypes.numeric': 'Champs numériques',
  'docs.tables.fieldTypes.numeric.description':
    'Champs pour les nombres, devises, pourcentages, notations et indicateurs de progression.',
  'docs.tables.fieldTypes.numeric.minMax':
    'Valeurs minimale et maximale autorisées. S’applique aux champs integer, decimal, currency et percentage.',
  'docs.tables.fieldTypes.numeric.precision':
    'Nombre de décimales pour les champs decimal et currency (0–20).',
  'docs.tables.fieldTypes.numeric.currency':
    'Code devise ISO 4217 (ex. : USD, EUR, GBP). Requis pour les champs currency.',
  'docs.tables.fieldTypes.numeric.symbolPosition':
    'Position du symbole monétaire : "before" ($100) ou "after" (100€). Par défaut : before.',
  'docs.tables.fieldTypes.numeric.thousandsSep':
    'Booléen. Active le séparateur de milliers (1 000 vs 1000). Par défaut : true.',
  'docs.tables.fieldTypes.numeric.negativeFormat':
    'Format d’affichage des négatifs : "minus" (-100), "parentheses" ((100)) ou "red" (∞100 en rouge).',
  'docs.tables.fieldTypes.numeric.ratingMax': 'Valeur maximale de notation (1–10). Par défaut : 5.',
  'docs.tables.fieldTypes.numeric.ratingStyle':
    'Style visuel de notation : "stars", "hearts", "thumbs" ou "numeric".',
  'docs.tables.fieldTypes.numeric.progressColor':
    'Couleur de la barre de progression. Accepte toute valeur CSS de couleur.',
  'docs.tables.fieldTypes.selection': 'Champs de sélection',
  'docs.tables.fieldTypes.selection.description':
    'Champs pour choisir parmi des options prédéfinies — sélection simple ou multiple avec étiquettes colorées.',
  'docs.tables.fieldTypes.selection.options': 'Tableau d’objets définissant les choix disponibles.',
  'docs.tables.fieldTypes.selection.optionLabel': 'Texte affiché pour l’option. Requis.',
  'docs.tables.fieldTypes.selection.optionColor':
    'Couleur du badge pour l’option : gray, red, orange, yellow, green, blue, purple, pink.',
  'docs.tables.fieldTypes.selection.maxSelections':
    'Nombre maximum de choix pour les champs multi-select. Pas de limite par défaut.',
  'docs.tables.fieldTypes.dateTime': 'Champs date & heure',
  'docs.tables.fieldTypes.dateTime.description':
    'Champs pour les dates, heures, horodatages et valeurs de durée.',
  'docs.tables.fieldTypes.dateTime.dateFormat':
    'Format d’affichage des dates : "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", etc.',
  'docs.tables.fieldTypes.dateTime.timeFormat': 'Format d’affichage de l’heure : "12h" ou "24h".',
  'docs.tables.fieldTypes.dateTime.includeTime':
    'Booléen. Lorsque true, les champs date capturent aussi l’heure.',
  'docs.tables.fieldTypes.dateTime.timezone':
    'Identifiant de fuseau horaire IANA (ex. : "Europe/Paris"). Par défaut UTC.',
  'docs.tables.fieldTypes.dateTime.durationFormat':
    'Format d’affichage pour les champs duration : "hours:minutes", "minutes", "seconds", etc.',
  'docs.tables.fieldTypes.user': 'Champs utilisateur & audit',
  'docs.tables.fieldTypes.user.description':
    'Champs auto-remplis traçant qui a créé/modifié/supprimé un enregistrement et quand. Nécessite que auth soit configuré.',
  'docs.tables.fieldTypes.media': 'Champs pièces jointes',
  'docs.tables.fieldTypes.media.allowedFileTypes':
    'Tableau de types MIME autorisés (ex. : ["image/png", "application/pdf"]). Vide = tous les types.',
  'docs.tables.fieldTypes.media.maxFileSize':
    'Taille maximale de fichier en octets. Exemple : 10485760 pour 10 Mo.',
  'docs.tables.fieldTypes.media.maxFiles':
    'Nombre maximum de fichiers pour les champs multiple-attachments.',
  'docs.tables.fieldTypes.media.storage':
    'Backend de stockage : "local" (défaut) ou "s3" pour le stockage cloud.',
  'docs.tables.fieldTypes.media.generateThumbnail':
    'Booléen. Lorsque true, génère automatiquement des miniatures d’images à l’upload.',
  'docs.tables.fieldTypes.media.storeMetadata':
    'Booléen. Lorsque true, stocke les métadonnées du fichier (dimensions, EXIF, durée).',
  'docs.tables.fieldTypes.computed': 'Champs calculés',
  'docs.tables.fieldTypes.computed.formula':
    'Expression référençant d’autres champs. Exemple : "price * quantity".',
  'docs.tables.fieldTypes.computed.resultType':
    'Type de sortie attendu de la formule : "string", "integer", "decimal", "boolean" ou "date".',
  'docs.tables.fieldTypes.computed.format':
    'Format d’affichage du résultat calculé (ex. : "0 0,00" pour les nombres).',
  'docs.tables.fieldTypes.computed.prefix':
    'Texte ajouté avant les valeurs autonumber (ex. : "TKT-", "FAC-").',
  'docs.tables.fieldTypes.computed.startFrom':
    'Valeur de départ de la séquence autonumber. Par défaut : 1.',
  'docs.tables.fieldTypes.computed.digits':
    'Nombre minimum de chiffres pour autonumber, complété par des zéros. Exemple : 5 → "00001".',
  'docs.tables.fieldTypes.advanced': 'Champs avancés',
  'docs.tables.fieldTypes.advanced.jsonSchema':
    'Objet JSON Schema pour valider le contenu des champs json.',
  'docs.tables.fieldTypes.advanced.itemType':
    'Type de données des éléments d’un tableau : "string", "number", "boolean" ou "object".',
  'docs.tables.fieldTypes.advanced.maxItems': 'Nombre maximum d’éléments dans un champ array.',
  'docs.tables.fieldTypes.advanced.buttonLabel':
    'Texte affiché sur le bouton. Supporte la syntaxe de traduction $t:.',
  'docs.tables.fieldTypes.advanced.buttonAction':
    'Action déclenchée au clic : "openUrl", "runScript" ou "callWebhook".',
  'docs.tables.fieldTypes.advanced.buttonUrl':
    'URL à ouvrir ou webhook à appeler. Supporte les variables de template {field_name}.',
  'docs.tables.fieldTypes.relational': 'Champs relationnels',
  'docs.tables.relational.title': 'Champs relationnels',
  'docs.tables.relational.description':
    'Quatre types de champs permettent les relations inter-tables : relationship, lookup, rollup et count. Ils forment une chaîne — relationship définit le lien, puis lookup, rollup et count en dérivent les données.',
  'docs.tables.relational.relationship.description':
    'Crée un lien par clé étrangère vers une autre table. Fondation de toutes les fonctionnalités relationnelles.',
  'docs.tables.relational.relationship.relatedTable':
    'Nom de la table cible à relier. Doit correspondre à un nom de table existant.',
  'docs.tables.relational.relationship.relationType':
    'Cardinalité : "one-to-one", "many-to-one", "one-to-many" ou "many-to-many".',
  'docs.tables.relational.relationship.foreignKey':
    'Nom personnalisé de la colonne de clé étrangère. Auto-généré si omis.',
  'docs.tables.relational.relationship.displayField':
    'Champ de la table liée affiché dans l’interface (ex. : "name" au lieu de "id").',
  'docs.tables.relational.relationship.onDelete':
    'Action référentielle à la suppression : "cascade", "set-null", "restrict" ou "no-action".',
  'docs.tables.relational.relationship.onUpdate':
    'Action référentielle à la mise à jour : "cascade", "set-null", "restrict" ou "no-action".',
  'docs.tables.relational.relationship.reciprocalField':
    'Nom du champ pour la relation inverse sur la table liée.',
  'docs.tables.relational.relationship.allowMultiple':
    'Booléen. Pour many-to-many, permet de sélectionner plusieurs enregistrements liés.',
  'docs.tables.relational.lookup.description':
    'Lit la valeur d’un champ d’un enregistrement lié via une relation existante. Lecture seule et mise à jour automatique.',
  'docs.tables.relational.lookup.relationshipField':
    'Nom du champ relationship à traverser (doit exister dans la même table).',
  'docs.tables.relational.lookup.relatedField':
    'Nom du champ sur la table liée dont afficher la valeur.',
  'docs.tables.relational.lookup.filters':
    'Expression de filtre optionnelle pour restreindre les enregistrements liés inclus.',
  'docs.tables.relational.rollup.description':
    'Agrège les valeurs de plusieurs enregistrements liés (sum, avg, count, min, max, etc.).',
  'docs.tables.relational.rollup.relationshipField':
    'Nom du champ relationship connectant à la table liée.',
  'docs.tables.relational.rollup.relatedField': 'Champ sur la table liée à agréger.',
  'docs.tables.relational.rollup.aggregation':
    'Fonction d’agrégation : "sum", "avg", "min", "max", "count", "concat" ou "array".',
  'docs.tables.relational.rollup.format':
    'Format d’affichage du résultat agrégé (ex. : "$0 0,00" pour les sommes en devise).',
  'docs.tables.relational.rollup.filters':
    'Filtre optionnel pour n’inclure que les enregistrements correspondants dans l’agrégation.',
  'docs.tables.relational.count.description':
    'Compte le nombre d’enregistrements liés. Un rollup simplifié avec agrégation toujours définie sur count.',
  'docs.tables.relational.count.relationshipField':
    'Nom du champ relationship à partir duquel compter les enregistrements.',
  'docs.tables.relational.count.conditions':
    'Expression de filtre optionnelle pour ne compter que les enregistrements correspondants.',
  'docs.tables.relational.tip.title': 'Chaîne relationnelle',
  'docs.tables.relational.tip.body':
    'Commencez par un champ relationship pour créer le lien, puis utilisez lookup, rollup ou count pour dériver les données sans duplication. Exemple : orders → customer (relationship) → customer_email (lookup).',
  'docs.tables.permissions.title': 'Permissions (RBAC)',
  'docs.tables.permissions.description':
    'Les permissions de table utilisent le contrôle d’accès par rôle. Chaque permission accepte : "all" (public), "authenticated" (utilisateurs connectés), ou un tableau de noms de rôles.',
  'docs.tables.permissions.props.create':
    'Qui peut créer de nouveaux enregistrements. Par défaut : "authenticated".',
  'docs.tables.permissions.props.read':
    'Qui peut consulter les enregistrements. Par défaut : "all".',
  'docs.tables.permissions.props.update':
    'Qui peut modifier les enregistrements existants. Par défaut : "authenticated".',
  'docs.tables.permissions.props.delete':
    'Qui peut supprimer des enregistrements. Par défaut : "authenticated".',
  'docs.tables.permissions.props.comment':
    'Qui peut ajouter des commentaires aux enregistrements. Par défaut : "authenticated".',
  'docs.tables.permissions.props.fields':
    'Objet mappant les noms de champs aux permissions read/update par champ. Permet un contrôle d’accès granulaire.',
  'docs.tables.permissions.props.inherit':
    'Booléen. Lorsque true, hérite les permissions d’une table parente ou des défauts globaux.',
  'docs.tables.permissions.props.override':
    'Booléen. Lorsque true, ces permissions remplacent celles héritées.',
  'docs.tables.permissions.tip.title': 'Trois niveaux d’accès',
  'docs.tables.permissions.tip.body':
    '"all" pour un accès public, "authenticated" pour tout utilisateur connecté, ou un tableau de noms de rôles comme [admin, member] pour des rôles spécifiques.',
  'docs.tables.permissions.security.title': 'Bonne pratique de sécurité',
  'docs.tables.permissions.security.body':
    'Les accès non autorisés renvoient 404 (et non 403) pour empêcher les attaquants de découvrir quelles ressources existent. Cela suit les recommandations OWASP pour la prévention de l’énumération de ressources.',
  'docs.tables.indexes.title': 'Index & Contraintes',
  'docs.tables.indexes.description':
    'Optimisez les requêtes avec des index et garantissez l’intégrité des données avec des contraintes d’unicité et de vérification.',
  'docs.tables.indexes.indexesTitle': 'Index',
  'docs.tables.indexes.indexName': 'Nom lisible optionnel pour l’index (ex. : "idx_email").',
  'docs.tables.indexes.indexFields':
    'Tableau de noms de champs à indexer. Les index composites listent plusieurs champs.',
  'docs.tables.indexes.indexUnique':
    'Booléen. Lorsque true, garantit l’unicité sur les colonnes indexées.',
  'docs.tables.indexes.indexWhere':
    'Condition d’index partiel sous forme d’expression SQL. Seules les lignes correspondantes sont indexées.',
  'docs.tables.indexes.uniqueTitle': 'Contraintes d’unicité',
  'docs.tables.indexes.uniqueName': 'Nom de la contrainte d’unicité (ex. : "uq_email_org").',
  'docs.tables.indexes.uniqueFields':
    'Tableau de noms de champs devant être uniques ensemble (unicité composite).',
  'docs.tables.indexes.constraintsTitle': 'Contraintes de vérification',
  'docs.tables.indexes.constraintName':
    'Nom de la contrainte de vérification (ex. : "chk_positive_price").',
  'docs.tables.indexes.constraintCheck':
    'Expression booléenne SQL devant être vraie pour chaque ligne (ex. : "price > 0").',
  'docs.theme.title': 'Thème',
  'docs.theme.description':
    'La propriété theme définit votre système de design avec 7 catégories de jetons optionnelles. Tous les jetons génèrent des propriétés CSS personnalisées et des classes utilitaires Tailwind CSS.',
  'docs.theme.colors.title': 'colors',
  'docs.theme.colors.description':
    'Jetons de couleur nommés sous forme de paires clé-valeur. Chacun devient une variable CSS (--color-{name}) et une classe Tailwind (bg-{name}, text-{name}).',
  'docs.theme.colors.props.name':
    'Nom du jeton (ex. : primary, accent). Utilisé pour générer la variable CSS --color-{name} et les utilitaires Tailwind.',
  'docs.theme.colors.props.output':
    'Génère la variable CSS --color-{name} plus les classes utilitaires bg-{name}, text-{name}, border-{name}.',
  'docs.theme.fonts.title': 'fonts',
  'docs.theme.fonts.description':
    'Configuration typographique pour les polices de titre, corps et monospace. Supporte family, fallback, weights, size, line height et URL Google Fonts.',
  'docs.theme.fonts.props.family':
    'Nom de la famille de police (ex. : "Inter", "Roboto"). Correspond à CSS font-family.',
  'docs.theme.fonts.props.fallback':
    'Pile de polices de secours utilisée quand la police principale est indisponible (ex. : "system-ui, sans-serif").',
  'docs.theme.fonts.props.weights':
    'Tableau de graisses numériques à charger (ex. : [400, 600, 700]). Optimise la taille du téléchargement.',
  'docs.theme.fonts.props.size':
    'Taille de police de base en valeur CSS (ex. : "16px", "1rem"). Appliquée au texte du corps.',
  'docs.theme.fonts.props.lineHeight':
    'Multiplicateur d’interligne ou valeur CSS (ex. : "1.5", "1.2"). Contrôle l’espacement vertical entre les lignes.',
  'docs.theme.fonts.props.googleFontsUrl':
    'URL complète Google Fonts pour charger automatiquement des polices personnalisées. Injectée comme <link> dans <head>.',
  'docs.theme.spacing.title': 'spacing',
  'docs.theme.spacing.description':
    'Jetons d’espacement nommés sous forme de chaînes de classes Tailwind. Définissez largeurs de conteneur, padding de section, gaps et espacement des composants.',
  'docs.theme.shadows.title': 'shadows',
  'docs.theme.shadows.description':
    'Jetons d’ombre nommés sous forme de valeurs CSS box-shadow. Chacun devient un utilitaire shadow-{name}.',
  'docs.theme.animations.title': 'animations',
  'docs.theme.animations.description':
    'Animations @keyframes personnalisées avec indicateur d’activation, durée, fonction de temporisation, nombre d’itérations et définitions de keyframes.',
  'docs.theme.breakpoints.title': 'breakpoints',
  'docs.theme.breakpoints.description':
    'Points de rupture responsifs personnalisés en pixels. Chacun devient une media query min-width pour les utilitaires responsifs.',
  'docs.theme.borderRadius.title': 'borderRadius',
  'docs.theme.borderRadius.description':
    'Jetons de rayon de bordure nommés sous forme de valeurs CSS. Chacun devient une classe utilitaire rounded-{name}.',
  'docs.theme.fonts.tip.title': 'Google Fonts',
  'docs.theme.fonts.tip.body':
    'Ajoutez une googleFontsUrl pour charger automatiquement des polices personnalisées. L’URL est injectée comme balise <link> dans le head de la page.',
  'docs.theme.advanced.title': 'Ombres, Animations & Plus',
  'docs.theme.advanced.description':
    'Jetons de design supplémentaires pour ombres, animations, points de rupture responsifs et rayon de bordure.',
  'docs.theme.fullExample.title': 'Exemple complet',
  'docs.theme.fullExample.description':
    'Une configuration de thème complète combinant couleurs, polices, espacement et ombres.',
  'docs.theme.screenshot.alt': 'Application Sovrium avec un thème personnalisé',
  'docs.theme.screenshot.caption':
    'Une application CRM rendue avec des couleurs, polices et espacements personnalisés.',
  'docs.pages.title': 'Pages & Composants',
  'docs.pages.description':
    'Les pages sont rendues côté serveur via un système d’arbre de composants. Chaque page a un name, un path, des métadonnées (SEO, favicons) et des sections contenant des composants imbriqués.',
  'docs.pages.structure.title': 'Structure d’une page',
  'docs.pages.structure.description':
    'Chaque page a un name, un path, des métadonnées SEO et des sections avec des composants imbriqués.',
  'docs.pages.pageProps.title': 'Propriétés de page',
  'docs.pages.pageProps.description': 'Chaque page du tableau pages accepte ces propriétés.',
  'docs.pages.pageProps.name':
    'Identifiant unique de la page. Utilisé pour le routage interne et le référencement.',
  'docs.pages.pageProps.path':
    'Chemin URL de la page (ex. : "/", "/about", "/blog/:slug"). Supporte les segments dynamiques.',
  'docs.pages.pageProps.meta':
    'Objet de métadonnées SEO : title, description, OpenGraph, Twitter cards, données structurées, favicon.',
  'docs.pages.pageProps.sections':
    'Tableau de nœuds de composants formant le corps de la page. Chaque section est un arbre de composants.',
  'docs.pages.pageProps.scripts':
    'Tableau d’URLs de scripts ou de code inline à injecter dans la page.',
  'docs.pages.metaSeo.title': 'Meta & SEO',
  'docs.pages.metaSeo.description':
    'Métadonnées complètes pour les moteurs de recherche, le partage social et l’affichage navigateur.',
  'docs.pages.meta.props.title':
    'Titre de la page affiché dans l’onglet du navigateur et les résultats de recherche. Supporte les traductions $t:.',
  'docs.pages.meta.props.description':
    'Description de la page pour les moteurs de recherche. 150–160 caractères recommandés.',
  'docs.pages.meta.props.openGraph':
    'Métadonnées OpenGraph pour le partage social : title, description, image, type, url.',
  'docs.pages.meta.props.twitter':
    'Métadonnées Twitter Card : card (summary, summary_large_image), site, creator.',
  'docs.pages.meta.props.structuredData':
    'Données structurées JSON-LD pour les résultats de recherche enrichis : type, name, description et propriétés personnalisées.',
  'docs.pages.meta.props.favicon':
    'Chemin vers le fichier favicon (ex. : "/favicon.ico", "/icon.svg").',
  'docs.pages.meta.props.canonical':
    'URL canonique pour éviter les problèmes de contenu dupliqé dans les moteurs de recherche.',
  'docs.pages.componentModel.title': 'Modèle de composant',
  'docs.pages.componentModel.description':
    'Chaque composant dans l’arbre est un nœud avec un type, un content optionnel, des props et des children. Ce modèle récursif permet une composition UI arbitraire.',
  'docs.pages.componentModel.type':
    'Un des 62 types de composants (ex. : "section", "h1", "card", "button").',
  'docs.pages.componentModel.content':
    'Contenu textuel du composant. Supporte la syntaxe de traduction $t: pour l’i18n.',
  'docs.pages.componentModel.props':
    'Attributs HTML et classes CSS. className est le plus courant pour le style Tailwind.',
  'docs.pages.componentModel.children':
    'Tableau de nœuds de composants imbriqués, formant une structure arborescente récursive.',
  'docs.pages.componentModel.interactions':
    'Configuration d’animations et comportements : effets de survol, actions au clic, déclencheurs de défilement, animations d’entrée.',
  'docs.pages.componentModel.ref':
    'Référence à un template de composant réutilisable défini dans le tableau components.',
  'docs.pages.componentModel.vars':
    'Variables à substituer dans le template référencé (ex. : $title, $description).',
  'docs.pages.componentModel.tip.title': 'Composition récursive',
  'docs.pages.componentModel.tip.body':
    'Tout composant peut contenir des children, qui peuvent eux-mêmes contenir des children. Cela permet de construire des mises en page complexes à partir de blocs simples et imbriqués.',
  'docs.pages.componentTypes.title': '62 types de composants',
  'docs.pages.componentTypes.description':
    'Les composants forment un arbre récursif — chacun peut avoir type, content, props et children.',
  'docs.pages.componentTypes.layout': 'Mise en page',
  'docs.pages.componentTypes.typography': 'Typographie & Texte',
  'docs.pages.componentTypes.media': 'Média & Images',
  'docs.pages.componentTypes.interactive': 'Interactif & Navigation',
  'docs.pages.componentTypes.display': 'Cartes & Affichage',
  'docs.pages.componentTypes.feedback': 'Retour & Utilitaires',
  'docs.pages.componentTypes.layout.description':
    'Éléments structurels qui contrôlent la mise en page, les sections et le flux du contenu.',
  'docs.pages.componentTypes.typography.description':
    'Éléments textuels des titres aux paragraphes, texte inline et blocs de code.',
  'docs.pages.componentTypes.media.description':
    'Éléments visuels et multimédia pour images, avatars, vidéo, audio et intégrations.',
  'docs.pages.componentTypes.interactive.description':
    'Éléments d’interaction incluant boutons, liens, accordéons et navigation.',
  'docs.pages.interactions.title': 'Interactions',
  'docs.pages.interactions.description':
    'Les composants supportent 4 types d’interaction via la propriété interactions : hover (transformation, opacité, échelle, ombre), click (navigation, défilement, bascule), scroll (parallaxe, fondu, comportement sticky) et entrance (animation à la première vue avec délai et durée).',
  'docs.pages.interactions.hover.title': 'Survol',
  'docs.pages.interactions.hover.description':
    'Transformation, opacité, échelle et changements d’ombre au survol de la souris.',
  'docs.pages.interactions.click.title': 'Clic',
  'docs.pages.interactions.click.description':
    'Naviguer vers une URL, défiler vers une ancre ou basculer la visibilité.',
  'docs.pages.interactions.scroll.title': 'Défilement',
  'docs.pages.interactions.scroll.description':
    'Effets de parallaxe, fondu au défilement et positionnement sticky.',
  'docs.pages.interactions.entrance.title': 'Entrée',
  'docs.pages.interactions.entrance.description':
    'Animer lorsque l’élément entre dans la fenêtre d’affichage avec délai et durée configurables.',
  'docs.pages.templates.title': 'Templates de composants',
  'docs.pages.templates.description':
    'Définissez des composants réutilisables avec des références $ref et la substitution de $variable pour un balisage DRY.',
  'docs.pages.screenshot.hero.alt': 'Section hero rendue par Sovrium',
  'docs.pages.screenshot.hero.caption':
    'Une section hero avec titre, description et boutons d’appel à l’action — le tout depuis la config YAML.',
  'docs.pages.screenshot.features.alt': 'Grille de fonctionnalités rendue par Sovrium',
  'docs.pages.screenshot.features.caption':
    'Une grille à 3 colonnes utilisant des composants section, grid et card avec des icônes emoji.',
  'docs.auth.title': 'Authentification',
  'docs.auth.description':
    'Authentification intégrée propulsée par Better Auth. Configurez les stratégies, les rôles, l’authentification à deux facteurs et les modèles d’e-mail.',
  'docs.auth.basic.title': 'Configuration de base',
  'docs.auth.basic.description':
    'Commencez avec la config auth la plus simple — email et mot de passe avec un rôle par défaut.',
  'docs.auth.strategies.title': 'Stratégies',
  'docs.auth.strategies.description':
    'Choisissez une ou plusieurs stratégies d’authentification à proposer à vos utilisateurs.',
  'docs.auth.strategies.emailPassword':
    'Email + mot de passe traditionnel. Supporte l’inscription, la connexion, la réinitialisation du mot de passe et la vérification d’email.',
  'docs.auth.strategies.magicLink':
    'Authentification sans mot de passe via un lien unique envoyé par email. Aucun mot de passe à retenir.',
  'docs.auth.strategies.oauth':
    'Connexion sociale via des fournisseurs externes. Supporte : google, github, apple, microsoft, facebook, twitter, discord, spotify, twitch, gitlab, bitbucket, linkedin, dropbox.',
  'docs.auth.oauth.title': 'Ajout d’OAuth',
  'docs.auth.oauth.description':
    'Ajoutez des fournisseurs de connexion sociale en plus de l’email-password. Plusieurs stratégies peuvent coexister.',
  'docs.auth.oauth.warning.title': 'Variables d’environnement requises',
  'docs.auth.oauth.warning.body':
    'Les fournisseurs OAuth nécessitent AUTH_SECRET et les variables CLIENT_ID / CLIENT_SECRET spécifiques au fournisseur.',
  'docs.auth.roles.title': 'Rôles & Permissions',
  'docs.auth.roles.description':
    'Trois rôles intégrés : admin, member, viewer. Définissez des rôles personnalisés avec nom + description. Définissez defaultRole pour les nouveaux utilisateurs. Le premier utilisateur devient automatiquement admin.',
  'docs.auth.roles.admin':
    'Accès complet à toutes les fonctionnalités, gestion des utilisateurs et paramètres.',
  'docs.auth.roles.member':
    'Peut créer, lire et modifier des enregistrements. Ne peut pas gérer les utilisateurs.',
  'docs.auth.roles.viewer':
    'Accès en lecture seule. Ne peut pas créer ou modifier d’enregistrements.',
  'docs.auth.twoFactor.title': 'Auth à deux facteurs',
  'docs.auth.twoFactor.description':
    '2FA basée sur TOTP optionnelle. Activez avec twoFactor: true dans la config auth. Les utilisateurs peuvent configurer des applications d’authentification.',
  'docs.auth.emails.title': 'Modèles d’e-mail',
  'docs.auth.emails.description':
    'E-mails personnalisables pour la vérification, la réinitialisation du mot de passe et le lien magique. Supporte la substitution de variables $name, $url, $email dans le sujet et le corps.',
  'docs.auth.emails.var.name': 'Le nom d’affichage du destinataire.',
  'docs.auth.emails.var.url':
    'L’URL d’action (lien de vérification, lien de réinitialisation ou lien magique).',
  'docs.auth.emails.var.email': 'L’adresse email du destinataire.',
  'docs.auth.emails.var.org': 'Le nom de l’organisation (pour les emails d’invitation).',
  'docs.auth.emails.var.inviter': 'Le nom de la personne qui a envoyé l’invitation.',
  'docs.auth.env.title': 'Variables d’environnement',
  'docs.auth.env.description':
    'Variables d’environnement requises pour l’authentification. Définissez-les dans votre fichier .env ou l’environnement serveur.',
  'docs.auth.env.secret':
    'Clé secrète pour signer les jetons et chiffrer les sessions. Doit être une chaîne aléatoire forte.',
  'docs.auth.env.baseUrl':
    'URL de base de votre application (ex. : https://myapp.com). Utilisée pour les URL de callback.',
  'docs.auth.env.clientId':
    'Identifiant client OAuth depuis la console développeur du fournisseur.',
  'docs.auth.env.clientSecret':
    'Secret client OAuth depuis la console développeur du fournisseur. Gardez-le confidentiel.',
  'docs.languages.title': 'Langues',
  'docs.languages.description':
    'Support multilingue avec clés de traduction, détection de la langue du navigateur et routage automatique par URL (/en/..., /fr/...). Référencez les traductions dans les pages avec le préfixe $t:.',
  'docs.languages.defining.title': 'Définir les langues',
  'docs.languages.defining.description':
    'Définissez une langue par défaut et listez les langues supportées avec code, locale, libellé et direction du texte.',
  'docs.languages.props.default':
    'Code ISO 639-1 de la langue par défaut (ex. : "en"). Utilisé quand aucune langue n’est détectée.',
  'docs.languages.props.supported':
    'Tableau d’objets d’entrée de langue. Chacun définit une langue supportée.',
  'docs.languages.entryProps.title': 'Propriétés d’entrée de langue',
  'docs.languages.entryProps.description':
    'Chaque entrée du tableau supported décrit une langue avec ces propriétés.',
  'docs.languages.entryProps.code':
    'Code ISO 639-1 de la langue (ex. : "en", "fr", "ar"). Utilisé dans le routage URL (/en/, /fr/).',
  'docs.languages.entryProps.locale':
    'Identifiant de locale complet (ex. : "en-US", "fr-FR", "ar-SA"). Utilisé pour le formatage des nombres et dates.',
  'docs.languages.entryProps.label':
    'Nom lisible de la langue affiché dans les sélecteurs de langue (ex. : "English", "Français").',
  'docs.languages.entryProps.direction':
    'Direction du texte : "ltr" (gauche à droite) pour la plupart des langues, "rtl" (droite à gauche) pour l’arabe, l’hébreu, etc.',
  'docs.languages.rtl.title': 'Support RTL',
  'docs.languages.rtl.description':
    'Définissez direction: rtl pour les langues droite-à-gauche comme l’arabe ou l’hébreu. Sovrium inverse automatiquement la mise en page, aligne le texte à droite et applique l’attribut dir="rtl" à la racine HTML.',
  'docs.languages.translations.title': 'Clés de traduction',
  'docs.languages.translations.description':
    'Définissez des paires clé-valeur pour chaque langue. Les clés utilisent la notation pointée pour l’organisation.',
  'docs.languages.usage.title': 'Utiliser les traductions',
  'docs.languages.usage.description':
    'Référencez les traductions dans tout contenu ou valeur de propriété avec le préfixe $t:.',
  'docs.languages.syntax.title': 'Syntaxe de traduction $t:',
  'docs.languages.syntax.description':
    'Utilisez $t:key.path dans tout contenu ou valeur de propriété de page pour référencer une traduction. Exemple : $t:hero.title se résout en "Welcome" en anglais et "Bienvenue" en français.',
  'docs.languages.adding.title': 'Ajouter une nouvelle langue',
  'docs.languages.adding.description':
    'Suivez ces étapes pour ajouter une nouvelle langue à votre application.',
  'docs.languages.adding.step1.title': 'Ajouter l’entrée de langue',
  'docs.languages.adding.step1.description':
    'Ajoutez un nouvel élément au tableau supported avec code, locale, libellé et direction.',
  'docs.languages.adding.step2.title': 'Ajouter les traductions',
  'docs.languages.adding.step2.description':
    'Créez une nouvelle section de traductions pour le code de langue avec toutes les clés nécessaires.',
  'docs.languages.adding.step3.title': 'Tester la langue',
  'docs.languages.adding.step3.description':
    'Visitez /[code-langue]/ dans votre navigateur pour vérifier que la nouvelle langue s’affiche correctement.',
  'docs.languages.screenshot.en.alt': 'Version anglaise de l’application',
  'docs.languages.screenshot.en.caption': 'English — /en/',
  'docs.languages.screenshot.fr.alt': 'Version française de l’application',
  'docs.languages.screenshot.fr.caption': 'Français — /fr/',
  'docs.analytics.title': 'Analytiques',
  'docs.analytics.description':
    'Analytiques intégrées, respectueuses de la vie privée, sans cookies, sans services externes et entièrement conformes au RGPD. Toutes les données restent sur votre serveur.',
  'docs.analytics.howItWorks.title': 'Comment ça marche',
  'docs.analytics.howItWorks.description':
    'Les analytiques Sovrium suivent un pipeline simple en trois étapes — aucun service externe requis.',
  'docs.analytics.howItWorks.collect.title': 'Collecter',
  'docs.analytics.howItWorks.collect.description':
    'Un script léger enregistre les pages vues, sessions, référents et infos appareil via /api/analytics/collect.',
  'docs.analytics.howItWorks.store.title': 'Stocker',
  'docs.analytics.howItWorks.store.description':
    'Toutes les données sont stockées localement dans votre base de données. Pas de cookies, pas de fingerprinting, pas d’appels externes.',
  'docs.analytics.howItWorks.query.title': 'Interroger',
  'docs.analytics.howItWorks.query.description':
    'Accédez à vos analytiques via le tableau de bord admin ou l’API. Les données restent sur votre serveur.',
  'docs.analytics.quickEnable.title': 'Activation rapide',
  'docs.analytics.quickEnable.description':
    'Activez analytics à true pour des paramètres par défaut — aucune configuration nécessaire.',
  'docs.analytics.booleanVsObject.title': 'Booléen vs Objet',
  'docs.analytics.booleanVsObject.description':
    'analytics: true active les paramètres par défaut (rétention 90 jours, DNT respecté, sessions de 30 min). Utilisez un objet pour personnaliser des paramètres spécifiques tout en gardant les valeurs par défaut pour le reste.',
  'docs.analytics.advanced.title': 'Configuration avancée',
  'docs.analytics.advanced.description':
    'Affinez le comportement des analytiques avec rétention, vie privée et options de session.',
  'docs.analytics.props.retentionDays':
    'Nombre de jours de rétention des données analytiques. Par défaut : 90.',
  'docs.analytics.props.respectDoNotTrack':
    'Lorsque true, respecte le paramètre Do Not Track du navigateur. Par défaut : true.',
  'docs.analytics.props.excludePaths':
    'Tableau de chemins URL à exclure du suivi (ex. : /admin, /api).',
  'docs.analytics.props.sessionTimeout':
    'Délai d’expiration de session en minutes. Une nouvelle session démarre après cette période d’inactivité. Par défaut : 30.',
  'docs.analytics.privacy.title': 'Analytiques orientées vie privée',
  'docs.analytics.privacy.body':
    'Les analytiques Sovrium sont sans cookies, conformes RGPD par défaut. Toutes les données restent sur votre serveur — aucun service tiers impliqué.',
  'docs.analytics.details':
    'Lorsqu’activé, Sovrium injecte un script de suivi léger qui enregistre les pages vues, les sessions, les référents et les informations sur l’appareil. Les données analytiques sont collectées à /api/analytics/collect et stockées localement.',
}
