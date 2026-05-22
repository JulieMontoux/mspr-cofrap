# MSPR COFRAP — Système de gestion des comptes utilisateurs Serverless

Projet MSPR EPSI — Bloc 2 RNCP35584  
Déploiement d'un système d'authentification sécurisé via OpenFaaS sur Kubernetes.

---

## Sommaire

1. [Présentation du projet](#présentation-du-projet)
2. [Architecture technique](#architecture-technique)
3. [Prérequis](#prérequis)
4. [Installation — Mac (Apple Silicon ARM64)](#installation--mac-apple-silicon-arm64)
5. [Installation — Windows (AMD64)](#installation--windows-amd64)
6. [Configuration commune de la VM](#configuration-commune-de-la-vm)
7. [Lancement du script d'installation](#lancement-du-script-dinstallation)
8. [Réutilisation de l’environnement OpenFaaS](#réutilisation-de-lenvironnement-openfaas)
9. [Structure du projet](#structure-du-projet)

---

## Présentation du projet

La COFRAP souhaite sécuriser la création de comptes utilisateurs sur son infrastructure cloud.  
Le système génère automatiquement des mots de passe forts (24 caractères) et force l'activation de la 2FA (TOTP), le tout déployé en **serverless via OpenFaaS sur Kubernetes**.

### Fonctions OpenFaaS développées

- **generate-password** : génère un mot de passe sécurisé de 24 caractères et son QR code
- **generate-2fa** : génère un secret TOTP et son QR code
- **authenticate** : authentifie un utilisateur (login + password + code 2FA) avec vérification de l'ancienneté des credentials (6 mois max)

---

## Architecture technique

```
Frontend (ReactJs)
      ↕
OpenFaaS (Kubernetes K3s / Proxmox)
      ↕
PostgreSQL (base de données)
```

| Composant       | Technologie             |
|-----------------|-------------------------|
| Fonctions       | Python 3                |
| Orchestration   | Kubernetes K3s          |
| Serverless      | OpenFaaS Community      |
| Base de données | PostgreSQL              |
| Frontend        | ReactJs                 |
| Hyperviseur     | Proxmox                 |
| Exposition      | Cloudflare Tunnel       |
| Package manager | Helm                    |
| Registry        | Docker Hub              |

---

## Prérequis

### Mac (Apple Silicon M1/M2/M3)
- [UTM](https://mac.getutm.app/) installé
- Image ISO Ubuntu 24.04.4 LTS ARM64 téléchargée depuis [ubuntu.com/download/server/arm](https://ubuntu.com/download/server/arm)

### Windows (AMD64)
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads) installé
- Image ISO Ubuntu 24.04.4 LTS AMD64 téléchargée depuis [releases.ubuntu.com/noble](https://releases.ubuntu.com/noble/ubuntu-24.04.4-live-server-amd64.iso)

---

## Installation — Mac (Apple Silicon ARM64)

### 1. Créer la VM dans UTM

1. Ouvrir UTM → **Nouvelle machine virtuelle**
2. Choisir **Virtualiser**
3. Sélectionner **Linux**
4. Désactiver **Use Apple Virtualization** (laisser QEMU)
5. Sélectionner **Boot from ISO image** → choisir l'ISO Ubuntu ARM64
6. Configurer les ressources :
   - **CPU** : 2 cœurs
   - **RAM** : 4 Go
   - **Disque** : 30 Go
7. Dossier partagé : laisser vide
8. Nommer la VM **mspr-cofrap**
9. Dans les settings → **Réseau** → passer en mode **Pont (Bridge)** sur `en0` (WiFi)

### 2. Installer Ubuntu

1. Démarrer la VM
2. Sélectionner **Try or Install Ubuntu Server** → Entrée
3. Langue du clavier : **French — French (Macintosh)**
4. Type d'installation : **Ubuntu Server** (par défaut)
5. Réseau : laisser par défaut (DHCP automatique) → **noter l'IP affichée**
6. Proxy : laisser vide
7. Miroir : laisser par défaut
8. Stockage : **Utiliser un disque entier** + **LVM** (par défaut)
9. Confirmer le partitionnement
10. Profil :
    - **Votre nom** : `prenom`
    - **Server name** : `mspr-cofrap`
    - **Username** : `prenom` (minuscules, sans accents)
    - **Mot de passe** : choisir et **noter soigneusement**
11. Ubuntu Pro : **Skip for now**
12. SSH : **cocher "Installer le serveur OpenSSH"** + autoriser authentification par mot de passe
13. Snaps : ne rien cocher
14. Attendre la fin de l'installation → **Redémarrer maintenant**

### 3. Se connecter en SSH depuis le terminal Mac

```bash
ssh prenom@192.168.1.XX
```
> Remplacer `192.168.1.XX` par l'IP notée lors de l'installation.  
> En cas de doute, se connecter dans la console UTM et taper `ip a`.

---

## Installation — Windows (AMD64)

### 1. Créer la VM dans VirtualBox

1. Ouvrir VirtualBox → **Nouvelle**
2. Configurer :
   - **Nom** : `mspr-cofrap`
   - **Type** : Linux
   - **Version** : Ubuntu (64-bit)
3. Ressources :
   - **RAM** : 4096 Mo (4 Go)
   - **CPU** : 2
   - **Disque** : 30 Go (VDI, dynamique)
4. Réseau → **Carte 1** → passer en mode **Accès par pont**
5. Stockage → Contrôleur IDE → monter l'ISO Ubuntu AMD64

### 2. Installer Ubuntu

Suivre exactement les mêmes étapes que pour Mac à partir de l'étape **2. Installer Ubuntu** ci-dessus.

> ⚠️ Pour le clavier, choisir **French — French (AZERTY)** à la place de Macintosh.

### 3. Se connecter en SSH depuis PowerShell

```powershell
ssh prenom@192.168.1.XX
```

---

## Configuration commune de la VM

Une fois connecté en SSH, vérifier que tout fonctionne :

```bash
# Vérifier la connexion internet
ping -c 3 google.com

# Vérifier l'IP de la VM
ip a
```

---

## Lancement du script d'installation

Le script `setup/setup.sh` installe automatiquement les outils pour un **environnement de développement local** :
**Docker → Minikube → kubectl → Helm → faas-cli**

Il détecte automatiquement l'architecture (ARM64 ou AMD64), le même script fonctionne pour tout le monde.

> **Note :** le déploiement de production tourne sur un cluster **K3s sur Proxmox** avec Cloudflare Tunnel.  
> La VM de démonstration est déjà configurée — voir la section [Réutilisation de l'environnement OpenFaaS](#réutilisation-de-lenvironnement-openfaas).

```bash
# Cloner le repo
git clone https://github.com/JulieMontoux/mspr-cofrap.git
cd mspr-cofrap

# Rendre le script exécutable
chmod +x setup/setup.sh

# Lancer l'installation
./setup/setup.sh
```

> ⚠️ À la fin du script, **fermer et rouvrir la session SSH** pour que les droits Docker soient pris en compte.

### Démarrer Minikube

```bash
minikube start --driver=docker
```

### Vérifier que tout fonctionne

```bash
kubectl get nodes
helm version
faas-cli version
```

---

## Réutilisation de l’environnement OpenFaaS

⚠️ Cette VM contient déjà :

* OpenFaaS installé
* PostgreSQL déployé
* Secrets configurés
* Table `users` créée
* Fonctions déployées

Il n’est **pas nécessaire de réinstaller OpenFaaS ou PostgreSQL**.

---

## 🔄 Après un redémarrage de la VM (production K3s)

K3s démarre automatiquement via systemd. Vérifier que les pods sont opérationnels :

```bash
kubectl get pods -n openfaas
kubectl get pods -n openfaas-fn
```

Attendre que tous les pods soient `Running`. Le tunnel Cloudflare se reconnecte automatiquement.

---

## 🌐 Accéder à l’interface OpenFaaS

**En production (Cloudflare Tunnel) :**

- Frontend : `https://cofrap.webeclosion.dev`
- Gateway OpenFaaS : `https://openfaas.webeclosion.dev`

**En local (port-forward) :**

```bash
kubectl port-forward --address 0.0.0.0 svc/gateway -n openfaas 8080:8080
```

Connexion :

* utilisateur : `admin`
* mot de passe :

```bash
echo $(kubectl -n openfaas get secret basic-auth \
-o jsonpath="{.data.basic-auth-password}" | base64 --decode)
```

---

## 🧩 Redéployer les fonctions (si besoin)

Depuis le dossier `functions/` :

```bash
faas-cli login \
  --username admin \
  --password VOTRE_MOT_DE_PASSE \
  --gateway http://127.0.0.1:8080

faas-cli deploy
```

⚠️ Inutile de refaire `helm install` ou recréer la base de données.

---

## Structure du projet

```
mspr-cofrap/
├── README.md
├── AMELIORATIONS.md          # Justification des améliorations sécurité
├── .gitignore
│
├── docs/
│   ├── MANAGEMENT.md         # Gestion de projet, Gantt, inclusivité, difficultés
│   ├── PRESENTATION.md       # Plan des slides pour la soutenance (20 min)
│   ├── gantt.png             # Diagramme de Gantt généré
│   └── generate_gantt.py     # Script de génération du Gantt
│
├── setup/
│   └── setup.sh              # Script d'installation Linux (ARM64 + AMD64)
│
├── functions/
│   ├── generate-password/    # Génération mot de passe + QR code
│   ├── generate-2fa/         # Génération secret TOTP + QR code
│   └── authenticate/         # Authentification utilisateur
│
├── frontend/                 # Interface de démonstration (React + Vite + Tailwind)
│
├── tests/
│   └── test_cluster.sh       # Script de tests d'intégration du cluster
│
└── k8s/                      # Manifests Kubernetes
    ├── database/             # Déploiement PostgreSQL (StatefulSet)
    └── openfaas/             # Configuration OpenFaaS
```

---

## Contributeurs

| Nom | Rôle |
|-----|------|
| Julie | Développeuse — Mac ARM64 |
| Paul | Développeur — Mac ARM64 |
| Yassin | Développeur — Windows AMD64 |
| Mathieu | Développeur — Windows AMD64 |

---

*Projet réalisé dans le cadre de la certification RNCP35584 — Expert en Informatique et Système d'Information*
