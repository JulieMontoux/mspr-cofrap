# Gestion de projet — MSPR TPRE921 COFRAP

## 1. Organisation de l'équipe

### Composition et répartition des rôles

| Membre  | Environnement          | Rôle principal                                    |
|---------|------------------------|---------------------------------------------------|
| Julie   | Mac Apple Silicon M3   | Lead technique — Infrastructure, K3s, Proxmox, CI/CD |
| Paul    | Mac Apple Silicon M2   | Développeur — fonction `generate-password`, frontend |
| Yassin  | Windows AMD64          | Développeur — fonction `generate-2fa`             |
| Mathieu | Windows AMD64          | Développeur — fonction `authenticate`             |

La répartition a tenu compte des environnements hétérogènes (ARM64 vs AMD64) pour anticiper les problèmes de compatibilité multi-architecture Docker, réels et documentés dans ce projet.

---

## 2. Méthode de travail — Agilité

### Approche adoptée

Le projet a utilisé une **méthode agile légère** adaptée à la durée courte (19 heures de préparation) et au contexte académique. Chaque itération correspondait à une mission du cahier des charges.

### Outil de suivi : Kanban (Trello)

Structure des colonnes :

```
À faire  →  En cours  →  Revue Technique  →  Terminé
```

La colonne **Revue Technique** est centrale : aucune tâche ne passe directement de "En cours" à "Terminé" sans validation par un autre membre de l'équipe. Cette étape collective permet d'identifier les erreurs non détectées par l'auteur de la tâche (biais de proximité).

### Découpage des tâches (extrait)

| Tâche                                | Estimation | Réel    | Écart |
|--------------------------------------|-----------|---------|-------|
| Analyse sujet + choix technos        | 2h        | 2h      | 0     |
| Installation Proxmox + K3s           | 3h        | 4h      | +1h   |
| Déploiement OpenFaaS via Helm        | 2h        | 2h30    | +30mn |
| Développement `generate-password`    | 3h        | 3h      | 0     |
| Développement `generate-2fa`         | 2h        | 2h      | 0     |
| Développement `authenticate`         | 3h        | 3h30    | +30mn |
| Développement frontend (React/Vite)  | 3h        | 4h      | +1h   |
| Tests unitaires (pytest)             | 2h        | 2h      | 0     |
| Build multi-arch + déploiement final | 2h        | 3h      | +1h   |
| Rédaction dossier                    | 3h        | 3h      | 0     |
| **Total**                            | **25h**   | **29h** | **+4h** |

---

## 3. Diagramme de Gantt

Voir `docs/gantt.png` pour la représentation visuelle.

Le planning s'étale sur **8 semaines** avec trois phases parallèles :
- Infrastructure & cluster (violet) — Julie en lead
- Fonctions serverless & base de données (bleu) — Paul, Yassin, Mathieu en parallèle
- Frontend, exposition & livrables (vert) — Paul/Julie + équipe complète

---

## 4. Environnement de travail inclusif et respectueux

### Principes adoptés par l'équipe

L'équipe a réfléchi en amont aux mesures permettant d'assurer un environnement de travail **inclusif, tolérant et respectueux des sensibilités de chacun·e**, conformément aux attentes du bloc 2 RNCP35584.

### 4.1 Accueil d'une personne en situation de handicap visuel

**Contexte :** Si un membre de l'équipe présentait un handicap visuel (déficience partielle ou totale), les adaptations suivantes auraient été mises en place :

**Sur les outils de développement :**
- Utilisation de **VSCode** avec thème haut contraste (Dark High Contrast) et extension accessibilité Nvda/VoiceOver
- Toutes les revues de code effectuées en **oral pair programming** via appel vidéo, avec partage d'écran commenté vocalement — pas de revue silencieuse par PR uniquement
- Documentation en **Markdown** structuré (titres hiérarchiques, listes) compatible avec les lecteurs d'écran, plutôt qu'en PDF non balisé

**Sur le frontend développé :**
- Tous les boutons ont des `aria-label` explicites
- Les images ont des attributs `alt` descriptifs
- Les messages d'erreur utilisent `role="alert"` (lecture automatique par les lecteurs d'écran)
- Contrastes WCAG AA (4.5:1 minimum) respectés sur tous les textes
- Navigation clavier complète (Tab, Enter)
- Respect de `prefers-reduced-motion` pour les animations

**Sur la communication d'équipe :**
- Comptes-rendus de réunion rédigés systématiquement (pas de "tu te souviendras")
- Tickets Kanban détaillés, pas de communication orale uniquement
- Partage de l'écran en début de chaque session de travail pour synchroniser visuellement

