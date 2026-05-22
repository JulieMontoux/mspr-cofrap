#!/usr/bin/env bash
# =============================================================================
#  test_cluster.sh — Script de tests d'intégration du cluster COFRAP
# =============================================================================
#
#  Objectif : vérifier l'état complet de la plateforme COFRAP déployée sur
#             K3s / Proxmox, depuis les pods Kubernetes jusqu'aux endpoints
#             HTTP exposés via Cloudflare Tunnel.
#
#  Usage :
#    chmod +x tests/test_cluster.sh
#    ./tests/test_cluster.sh
#
#  Prérequis :
#    - kubectl configuré avec accès au cluster (KUBECONFIG)
#    - curl installé
#    - python3 installé (pour décoder le TOTP dans le test authenticate)
#    - jq installé (pour parser les réponses JSON)
#
#  Résultats :
#    Chaque test affiche OK (vert) ou KO (rouge).
#    Un récapitulatif final indique le nombre de tests passés / échoués.
#    Code de sortie : 0 si tout passe, 1 si au moins un échec.
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Couleurs ANSI
# ---------------------------------------------------------------------------
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

# ---------------------------------------------------------------------------
# URLs — modifier si le domaine change
# ---------------------------------------------------------------------------
FRONTEND_URL="https://cofrap.webeclosion.dev"
GATEWAY_URL="https://openfaas.webeclosion.dev"

# Namespace OpenFaaS et namespace applicatif
OPENFAAS_NS="openfaas"
OPENFAAS_FN_NS="openfaas-fn"

# ---------------------------------------------------------------------------
# Compteurs globaux
# ---------------------------------------------------------------------------
PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Fonctions utilitaires
# ---------------------------------------------------------------------------

# Affiche un séparateur de section
section() {
    echo ""
    echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}"
    echo -e "${CYAN}${BOLD}  $1${RESET}"
    echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}"
}

# Enregistre un test réussi
pass() {
    local label="$1"
    echo -e "  ${GREEN}✔  ${label}${RESET}"
    PASS=$((PASS + 1))
}

# Enregistre un test échoué (ne stoppe pas le script)
fail() {
    local label="$1"
    local detail="${2:-}"
    echo -e "  ${RED}✘  ${label}${RESET}"
    [ -n "$detail" ] && echo -e "     ${RED}↳ ${detail}${RESET}"
    FAIL=$((FAIL + 1))
}

# Avertissement (non bloquant, ne compte pas dans les échecs)
warn() {
    echo -e "  ${YELLOW}⚠  $1${RESET}"
}

