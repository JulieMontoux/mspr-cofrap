#!/usr/bin/env python3
"""
Génère le diagramme de Gantt MSPR TPRE921 — COFRAP.
Sortie : docs/gantt.png
Usage   : python3 docs/generate_gantt.py
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ---------------------------------------------------------------------------
# Données du Gantt (semaine de début, durée en semaines, catégorie)
# Catégories : "infra", "dev", "livrable"
# ---------------------------------------------------------------------------
tasks = [
    # (label, acteur, semaine_debut, durée_semaines, catégorie)
    ("Analyse sujet & choix technos",     "Équipe",      1, 1, "livrable"),
    ("Installation Proxmox + VMs",        "Julie",        1, 2, "infra"),
    ("Installation K3s (2 nœuds)",        "Julie",        2, 1, "infra"),
    ("Déploiement OpenFaaS via Helm",     "Julie",        2, 2, "infra"),
    ("Déploiement PostgreSQL",            "Julie",        3, 1, "infra"),
    ("Développement generate-password",   "Paul",         2, 3, "dev"),
    ("Développement generate-2fa",        "Yassin",       2, 3, "dev"),
    ("Développement authenticate",        "Mathieu",      3, 3, "dev"),
    ("Développement frontend (React)",    "Paul / Julie", 4, 3, "dev"),
    ("Tests unitaires & intégration",     "Équipe",       5, 3, "dev"),
    ("Build Docker multi-arch",           "Julie",        6, 2, "infra"),
    ("Déploiement final + Cloudflare",    "Julie",        7, 1, "infra"),
    ("Rédaction dossier de rendu",        "Équipe",       6, 3, "livrable"),
    ("Préparation soutenance",            "Équipe",       7, 2, "livrable"),
]

COLORS = {
    "infra":    "#7C3AED",   # violet  — Infrastructure & cluster
    "dev":      "#0EA5E9",   # bleu    — Fonctions & base de données
    "livrable": "#10B981",   # vert    — Frontend, doc, livraison
}

WEEKS = 8

fig, ax = plt.subplots(figsize=(14, 7))
fig.patch.set_facecolor("#0F172A")
ax.set_facecolor("#1E293B")

n = len(tasks)
bar_height = 0.55

for i, (label, actor, start, duration, cat) in enumerate(tasks):
    y = n - i - 1
    color = COLORS[cat]
    # Barre principale
    ax.barh(y, duration, left=start - 1, height=bar_height,
            color=color, alpha=0.85, edgecolor="none")
    # Acteur à droite
    ax.text(start - 1 + duration + 0.08, y, actor,
            va="center", ha="left", fontsize=7.5,
            color="#94A3B8", fontfamily="monospace")

# Grille verticale semaines
for w in range(WEEKS + 1):
    ax.axvline(w, color="#334155", linewidth=0.6, zorder=0)
# Ligne horizontale légère entre tâches
for i in range(n):
    ax.axhline(i + 0.5, color="#334155", linewidth=0.3, zorder=0)

# Axes
ax.set_xlim(0, WEEKS + 2.5)
ax.set_ylim(-0.5, n - 0.5)
ax.set_xticks(range(WEEKS + 1))
ax.set_xticklabels(
    [f"S{w}" if w > 0 else "" for w in range(WEEKS + 1)],
    color="#CBD5E1", fontsize=9
)
ax.set_yticks(range(n))
ax.set_yticklabels(
    [t[0] for t in reversed(tasks)],
    color="#E2E8F0", fontsize=8.5
)
ax.tick_params(left=False, bottom=False)
for spine in ax.spines.values():
    spine.set_visible(False)

# Titre
ax.set_title(
    "Diagramme de Gantt — MSPR TPRE921 COFRAP",
    color="white", fontsize=13, fontweight="bold", pad=14
)

# Légende
legend_patches = [
    mpatches.Patch(color=COLORS["infra"],    label="Infrastructure & cluster"),
    mpatches.Patch(color=COLORS["dev"],      label="Fonctions serverless & BDD"),
    mpatches.Patch(color=COLORS["livrable"], label="Frontend, exposition & livrables"),
]
ax.legend(
    handles=legend_patches,
    loc="lower right",
    framealpha=0.15,
    facecolor="#1E293B",
    edgecolor="#475569",
    labelcolor="#CBD5E1",
    fontsize=8,
)

plt.tight_layout()
out = "docs/gantt.png"
plt.savefig(out, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor())
print(f"Gantt généré → {out}")
