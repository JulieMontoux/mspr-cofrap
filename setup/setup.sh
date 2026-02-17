#!/bin/bash

# =============================================================
# MSPR COFRAP - Script d'installation de l'environnement
# Compatible : Ubuntu 24.04 LTS (ARM64 / AMD64)
# =============================================================

set -e  # Arrêt si une commande échoue

echo "================================================"
echo "  MSPR COFRAP - Installation de l'environnement"
echo "================================================"

# ------------------------------
# 1. Mise à jour du système
# ------------------------------
echo ""
echo "[1/6] Mise à jour du système..."
sudo apt update && sudo apt upgrade -y

# ------------------------------
# 2. Installation de Docker
# ------------------------------
echo ""
echo "[2/6] Installation de Docker..."

sudo apt install -y ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Ajouter l'utilisateur au groupe docker (évite de taper sudo à chaque fois)
sudo usermod -aG docker $USER

echo "Docker installé : $(docker --version)"

# ------------------------------
# 3. Installation de Minikube
# ------------------------------
echo ""
echo "[3/6] Installation de Minikube..."

ARCH=$(dpkg --print-architecture)

if [ "$ARCH" = "arm64" ]; then
    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-arm64
    sudo install minikube-linux-arm64 /usr/local/bin/minikube
    rm minikube-linux-arm64
else
    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
    sudo install minikube-linux-amd64 /usr/local/bin/minikube
    rm minikube-linux-amd64
fi

echo "Minikube installé : $(minikube version)"

# ------------------------------
# 4. Installation de kubectl
# ------------------------------
echo ""
echo "[4/6] Installation de kubectl..."

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${ARCH}/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

echo "kubectl installé : $(kubectl version --client)"

# ------------------------------
# 5. Installation de Helm
# ------------------------------
echo ""
echo "[5/6] Installation de Helm..."

curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

echo "Helm installé : $(helm version)"

# ------------------------------
# 6. Installation de faas-cli (OpenFaaS CLI)
# ------------------------------
echo ""
echo "[6/6] Installation de faas-cli..."

curl -sSL https://cli.openfaas.com | sudo sh

echo "faas-cli installé : $(faas-cli version)"

# ------------------------------
# Résumé
# ------------------------------
echo ""
echo "================================================"
echo "  Installation terminée avec succès !"
echo "================================================"
echo ""
echo "  Docker    : $(docker --version)"
echo "  Minikube  : $(minikube version --short)"
echo "  kubectl   : $(kubectl version --client --short 2>/dev/null)"
echo "  Helm      : $(helm version --short)"
echo "  faas-cli  : $(faas-cli version --short-version)"
echo ""
echo "  IMPORTANT : Ferme et rouvre ta session SSH pour"
echo "  que les droits Docker soient pris en compte."
echo ""
echo "  Ensuite lance : minikube start --driver=docker"
echo "================================================"