# Vérifie qu'un outil est disponible
require() {
    if ! command -v "$1" &>/dev/null; then
        warn "$1 non trouvé — certains tests seront ignorés"
        return 1
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Détection des outils disponibles
# ---------------------------------------------------------------------------
HAS_KUBECTL=false
HAS_JQ=false
HAS_PYTHON3=false

require kubectl  && HAS_KUBECTL=true  || true
require jq       && HAS_JQ=true       || true
require python3  && HAS_PYTHON3=true  || true

# =============================================================================
# SECTION 1 — ÉTAT DES PODS KUBERNETES
# =============================================================================
section "1 / Pods Kubernetes"

if $HAS_KUBECTL; then

    # --- 1.1 Pods OpenFaaS (gateway, nats, prometheus, alertmanager, etc.) ---
    # On s'assure que tous les pods du namespace openfaas sont Running ou Completed.
    echo -e "\n  ${BOLD}Namespace : $OPENFAAS_NS${RESET}"
    not_running=$(kubectl get pods -n "$OPENFAAS_NS" \
        --field-selector='status.phase!=Running,status.phase!=Succeeded' \
        --no-headers 2>/dev/null | wc -l | tr -d ' ')

    if [ "$not_running" -eq 0 ]; then
        pass "Tous les pods openfaas sont Running/Succeeded"
    else
        fail "Pods non Running dans $OPENFAAS_NS" \
            "$(kubectl get pods -n "$OPENFAAS_NS" --no-headers 2>/dev/null | grep -v 'Running\|Completed' || true)"
    fi

    # --- 1.2 Pods fonctions OpenFaaS ---
    echo -e "\n  ${BOLD}Namespace : $OPENFAAS_FN_NS${RESET}"
    fn_pods=$(kubectl get pods -n "$OPENFAAS_FN_NS" --no-headers 2>/dev/null | wc -l | tr -d ' ')

    if [ "$fn_pods" -gt 0 ]; then
        not_running_fn=$(kubectl get pods -n "$OPENFAAS_FN_NS" \
            --field-selector='status.phase!=Running,status.phase!=Succeeded' \
            --no-headers 2>/dev/null | wc -l | tr -d ' ')

        if [ "$not_running_fn" -eq 0 ]; then
            pass "Toutes les fonctions ($fn_pods pods) sont Running"
        else
            fail "Fonctions non Running dans $OPENFAAS_FN_NS" \
                "$(kubectl get pods -n "$OPENFAAS_FN_NS" --no-headers 2>/dev/null | grep -v 'Running\|Completed' || true)"
        fi
    else
        warn "Aucun pod trouvé dans $OPENFAAS_FN_NS — fonctions peut-être non déployées"
    fi

    # --- 1.3 Pod PostgreSQL ---
    echo -e "\n  ${BOLD}Base de données${RESET}"
    db_pod=$(kubectl get pods -n default -l app.kubernetes.io/name=postgresql \
        --no-headers 2>/dev/null | head -1 | awk '{print $1}' || true)

    if [ -n "$db_pod" ]; then
        db_status=$(kubectl get pod "$db_pod" -n default \
            --no-headers 2>/dev/null | awk '{print $3}' || true)
        if [ "$db_status" = "Running" ]; then
            pass "PostgreSQL pod $db_pod → Running"
        else
            fail "PostgreSQL pod $db_pod → $db_status"
        fi
    else
        # Essayer d'autres labels courants
        db_pod=$(kubectl get pods -n default --no-headers 2>/dev/null \
            | grep -i "postgres\|postgresql" | head -1 | awk '{print $1}' || true)
        if [ -n "$db_pod" ]; then
            db_status=$(kubectl get pod "$db_pod" -n default --no-headers 2>/dev/null | awk '{print $3}' || true)
            if [ "$db_status" = "Running" ]; then
                pass "PostgreSQL pod $db_pod → Running"
            else
                fail "PostgreSQL pod $db_pod → $db_status"
            fi
        else
            warn "Pod PostgreSQL non trouvé (namespace default)"
        fi
    fi

    # --- 1.4 Pod frontend Nginx ---
    echo -e "\n  ${BOLD}Frontend${RESET}"
    fe_pod=$(kubectl get pods -n default --no-headers 2>/dev/null \
        | grep -i "cofrap\|frontend\|nginx" | head -1 | awk '{print $1}' || true)

    if [ -n "$fe_pod" ]; then
        fe_status=$(kubectl get pod "$fe_pod" -n default --no-headers 2>/dev/null | awk '{print $3}' || true)
        if [ "$fe_status" = "Running" ]; then
            pass "Frontend pod $fe_pod → Running"
        else
            fail "Frontend pod $fe_pod → $fe_status"
        fi
    else
        warn "Pod frontend non trouvé (namespace default)"
    fi

else
    warn "kubectl indisponible — tests pods ignorés"
fi

# =============================================================================
# SECTION 2 — CONNECTIVITÉ HTTP (Cloudflare Tunnel)
# =============================================================================
section "2 / Connectivité HTTP via Cloudflare"

# --- 2.1 Frontend COFRAP ---
# Le frontend doit répondre avec un HTTP 200 et contenir du HTML.
http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 "$FRONTEND_URL" 2>/dev/null || echo "000")

