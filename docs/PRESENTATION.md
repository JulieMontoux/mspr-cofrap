# Support de présentation — MSPR TPRE921 COFRAP
## Structure soutenance 20 minutes

> Ce document est le plan détaillé des slides. À transposer dans Google Slides / PowerPoint.

---

## SLIDE 1 — Page de garde (30s)

**Titre :** COFRAP — Système d'authentification serverless  
**Sous-titre :** MSPR TPRE921 — Bloc 2 RNCP35584  
**Équipe :** Julie · Paul · Yassin · Mathieu  
**Date :** Juin 2025 · EPSI

*Visuel : logo EPSI + icône bouclier*

---

## SLIDE 2 — Le contexte client (1 min)

**Titre :** Qui est la COFRAP ?

- Compagnie Française de Réalisation d'Applicatifs Professionnels
- Problème identifié : mots de passe trop simples, 2FA non activée → compromissions
- Besoin : automatiser la création de comptes sécurisés (MDP 24 chars + TOTP obligatoire)
- Contrainte : rotation des credentials tous les **6 mois**

*Visuel : schéma simple "avant / après"*

---

## SLIDE 3 — Notre solution en 30 secondes (1 min)

**Titre :** Architecture globale

```
Navigateur
    ↕  HTTPS
Frontend React (Nginx)
    ↕  HTTPS (Cloudflare Tunnel)
OpenFaaS Gateway (K3s)
    ↕
3 fonctions Python  ←→  PostgreSQL
```

- **3 fonctions** : `generate-password` · `generate-2fa` · `authenticate`
- **Cluster K3s** sur Proxmox (2 nœuds)
- **Exposition** via Cloudflare Tunnel (HTTPS automatique)

*Visuel : schéma architecture avec logos*

---

## SLIDE 4 — Organisation de l'équipe (1 min 30)

**Titre :** Répartition des rôles

| Membre  | Rôle | Environnement |
|---------|------|---------------|
| Julie   | Lead technique — Infrastructure | Mac ARM64 |
| Paul    | generate-password + frontend | Mac ARM64 |
| Yassin  | generate-2fa | Windows AMD64 |
| Mathieu | authenticate | Windows AMD64 |

**Points clés :**
- Équipe hétérogène ARM64 / AMD64 → script `setup.sh` auto-détectant l'archi
- Communication : Discord asynchrone + réunions hebdo 30min
- Revue croisée obligatoire (colonne "Revue Technique" Kanban)

*Visuel : avatars + environnements*

---

## SLIDE 5 — Planning & suivi (2 min)

**Titre :** Diagramme de Gantt + Kanban

**Sous-section gauche — Gantt :**
- 8 semaines, 3 phases parallèles (infrastructure / dev / livrables)
- *(insérer image docs/gantt.png)*

**Sous-section droite — Kanban :**
- Colonnes : À faire → En cours → Revue Technique → Terminé
- *(insérer screenshot Trello)*

**Point management :** +4h d'écart sur 29h réelles (14% de dérive) — principalement build multi-arch

---

## SLIDE 6 — Environnement inclusif (1 min 30)

**Titre :** Travail inclusif & à distance

**3 points à valoriser :**

1. **100% à distance** — Discord + Git comme mémoire collective
   - Comptes-rendus systématiques, asynchrone first