### 4.2 Travail à distance et télétravail

L'intégralité du projet a été conduite **à distance**, les membres étant sur des postes de travail différents (Mac ARM64 et Windows AMD64). Les mesures en place :

**Communication synchrone :**
- Réunions hebdomadaires courtes (30 min max) via **Discord** avec partage d'écran
- Ordre du jour envoyé 30 min avant chaque réunion — personne n'arrive à l'improviste
- Compte-rendu posté dans le canal dédié dans l'heure suivant la réunion

**Communication asynchrone :**
- Canal Discord `#mspr-cofrap` pour toutes les décisions techniques (traçabilité)
- **Git commits atomiques** avec messages descriptifs — l'historique est la mémoire du projet
- Pull Requests obligatoires même entre membres de la même équipe (revue croisée)

**Prévention de la surcharge :**
- Pas de messages en dehors des heures de travail sauf urgence bloquante
- Chaque membre a la liberté de déclarer un ticket "bloqué" sans justification excessive
- Les retards estimés sont communiqués au plus tôt (pas de dissimulation)

### 4.3 Communication inclusive — équipe multiculturelle

Bien que l'équipe soit francophone, les bonnes pratiques de communication inclusive ont été adoptées :

- **Code source en anglais** (variables, fonctions, commits) pour faciliter une éventuelle reprise internationale du projet
- **Documentation en français** pour correspondre au contexte client et au jury
- Utilisation systématique de l'**écriture inclusive** dans les documents (e.g. "chacun·e")
- Les décisions techniques sont toujours accompagnées d'une **justification écrite** — on ne présuppose pas que tout le monde a le même niveau de maîtrise de chaque technologie
- Accueil bienveillant des questions "basiques" — pas de jugement sur le niveau de connaissance

### 4.4 Tableau de bord de suivi de performance

| Indicateur                         | Méthode de mesure          | Fréquence |
|------------------------------------|----------------------------|-----------|
| Avancement des tâches Kanban       | % colonnes Terminé / Total | Hebdo     |
| Couverture de tests                | pytest — nb tests passés   | À chaque commit |
| Disponibilité des services         | `test_cluster.sh`          | Manuel avant livraison |
| Écart planning (estimation vs réel)| Tableau section 2          | Fin de sprint |

---

## 5. Difficultés rencontrées et solutions apportées

| Difficulté                                             | Impact  | Solution adoptée                                                                 |
|--------------------------------------------------------|---------|----------------------------------------------------------------------------------|
| Build Docker multi-arch (ARM64 + AMD64) très lent via QEMU | Bloquant | Build AMD64 uniquement sur la machine de production (natif) |
| Imports Python relatifs impossibles dans dossiers avec tirets (`generate-2fa`) | Bloquant | Import absolu `import handler` + exécution pytest depuis le dossier de la fonction |
| Nœud worker K3s inaccessible après redémarrage Proxmox | Critique | Reconfiguration systemd K3s + vérification automatique au démarrage |
| `faas-cli deploy` refusé sur `127.0.0.1:8080` (gateway non exposée) | Bloquant | Déploiement via gateway Cloudflare `https://openfaas.webeclosion.dev` |
| Environnement hétérogène ARM64/AMD64 dans l'équipe     | Moyen   | Script `setup/setup.sh` détectant automatiquement l'architecture |

---

## 6. Justification des choix technologiques

| Choix                  | Alternatives considérées            | Justification                                                                 |
|------------------------|-------------------------------------|-------------------------------------------------------------------------------|
| K3s (BareMetal)        | Minikube, KinD, GKE                 | Proximité avec environnement de production réel ; pas de coût cloud ; recommandé explicitement dans le sujet |
| Proxmox                | UTM (Mac) / VirtualBox (Windows)    | Hyperviseur professionnel permettant un vrai cluster 2 nœuds (control-plane + worker) |
| PostgreSQL             | MariaDB, MongoDB                    | Recommandé dans le sujet ; maturité ; support bcrypt natif via pgcrypto |
| Python 3               | Node.js, Go                         | Recommandé dans le sujet ; bibliothèques `bcrypt`, `pyotp`, `qrcode` disponibles et stables |
| Cloudflare Tunnel      | Ingress NodePort, MetalLB + DNS     | Exposition HTTPS sans IP publique fixe ; certificat TLS automatique ; zéro config réseau |
| React + Vite           | HTML/JS vanilla, Vue                | Ecosystème moderne ; hot reload ; compatible Tailwind CSS |
| OpenFaaS Community     | Knative, Fission                    | Recommandé dans le sujet ; déploiement Helm simple ; UI intégrée |
