# Améliorations apportées au projet COFRAP

Document justificatif — MSPR TPRE921  
Équipe : Julie · Paul · Yassin · Mathieu

---

## Contexte

Suite à la livraison de la version initiale, trois axes d'amélioration ont été identifiés lors de la revue du code source des fonctions OpenFaaS. Chaque amélioration répond à un risque concret : sécuritaire, fonctionnel, ou de robustesse. Les modifications ont été appliquées sur les trois fonctions (`generate-password`, `generate-2fa`, `authenticate`) et couvertes par des tests unitaires.

---

## 1. En-têtes CORS sur toutes les réponses

### Problème identifié

Le frontend est déployé sur `cofrap.webeclosion.dev` et la gateway OpenFaaS sur `openfaas.webeclosion.dev`. Ces deux origines étant différentes, le navigateur envoie une requête **preflight OPTIONS** avant chaque appel `POST` avec `Content-Type: application/json`. Sans gestion explicite de CORS au niveau des fonctions, cette requête peut être rejetée par le navigateur, rendant l'application inutilisable pour certains clients ou configurations de proxy.

### Solution retenue

Ajout d'un dictionnaire `CORS_HEADERS` partagé dans chaque fonction :

```python
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}
```

Toutes les réponses incluent désormais ce dictionnaire via la clé `"headers"`. Les requêtes `OPTIONS` (preflight) reçoivent une réponse `200` immédiate sans accéder à la base de données.

### Justification du choix `Allow-Origin: *`

La plateforme COFRAP est un système d'authentification exposé publiquement. Les fonctions ne retournent pas de cookies ni de credentials sensibles dans les réponses (seul un QR code en base64 ou un message de confirmation). L'utilisation de `*` est donc appropriée ici. Dans un contexte de production multi-tenant, on remplacerait `*` par l'origine exacte du frontend.

### Impact

| Avant | Après |
|-------|-------|
| Requêtes bloquées si Cloudflare/gateway ne gère pas CORS | Fonctions autonomes, indépendantes de la configuration réseau |
| Pas de réponse aux preflight OPTIONS | OPTIONS retourne 200 sans appel DB |

---

## 2. Validation du format du nom d'utilisateur

### Problème identifié

La version initiale acceptait n'importe quelle chaîne comme `username`, y compris :
- Des chaînes vides ou d'un seul caractère
- Des chaînes de plusieurs centaines de caractères
- Des caractères spéciaux (espaces, `@`, guillemets, caractères SQL)

Sans validation, un username mal formé peut :
- Provoquer des erreurs inattendues en base de données
- Constituer un vecteur d'injection si la requête SQL était mal paramétrée (défense en profondeur)
- Générer des QR codes illisibles ou invalides

### Solution retenue

Ajout d'une expression régulière appliquée avant tout accès à la base de données, dans `generate-password` et `generate-2fa` :

```python
USERNAME_RE = re.compile(r'^[a-zA-Z0-9_-]{3,32}$')
```

Règles imposées :
- **Longueur** : entre 3 et 32 caractères
- **Caractères autorisés** : lettres (majuscules et minuscules), chiffres, tiret bas `_`, tiret `-`
- **Caractères interdits** : espaces, `@`, `<`, `>`, guillemets, et tout caractère spécial

En cas de non-conformité, la fonction retourne immédiatement un `400 Bad Request` avec un message explicite, sans toucher à la base de données.

### Justification du choix de la regex

Le format `[a-zA-Z0-9_-]{3,32}` est le standard de facto pour les identifiants utilisateur (GitHub, GitLab, Slack). Il est suffisamment permissif pour les usages réels tout en éliminant les entrées pathologiques. La limite à 32 caractères prévient les attaques par saturation de la colonne `VARCHAR`.

### Impact

| Avant | Après |
|-------|-------|
| Tout username accepté, même `" OR 1=1 --"` | Seuls les usernames conformes atteignent la DB |
| Erreur 500 si username vide après décoration DB | Erreur 400 explicite côté client |
| Pas de retour d'information clair sur le format attendu | Message d'erreur précis retourné |

---

## 3. Détection d'un compte à inscription incomplète

### Problème identifié

Le flux d'inscription est en deux étapes :
1. `generate-password` → crée l'utilisateur en base avec `mfa = NULL`
2. `generate-2fa` → remplit la colonne `mfa` avec le secret TOTP

Si la deuxième étape échoue (réseau, erreur frontend, utilisateur qui ferme la page), l'utilisateur existe en base **avec un mot de passe mais sans secret TOTP**. Dans ce cas, la fonction `authenticate` tentait d'appeler `pyotp.TOTP(None)`, ce qui provoque une **exception Python non catchée** et retourne une erreur `500` au client — un message d'erreur interne exposé sans contexte.

### Scénario reproductible

```
1. L'utilisateur lance generate-password → OK, compte créé (mfa=NULL)
2. generate-2fa échoue (timeout réseau, serveur redémarré, etc.)
3. L'utilisateur tente de se connecter avec authenticate
4. → pyotp.TOTP(None) → TypeError → 500 "str expected, not NoneType"
```

### Solution retenue

Ajout d'une vérification explicite de `mfa_secret` dans `authenticate`, après la récupération de l'utilisateur et avant les vérifications d'authentification :

```python
if not mfa_secret:
    conn.close()
    return {
        "statusCode": 403,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "error": "account_setup_incomplete",
            "message": "2FA setup not completed. Please register again.",
            "action": "renew"
        })
    }
```

La réponse inclut `"action": "renew"` qui déclenche la redirection automatique vers la page Register côté frontend — comportement déjà implémenté pour la gestion de l'expiration des credentials.

### Pourquoi ne pas corriger côté frontend uniquement ?

La validation côté client peut être contournée. Une API doit être robuste indépendamment du frontend qui l'appelle. De plus, ce cas peut survenir par des appels directs à l'API (scripts, tests, outils tiers).

### Impact

| Avant | Après |
|-------|-------|
| `pyotp.TOTP(None)` → `500` avec trace Python exposée | `403` avec message explicite et `action: "renew"` |
| Compte bloqué indéfiniment, aucun chemin de récupération | Redirection automatique vers re-inscription |

---

## Synthèse des modifications

| Fichier modifié | Amélioration |
|----------------|--------------|
| `generate-password/handler.py` | CORS + validation username |
| `generate-2fa/handler.py` | CORS + validation username |
| `authenticate/handler.py` | CORS + détection mfa=NULL |
| `generate-password/handler_test.py` | +6 nouveaux tests (CORS, validation) |
| `generate-2fa/handler_test.py` | +3 nouveaux tests (CORS, validation) |
| `authenticate/handler_test.py` | +3 nouveaux tests (CORS, mfa=NULL) |

**Total tests : 41 (29 initiaux + 12 nouveaux), tous passants.**

---

## Ce qui n'a pas été implémenté et pourquoi

### Pooling de connexions PostgreSQL

Un pool de connexions (`psycopg2.pool.ThreadedConnectionPool`) aurait réduit la latence en réutilisant les connexions entre les invocations de fonctions. Ce choix n'a pas été retenu pour deux raisons :

1. **Contexte serverless** : OpenFaaS peut scaler les fonctions à zéro et recréer les pods à la demande. Un pool de connexions module-level serait détruit à chaque restart de pod, sans apport réel à l'échelle de ce projet.
2. **Charge attendue** : La plateforme COFRAP est un PoC, non un système de production haute charge. La latence d'établissement de connexion PostgreSQL (~5 ms sur réseau local K8s) est négligeable.

Cette amélioration serait pertinente si le projet évoluait vers un système avec des centaines de requêtes simultanées.