if [ "$http_code" = "200" ]; then
    pass "Frontend $FRONTEND_URL → HTTP $http_code"
else
    fail "Frontend $FRONTEND_URL → HTTP $http_code (attendu 200)"
fi

# --- 2.2 Contenu HTML du frontend ---
# On vérifie que la page contient bien la balise <title> de COFRAP.
html_title=$(curl -s --max-time 10 "$FRONTEND_URL" 2>/dev/null \
    | grep -o '<title>[^<]*</title>' | head -1 || true)

if echo "$html_title" | grep -qi "cofrap"; then
    pass "Titre HTML contient COFRAP : $html_title"
else
    fail "Titre HTML inattendu : ${html_title:-vide}"
fi

# --- 2.3 OpenFaaS Gateway healthz ---
# L'endpoint /healthz de la gateway doit retourner 200.
gw_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 "${GATEWAY_URL}/healthz" 2>/dev/null || echo "000")

if [ "$gw_code" = "200" ]; then
    pass "Gateway ${GATEWAY_URL}/healthz → HTTP $gw_code"
else
    fail "Gateway ${GATEWAY_URL}/healthz → HTTP $gw_code (attendu 200)"
fi

# --- 2.4 OpenFaaS UI (optionnel) ---
gw_ui_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 "${GATEWAY_URL}/ui/" 2>/dev/null || echo "000")

if [ "$gw_ui_code" = "200" ] || [ "$gw_ui_code" = "301" ] || [ "$gw_ui_code" = "302" ]; then
    pass "OpenFaaS UI ${GATEWAY_URL}/ui/ → HTTP $gw_ui_code"
else
    warn "OpenFaaS UI → HTTP $gw_ui_code (peut nécessiter auth basic)"
fi

# =============================================================================
# SECTION 3 — FONCTION generate-password
# =============================================================================
section "3 / Fonction generate-password"

FN_GEN_PASS="${GATEWAY_URL}/function/generate-password"

# --- 3.1 Appel valide : doit retourner 200 + JSON avec generated_password ---
if $HAS_JQ; then
    GEN_RESPONSE=$(curl -s --max-time 15 \
        -X POST "$FN_GEN_PASS" \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser01"}' 2>/dev/null || echo "{}")

    http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
        -X POST "$FN_GEN_PASS" \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser01"}' 2>/dev/null || echo "000")

    if [ "$http_status" = "200" ] || [ "$http_status" = "400" ]; then
        # 400 est acceptable si l'user existe déjà ("already exists")
        gen_pwd=$(echo "$GEN_RESPONSE" | jq -r '.generated_password // empty' 2>/dev/null || true)
        already_exists=$(echo "$GEN_RESPONSE" | jq -r '.error // empty' 2>/dev/null | grep -c "already exists" || true)

        if [ -n "$gen_pwd" ]; then
            pass "generate-password retourne un mot de passe (longueur: ${#gen_pwd})"
            # On sauvegarde le mot de passe pour authenticate
            GENERATED_PASSWORD="$gen_pwd"
        elif [ "$already_exists" -gt 0 ]; then
            pass "generate-password → utilisateur déjà existant (comportement attendu)"
            GENERATED_PASSWORD=""
        else
            fail "generate-password → réponse inattendue" "$GEN_RESPONSE"
            GENERATED_PASSWORD=""
        fi
    else
        fail "generate-password → HTTP $http_status" "$GEN_RESPONSE"
        GENERATED_PASSWORD=""
    fi

    # --- 3.2 Validation : username trop court doit retourner 400 ---
    short_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$FN_GEN_PASS" \
        -H "Content-Type: application/json" \
        -d '{"username":"ab"}' 2>/dev/null || echo "000")

    if [ "$short_code" = "400" ]; then
        pass "generate-password rejette username < 3 chars → HTTP 400"
    else
        fail "generate-password devrait rejeter 'ab' → HTTP $short_code (attendu 400)"
    fi

    # --- 3.3 Validation : username manquant doit retourner 400 ---
    empty_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$FN_GEN_PASS" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "000")

    if [ "$empty_code" = "400" ]; then
        pass "generate-password rejette username manquant → HTTP 400"
    else
        fail "generate-password devrait rejeter {} → HTTP $empty_code (attendu 400)"
    fi

    # --- 3.4 CORS : preflight OPTIONS doit retourner 200 ---
    cors_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X OPTIONS "$FN_GEN_PASS" 2>/dev/null || echo "000")

    if [ "$cors_code" = "200" ]; then
        pass "generate-password OPTIONS → HTTP 200 (CORS preflight OK)"
    else
        fail "generate-password OPTIONS → HTTP $cors_code (attendu 200)"
    fi

    # --- 3.5 QR code base64 présent dans la réponse ---
    qr=$(echo "$GEN_RESPONSE" | jq -r '.qr_code_base64 // empty' 2>/dev/null || true)
    if [ -n "$qr" ]; then
        pass "generate-password retourne un QR code base64"
    else
        warn "generate-password : qr_code_base64 absent (peut-être user existant)"
    fi