2. **Handicap visuel** — mesures concrètes
   - Code accessible (aria-label, alt, role="alert", contraste WCAG AA)
   - Revues de code orales + pair programming
   - Documentation structurée (compatible lecteurs d'écran)

3. **Équipe hétérogène** — code en anglais, docs en français
   - Décisions toujours justifiées par écrit
   - Pas de présupposé sur le niveau de chacun

*Visuel : icône accessibilité + Discord + Git*

---

## SLIDE 7 — Démonstration live (5 min)

**Titre :** Démonstration — [cofrap.webeclosion.dev](https://cofrap.webeclosion.dev)

**Scénario :**
1. Onglet "Inscription" → saisir un nom d'utilisateur
2. Clic "Générer mot de passe & 2FA"
3. Montrer : mot de passe 24 chars + QR code MDP + QR code 2FA
4. Scanner QR 2FA avec Google Authenticator
5. Onglet "Connexion" → saisir identifiants + code OTP
6. *(Easter egg surprise pour le jury 🎉)*

**Points à mentionner :**
- Countdown 30s sur le mot de passe (sécurité)
- Expiration 6 mois (côté backend, authenticate retourne `action: renew`)
- Verrouillage après 5 tentatives

---

## SLIDE 8 — Les fonctions en détail (2 min)

**Titre :** 3 fonctions OpenFaaS — Python

**generate-password**
- Entrée : `{ username }` · Sortie : `{ generated_password, qr_code_base64 }`
- bcrypt (cost 12) + secret 64 chars aléatoires
- Validation regex username `^[a-zA-Z0-9_-]{3,32}$`

**generate-2fa**
- Entrée : `{ username }` · Sortie : `{ qr_code_base64 }`  
- pyotp TOTP + qrcode PNG base64

**authenticate**
- Entrée : `{ username, password, otp }` · Sortie : `200` ou `401/403/404`
- Vérification bcrypt + pyotp + ancienneté 6 mois
- Lockout 5 tentatives / 5 minutes

*Visuel : 3 blocs avec entrée/sortie*

---

## SLIDE 9 — Sécurité & qualité (1 min 30)

**Titre :** Ce qu'on a fait au-delà du minimum

| Amélioration | Impact |
|---|---|
| CORS headers sur toutes les fonctions | Évite les requêtes bloquées navigateur |
| Validation username côté serveur ET client | Double protection injection |
| Vérification MFA null (setup incomplet) | Empêche connexion sans 2FA configurée |
| 41 tests unitaires (pytest) | Régression impossible en déploiement |
| Script `test_cluster.sh` | Vérification infra en 1 commande |

---

## SLIDE 10 — Difficultés & solutions (1 min)

**Titre :** Les vraies galères (et comment on s'en est sortis)

| Problème | Solution |
|---|---|
| Build ARM64→AMD64 : 8h via QEMU | Build natif AMD64 sur VM de production |
| Imports Python échouent (tirets dans noms de dossiers) | Import absolu + pytest depuis le dossier |
| faas-cli deploy refuse 127.0.0.1:8080 | Gateway via Cloudflare Tunnel en HTTPS |
| Nœud worker K3s tombe au reboot | Reconfiguration systemd K3s |

*Ton : décomplexé, on montre qu'on a résolu les problèmes*

---

## SLIDE 11 — Ce qu'on ferait en production réelle (30s)

**Titre :** Limites du PoC & pistes d'évolution

- Connection pooling PostgreSQL (pgBouncer)
- Scale to Zero OpenFaaS Enterprise (pas Community)
- Rate limiting sur l'API Gateway
- Monitoring Prometheus + Grafana (déjà installé, non configuré)
- Backup PostgreSQL automatisé

---

## SLIDE 12 — Conclusion (30s)

**Titre :** En résumé

✅ Cluster K3s 2 nœuds sur Proxmox opérationnel  
✅ 3 fonctions serverless déployées et testées (41 tests)  
✅ Frontend React accessible et responsive  
✅ Exposition HTTPS via Cloudflare  
✅ Sécurité : bcrypt + TOTP + expiration + lockout  
✅ Gestion de projet : Gantt + Kanban + mesures inclusivité  

**Live :** https://cofrap.webeclosion.dev

---

## SLIDE 13 — Questions

**Titre :** Merci — Questions ?

*Visuel : QR code vers cofrap.webeclosion.dev*

Équipe : Julie · Paul · Yassin · Mathieu

---

## Conseils pour la soutenance (30 min questions)

**Questions probables du jury :**

- *"Pourquoi K3s plutôt que Minikube ?"*  
  → Vrai cluster 2 nœuds, plus proche production. Minikube = 1 nœud simulé.

- *"Comment gérez-vous les secrets de la BDD dans OpenFaaS ?"*  
  → Kubernetes Secrets + montage dans la fonction via env vars.

- *"Que se passe-t-il si le cluster redémarre ?"*  
  → K3s démarre via systemd, Cloudflare se reconnecte auto. Les pods restartent.

- *"Pourquoi Python et pas Node.js ?"*  
  → Recommandé dans le sujet, librairies `bcrypt`/`pyotp`/`qrcode` très stables.

- *"Comment adapteriez-vous pour une personne malvoyante dans l'équipe ?"*  
  → Pair programming oral, revues vocalisées, docs Markdown structuré, lecteur d'écran compatible.

- *"Qu'est-ce que TOTP ?"*  
  → Time-based One-Time Password : code à 6 chiffres valable 30s, généré depuis un secret partagé (RFC 6238). Même algo que Google Authenticator.

- *"Scale to Zero, c'est quoi ?"*  
  → Quand personne n'appelle la fonction, le pod est détruit. Au premier appel, il se recrée. Économie de ressources. OpenFaaS Community le simule, Enterprise le fait en natif.
