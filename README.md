# ProOWeb

Process-Oriented Web Application Builder.

## Vision

ProOWeb est un editeur web (IDE) qui aide une equipe a construire une application metier
(backend + frontend) en restant centree sur les processus, tout en gardant la main sur le code source.

## Ce que fait ce MVP

- Lance un editeur Node.js sur `http://localhost:1755` via `npm run prooweb`.
- Affiche un wizard si le workspace n'est pas initialise.
- Recupere les informations de base du projet, du super administrateur, du depot Git,
  et des options backend Swagger UI.
- Genere automatiquement le projet cible **a la racine du depot courant**:
  - `src/backend/springboot` (Spring Boot multi-modules strict type Njangui):
    `gateway`, `kernel` (`*-domain`, `*-application`, `*-infrastructure`),
    `common` (`*-domain`, `*-application`, `*-infrastructure`),
    `system` (`*-domain`, `*-application`, `*-infrastructure`),
    `prooweb-application` (composition executable),
    `tests` (`test-support`, `vanilla-unit-tests/*-ut`, `*-it`),
  - `src/frontend/web/react` (React/Vite connecte au backend),
  - `src/frontend/mobile` (placeholder),
  - `deployment/docker` avec profils `dev`, `demo`, `test`, `preprod`, `prod`,
  - scripts raccourcis racine (build/test/start).
- Versionne les sources generees via `.prooweb-managed.json`.
- Expose un endpoint de migration (`POST /api/migrate`) avec strategie de conflits,
  backup automatique et rapport detaille.

## Regle Git du wizard

- Si l'utilisateur renseigne un lien Git:
  - l'ancien `.git` est remplace,
  - un nouveau depot Git est initialise,
  - `origin` pointe sur le lien fourni.
- Si aucun lien n'est renseigne:
  - le dossier `.git` courant est supprime.

## Swagger UI

Le wizard permet d'activer Swagger UI uniquement pour les profils non preprod/prod (`dev`, `demo`, `test`).
Quand active, ProOWeb:

- ajoute la dependance `springdoc-openapi-starter-webmvc-ui`,
- garde Swagger desactive par defaut,
- active Swagger sur les profils selectionnes via `application-<profile>.yml`.

## Migration intelligente

`POST /api/migrate` applique une migration geree avec les regles suivantes:

- Compare les fichiers generes cibles avec le dernier manifest gere.
- Detecte les modifications manuelles sur fichiers geres (conflits).
- Cree automatiquement un backup avant ecrasement:
  - `.prooweb/backups/<migration-id>/<fichier>`
- Gere aussi les collisions de chemin (fichier existant non gere sur un chemin desormais gere),
  avec backup puis ecrasement.
- Retourne un rapport detaille:
  - compteurs (`created`, `updated`, `unchanged`, `conflictsResolved`, `collisionsResolved`, `backupsCreated`),
  - listes detaillees par fichier,
  - chemin de backup racine.

## Utilisation

1. Demarrer l'editeur:

```bash
npm run prooweb
```

2. Ouvrir `http://localhost:1755` et terminer le wizard.

3. Utiliser les raccourcis npm (depuis la racine):

```bash
npm run compile
npm test
npm run start:dev
npm run start:demo
npm run start:test
npm run start:preprod
npm run start:prod
```

## Architecture interne de l'editeur

Le code ProOWeb est separe en couches explicites:

- `ProOWeb/src/server.js`: composition root (assemblage des dependances).
- `ProOWeb/src/routes`: mapping des routes HTTP vers les controleurs.
- `ProOWeb/src/controllers`: adaptation HTTP (parsing request / mapping reponses).
- `ProOWeb/src/services`: logique metier (initialisation, statut, migration).
- `ProOWeb/src/http`: primitives HTTP reutilisables (JSON body, responses, static files).
- `ProOWeb/src/lib/generator.js`: orchestration de generation (workflow + manifest + ecriture).
- `ProOWeb/src/lib/generator/templates/`: templates des sources generees, un fichier par template (classes par techno/framework).

## Fichiers clefs

- `ProOWeb/src/server.js`: composition root du serveur editor.
- `ProOWeb/src/routes/app-router.js`: routage HTTP centralise.
- `ProOWeb/src/controllers/workspace-controller.js`: controleur des endpoints workspace.
- `ProOWeb/src/services/workspace-service.js`: cas d'usage metier workspace.
- `ProOWeb/src/http/*`: utilitaires HTTP mutualises.
- `ProOWeb/src/lib/workspace.js`: validation + persistance + versionnage management.
- `ProOWeb/src/lib/generator.js`: orchestration generation et manifest.
- `ProOWeb/src/lib/generator/templates/index.js`: index d'assemblage des templates.
- `ProOWeb/src/lib/generator/templates/**`: un template = un fichier, organise par domaine/technologie.
- `ProOWeb/src/lib/migration.js`: moteur de migration intelligente (conflits/backups/rapport).
- `ProOWeb/src/lib/git.js`: politique Git appliquee par le wizard.
- `ProOWeb/public/assets/js/*`: frontend modulaire (shared, wizard, dashboard).
- `ProOWeb/public/assets/css/*`: styles modularises (tokens, base, components, pages).
- `ProOWeb/public/*`: pages HTML + shims de compatibilite.