else
    warn "jq non disponible — tests generate-password ignorés"
    GENERATED_PASSWORD=""
fi

# =============================================================================
# SECTION 4 — FONCTION generate-2fa
# =============================================================================
section "4 / Fonction generate-2fa"

FN_GEN_2FA="${GATEWAY_URL}/function/generate-2fa"

if $HAS_JQ; then

    # --- 4.1 Appel valide ---
    mfa_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
        -X POST "$FN_GEN_2FA" \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser01"}' 2>/dev/null || echo "000")

    # 200 si MFA configuré, 400 si user déjà a un secret 2FA ou autre erreur
    if [ "$mfa_code" = "200" ] || [ "$mfa_code" = "400" ]; then
        pass "generate-2fa répond → HTTP $mfa_code"
    else
        fail "generate-2fa → HTTP $mfa_code (attendu 200 ou 400)"
    fi

    # --- 4.2 Validation : username manquant doit retourner 400 ---
    mfa_empty=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$FN_GEN_2FA" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "000")

    if [ "$mfa_empty" = "400" ]; then
        pass "generate-2fa rejette username manquant → HTTP 400"
    else
        fail "generate-2fa devrait rejeter {} → HTTP $mfa_empty (attendu 400)"
    fi

    # --- 4.3 CORS preflight ---
    mfa_cors=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X OPTIONS "$FN_GEN_2FA" 2>/dev/null || echo "000")

    if [ "$mfa_cors" = "200" ]; then
        pass "generate-2fa OPTIONS → HTTP 200 (CORS preflight OK)"
    else
        fail "generate-2fa OPTIONS → HTTP $mfa_cors (attendu 200)"
    fi

else
    warn "jq non disponible — tests generate-2fa ignorés"
fi

# =============================================================================
# SECTION 5 — FONCTION authenticate
# =============================================================================
section "5 / Fonction authenticate"

FN_AUTH="${GATEWAY_URL}/function/authenticate"

if $HAS_JQ; then

    # --- 5.1 Credentials manquants → 400 ---
    auth_empty=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$FN_AUTH" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "000")

    if [ "$auth_empty" = "400" ]; then
        pass "authenticate rejette payload vide → HTTP 400"
    else
        fail "authenticate devrait rejeter {} → HTTP $auth_empty (attendu 400)"
    fi

    # --- 5.2 Utilisateur inexistant → 404 ---
    auth_unknown=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$FN_AUTH" \
        -H "Content-Type: application/json" \
        -d '{"username":"utilisateur_inexistant_xyz","password":"pwd","otp":"000000"}' \
        2>/dev/null || echo "000")

    if [ "$auth_unknown" = "404" ]; then
        pass "authenticate → utilisateur inconnu retourne HTTP 404"
    else
        fail "authenticate → utilisateur inconnu retourne HTTP $auth_unknown (attendu 404)"
    fi

    # --- 5.3 Mauvais mot de passe → 401 ---
    auth_bad_pwd=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X POST "$FN_AUTH" \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser01","password":"mauvais_mdp_xyz","otp":"000000"}' \
        2>/dev/null || echo "000")

    if [ "$auth_bad_pwd" = "401" ] || [ "$auth_bad_pwd" = "403" ]; then
        pass "authenticate → mauvais mot de passe retourne HTTP $auth_bad_pwd"
    else
        fail "authenticate → mauvais mot de passe retourne HTTP $auth_bad_pwd (attendu 401)"
    fi

    # --- 5.4 CORS preflight ---
    auth_cors=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
        -X OPTIONS "$FN_AUTH" 2>/dev/null || echo "000")

    if [ "$auth_cors" = "200" ]; then
        pass "authenticate OPTIONS → HTTP 200 (CORS preflight OK)"
    else
        fail "authenticate OPTIONS → HTTP $auth_cors (attendu 200)"
    fi

    # --- 5.5 En-têtes CORS présents dans la réponse POST ---
    cors_header=$(curl -s -D - --max-time 10 \
        -X POST "$FN_AUTH" \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser01","password":"any","otp":"000000"}' \
        2>/dev/null | grep -i "access-control-allow-origin" || true)

    if [ -n "$cors_header" ]; then
        pass "authenticate : en-tête CORS Access-Control-Allow-Origin présent"
    else
        warn "authenticate : en-tête CORS absent (vérifier la config)"
    fi

else
    warn "jq non disponible — tests authenticate ignorés"
fi

# =============================================================================
# SECTION 6 — AUTHENTIFICATION END-TO-END (si python3 + pyotp disponibles)
# =============================================================================
section "6 / Test end-to-end (inscription → connexion)"

# Ce test crée un nouvel utilisateur avec un nom unique horodaté,
# génère son mot de passe + 2FA, puis tente une authentification complète.
# Il nécessite python3 + pyotp pour calculer le code TOTP.

E2E_USER="e2etest_$(date +%s)"

if $HAS_PYTHON3 && $HAS_JQ && python3 -c "import pyotp" 2>/dev/null; then

    echo ""
    echo -e "  Utilisateur de test : ${BOLD}$E2E_USER${RESET}"

    # Étape 1 : générer mot de passe
    e2e_gen=$(curl -s --max-time 15 \
        -X POST "$FN_GEN_PASS" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$E2E_USER\"}" 2>/dev/null || echo "{}")

    e2e_pwd=$(echo "$e2e_gen" | jq -r '.generated_password // empty' 2>/dev/null || true)

    if [ -z "$e2e_pwd" ]; then
        fail "E2E : génération du mot de passe échouée" "$e2e_gen"
    else
        pass "E2E : mot de passe généré"

        # Étape 2 : générer 2FA et récupérer le secret TOTP
        e2e_mfa=$(curl -s --max-time 15 \
            -X POST "$FN_GEN_2FA" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$E2E_USER\"}" 2>/dev/null || echo "{}")

        # Le secret TOTP brut doit être exposé par l'API pour pouvoir calculer l'OTP.
        # Si l'API retourne uniquement le QR code base64, ce test est informatif seulement.
        e2e_secret=$(echo "$e2e_mfa" | jq -r '.secret // empty' 2>/dev/null || true)

        if [ -n "$e2e_secret" ]; then
            pass "E2E : secret TOTP récupéré"

            # Étape 3 : calculer le code TOTP actuel
            e2e_otp=$(python3 -c "import pyotp; print(pyotp.TOTP('$e2e_secret').now())" 2>/dev/null || true)

            if [ -n "$e2e_otp" ]; then
                pass "E2E : code TOTP calculé → $e2e_otp"

                # Étape 4 : s'authentifier
                e2e_auth=$(curl -s --max-time 15 \
                    -X POST "$FN_AUTH" \
                    -H "Content-Type: application/json" \
                    -d "{\"username\":\"$E2E_USER\",\"password\":\"$e2e_pwd\",\"otp\":\"$e2e_otp\"}" \
                    2>/dev/null || echo "{}")

                e2e_auth_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
                    -X POST "$FN_AUTH" \
                    -H "Content-Type: application/json" \
                    -d "{\"username\":\"$E2E_USER\",\"password\":\"$e2e_pwd\",\"otp\":\"$e2e_otp\"}" \
                    2>/dev/null || echo "000")

                if [ "$e2e_auth_code" = "200" ]; then
                    pass "E2E : authentification réussie → HTTP 200"
                else
                    fail "E2E : authentification → HTTP $e2e_auth_code" "$e2e_auth"
                fi
            else
                fail "E2E : calcul TOTP échoué"
            fi
        else
            warn "E2E : secret TOTP non exposé par l'API — test authenticate ignoré"
            warn "      (le QR code seul ne suffit pas pour calculer l'OTP en script)"
        fi
    fi

elif ! python3 -c "import pyotp" 2>/dev/null; then
    warn "pyotp non installé — test E2E ignoré (pip3 install pyotp)"
else
    warn "python3 ou jq manquant — test E2E ignoré"
fi

# =============================================================================
# SECTION 7 — ÉTAT DES INGRESS ET SERVICES
# =============================================================================
section "7 / Ingress et Services Kubernetes"

if $HAS_KUBECTL; then

    # --- 7.1 Ingress dans le namespace openfaas ---
    ingress_count=$(kubectl get ingress -n "$OPENFAAS_NS" --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [ "$ingress_count" -gt 0 ]; then
        pass "Ingress OpenFaaS : $ingress_count règle(s) trouvée(s)"
        # Affiche les hosts configurés
        kubectl get ingress -n "$OPENFAAS_NS" --no-headers 2>/dev/null | while read -r line; do
            echo -e "     ${CYAN}↳${RESET} $line"
        done
    else
        warn "Aucun Ingress dans le namespace $OPENFAAS_NS"
    fi

    # --- 7.2 Ingress dans le namespace default ---
    ingress_def=$(kubectl get ingress -n default --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [ "$ingress_def" -gt 0 ]; then
        pass "Ingress namespace default : $ingress_def règle(s)"
    else
        warn "Aucun Ingress dans le namespace default"
    fi

    # --- 7.3 Service gateway OpenFaaS ---
    gw_svc=$(kubectl get svc -n "$OPENFAAS_NS" gateway --no-headers 2>/dev/null | awk '{print $5}' || true)
    if [ -n "$gw_svc" ]; then
        pass "Service gateway OpenFaaS → ports : $gw_svc"
    else
        fail "Service gateway introuvable dans $OPENFAAS_NS"
    fi

else
    warn "kubectl indisponible — tests Ingress/Services ignorés"
fi

# =============================================================================
# RÉCAPITULATIF FINAL
# =============================================================================
TOTAL=$((PASS + FAIL))

echo ""
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}  RÉCAPITULATIF${RESET}"
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Tests passés  : ${GREEN}${BOLD}$PASS${RESET} / $TOTAL"
echo -e "  Tests échoués : ${RED}${BOLD}$FAIL${RESET} / $TOTAL"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}✔  Cluster COFRAP opérationnel — tous les tests passent.${RESET}"
    echo ""
    exit 0
else
    echo -e "  ${RED}${BOLD}✘  $FAIL test(s) en échec — vérifier les composants ci-dessus.${RESET}"
    echo ""
    exit 1
fi
