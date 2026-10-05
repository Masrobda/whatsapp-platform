# 📖 Guide Utilisateur — Module Campagnes WhatsApp
## NumericExport SaaS Platform — Documentation complète

**Version :** 3.0 | **Dernière mise à jour :** Mai 2026

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Démarrage rapide](#2-démarrage-rapide)
3. [Campagnes](#3-campagnes)
4. [Contacts et Segments](#4-contacts-et-segments)
5. [Templates WhatsApp](#5-templates-whatsapp)
6. [Automatisation & Drip](#6-automatisation--drip)
7. [Inbox](#7-inbox)
8. [A/B Testing](#8-ab-testing)
9. [Intelligence Artificielle](#9-intelligence-artificielle)
10. [Multi-canal : SMS & Email](#10-multi-canal--sms--email)
11. [Rapports & Exports](#11-rapports--exports)
12. [Bonnes pratiques](#12-bonnes-pratiques)
13. [Résolution de problèmes](#13-résolution-de-problèmes)
14. [Référence API](#14-référence-api)

---

## 1. Vue d'ensemble

Le module Campagnes WhatsApp de NumericExport vous permet d'envoyer des messages WhatsApp professionnels à grande échelle, en toute conformité avec les règles Meta Business.

### Architecture en 3 phases

```
Phase 1 — Core          Phase 2 — Avancé         Phase 3 — IA
─────────────────       ──────────────────────    ──────────────────
✅ Campagnes masse      ✅ Segments dynamiques    ✅ A/B Testing
✅ Import CSV/Excel     ✅ Automatisation drip    ✅ Scoring contacts
✅ Suivi statuts        ✅ Inbox centralisée      ✅ Timing optimal
✅ Export CSV           ✅ Rapports PDF           ✅ SMS + Email
```

### Prérequis

- Compte  Business avec templates approuvés
- Numéro WhatsApp Business actif (ex : +237689588347)
- Quota de messages suffisant (vérifiez votre solde)

### Limites importantes

| Règle | Limite | Contournement |
|-------|--------|---------------|
| Cooldown entre envois | 1-14 jours vers un même numéro | Whitelist développeurs |
| Quota journalier (essai) | 5 messages/jour | Passer à une offre payante |
| Taille max fichier CSV | 10 Mo | Découper en plusieurs imports |
| Rate limit envoi | 8000 msg/min (configurable) | Augmenter dans les paramètres |

---

## 2. Démarrage rapide

### Envoyer votre première campagne en 5 minutes

**Étape 1 — Préparez votre fichier CSV**

Créez un fichier `contacts.csv` avec au minimum une colonne `phone_number` :

```csv
phone_number,name,montant,deadline
+237677889933,John Biyong,150 000,30/05/2026
+237655663300,Marie Ateba,80 000,30/05/2026
+237699991122,John Essomba,220 000,30/05/2026
```

> **Formats de numéro acceptés :**
> - Format E.164 : `+237673344778` ✅
> - Format local 9 chiffres : `673344778` ✅ (converti automatiquement)
> - Format local 8 chiffres : `73344778` ✅ (préfixé par 6)

**Étape 2 — Créez la campagne**

Allez dans **Campagnes → Nouvelle campagne** puis suivez le wizard :

1. **Configuration** : Donnez un nom, choisissez le numéro émetteur
2. **Template** : Sélectionnez votre template approuvé par Meta, remplissez les variables par défaut
3. **Contacts** : Glissez votre CSV ou saisissez les numéros manuellement
4. **Planification** : Choisissez le mode d'envoi (instantané ou planifié)
5. **Récapitulatif** : Vérifiez et lancez

**Étape 3 — Suivez en temps réel**

Depuis la page détail de la campagne, surveillez :
- 📊 **Vue d'ensemble** : KPIs en direct, graphiques
- 👥 **Contacts** : Statut individuel de chaque destinataire
- 📋 **Journaux** : Événements détaillés

---

## 3. Campagnes

### 3.1 Types de campagnes

| Type | Usage | Exemple |
|------|-------|---------|
| **Broadcast** | Envoi simultané à toute une liste | Factures mensuelles May9 |
| **Drip** | Séquence d'envois échelonnés | Onboarding nouveaux clients |
| **Déclenchée** | Basée sur un événement | Confirmation de paiement |

### 3.2 Modes d'envoi

**⚡ Instantané**
- Envoi immédiat dès le lancement
- Idéal pour les notifications urgentes
- Rate limit : 30 msg/min (1 message toutes les 2 secondes)

**📦 Par lots (Batch)**
- Envoi par groupes espacés dans le temps
- Configurable : taille du lot + pause entre lots
- Exemple : 50 contacts → 60 secondes de pause → 50 contacts suivants
- Idéal pour les grandes listes (>5 000 contacts)

**📅 Planifié**
- Envoi déclenché à une date/heure précise
- L'heure est en UTC+1 (heure de Douala)
- Peut être annulé avant le déclenchement

**🧠 Intelligent**
- Optimise automatiquement l'heure d'envoi selon les profils IA
- Recommandé pour maximiser les taux de lecture

### 3.3 Variables de template

Les variables du template se fusionnent dans cet ordre de priorité :

```
Variables campagne (défaut) + Variables contact (priorité) = Message final

Campagne : { "entreprise": "May9", "deadline": "31/05/2026" }
Contact  : { "name": "John", "montant": "150 000", "numero_facture": "802478963" }
Résultat : { "entreprise": "May9", "deadline": "31/05/2026", "name": "John",
             "montant": "150 000", "numero_facture": "802478963" }
```

### 3.4 Gestion des statuts

```
queued → sent → delivered → read
                    ↓
                  failed
```

| Statut | Signification | Action recommandée |
|--------|--------------|-------------------|
| `queued` | En file d'attente | Attendre |
| `sent` | Envoyé au serveur | Attendre confirmation |
| `delivered` | Reçu sur l'appareil | ✅ Succès |
| `read` | Ouvert par le destinataire | ✅ Engagement |
| `failed` | Échec d'envoi | Voir le message d'erreur |
| `skipped` | Ignoré (cooldown/opt-out) | Normal |

### 3.5 Statuts de campagne

| Statut | Description | Actions disponibles |
|--------|------------|-------------------|
| `draft` | Brouillon | Lancer, Modifier |
| `scheduled` | Planifiée (futur) | Annuler |
| `running` | En cours d'envoi | Pause |
| `paused` | Mise en pause | Reprendre, Annuler |
| `completed` | Tous les contacts traités | Export, Rapport |
| `cancelled` | Annulée | — |
| `failed` | Erreur technique | Contacter le support |

### 3.6 Coût estimé

Le coût est calculé à **0.005 USD par message WhatsApp Business**.

```
Exemple :
1 000 contacts × 0.005 $ = 5.00 $ ≈ 3 100 FCFA
10 000 contacts × 0.005 $ = 50.00 $ ≈ 31 000 FCFA
```

---

## 4. Contacts et Segments

### 4.1 Format CSV recommandé

```csv
phone_number,name,email,entreprise,numero_contrat,numero_facture,montant,unpaid,deadline
+237673344778,John Biyong,john@may9.cm,MAy9 Cameroon,201547896,802478963,250000,50000,30/05/2026
+237688993310,Marie Ateba,marie@wazingo.cm,Wazingo SA,201547897,802478964,180000,0,30/05/2026
```

**Colonnes automatiquement reconnues :**
- `phone_number` / `phone` / `telephone` / `Téléphone` → Numéro (obligatoire)
- `name` / `nom` / `Nom` → Nom du contact
- `email` / `Email` → Email

**Toutes les autres colonnes** deviennent automatiquement des variables de template.

### 4.2 Segments dynamiques

Les segments dynamiques se calculent automatiquement depuis vos données d'envoi.

**Opérateurs disponibles :**

| Opérateur | Signification | Exemple |
|-----------|--------------|---------|
| `eq` | Égal à | `status = delivered` |
| `neq` | Différent de | `status ≠ failed` |
| `like` | Contient | `phone contient 674` |
| `is_null` | Est vide | `read_at est vide` |
| `is_not_null` | N'est pas vide | `delivered_at n'est pas vide` |
| `gt` / `gte` | Supérieur / ≥ | `date > 01/05/2026` |
| `lt` / `lte` | Inférieur / ≤ | `date < 31/05/2026` |

**Exemple de segment — "Clients livrés mais pas lus" :**
```
Champ : Statut dernier envoi = delivered
ET
Champ : Date de lecture est vide
```

**Exemple de segment — "Contacts à risque" :**
```
Champ : Statut dernier envoi = failed
OU
Champ : Date d'envoi > 30 jours
```

### 4.3 Importer des contacts dans un segment

Via l'interface :
1. Allez dans **Segments → Sélectionnez un segment statique**
2. Cliquez **Importer CSV/Excel**
3. Vérifiez l'aperçu et confirmez

Via l'API :
```bash
curl -X POST https://api.numericexport.com/api/v1/segments/SEGMENT_ID/contacts \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      { "phone_number": "+237633778891", "name": "John" },
      { "phone_number": "+237666997700", "name": "Marie" }
    ]
  }'
```

---

## 5. Templates WhatsApp

### 5.1 Templates disponibles

| Nom | Usage | Variables |
|-----|-------|-----------|
| `next_new_chat_v1` | Message de bienvenue | `name` |
| `next_001_facture_en_01` | Facture avec PDF | `entreprise`, `name`, `numero_contrat`, `numero_facture`, `montant`, `unpaid`, `deadline` |
| `relance_impaye_v1` | Relance impayé | `name`, `montant`, `deadline` |

### 5.2 Créer un nouveau template

Les templates doivent être soumis et approuvés par Meta avant utilisation :

1. Allez dans **Paramètres → Templates**
2. Cliquez **Nouveau template**
3. Remplissez le contenu avec les variables au format `{{nom_variable}}`
4. Soumettez pour approbation (délai : 24-48h)

### 5.3 Template avec PDF (factures)

Pour envoyer un PDF joint, utilisez le paramètre `invoice_data` :

```json
{
  "invoice_data": {
    "pdfUrl": "https://votre-serveur.com/factures/facture-001.pdf",
    "number": "001"
  }
}
```

Le PDF doit être **accessible publiquement** via une URL HTTPS.

---

## 6. Automatisation & Drip

### 6.1 Types de déclencheurs

| Déclencheur | Quand | Usage |
|------------|-------|-------|
| `campaign_delivered` | Message livré | Suivi après réception |
| `campaign_read` | Message ouvert | Suivi engagement |
| `campaign_replied` | Réponse reçue | Suivi commercial |
| `campaign_failed` | Échec d'envoi | Retry via autre canal |
| `date_relative` | X jours après inscription | Séquence onboarding |
| `manual` | Déclenchement manuel | Tests, cas particuliers |

### 6.2 Types d'étapes

| Type | Description | Configuration |
|------|------------|---------------|
| 📨 **Envoyer message** | Envoie un template WhatsApp | `template_name`, variables |
| ⏳ **Attendre** | Pause avant l'étape suivante | Durée : minutes/heures/jours |
| 🔀 **Condition** | Bifurcation SI/SINON | Champ + opérateur + valeur |
| 🔗 **Webhook** | Appel HTTP vers votre serveur | URL + méthode |
| 🏷️ **Tag** | Ajoute un label au contact | Nom du tag |
| ⛔ **Stop** | Termine le workflow | — |

### 6.3 Exemple : Drip de relance impayé

```
DÉCLENCHEUR : Message livré (campagne Factures)
     ↓
ATTENDRE : 3 jours
     ↓
CONDITION : Le contact a-t-il lu le message ?
    OUI →  STOP (déjà engagé)
    NON →  ENVOYER relance_impaye_v1
              ↓
           ATTENDRE : 7 jours
              ↓
           WEBHOOK → Notifier l'équipe commerciale
```

**Configuration dans l'interface :**
1. **Automations → Nouveau workflow**
2. Nommez : "Relance impayé 3+7 jours"
3. Déclencheur : `campaign_delivered`
4. Ajoutez les étapes une par une
5. **Activer** le workflow

### 6.4 Inscrire des contacts manuellement

```bash
curl -X POST https://api.numericexport.com/api/v1/automations/WORKFLOW_ID/enroll \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+237677777777",
    "name": "John",
    "variables": { "montant": "150 000", "deadline": "31/05/2026" }
  }'
```

Ou inscrire tout un segment :
```bash
-d '{ "segment_id": "SEGMENT_UUID" }'
```

---

## 7. Inbox

### 7.1 Gestion des conversations

L'inbox centralise tous les messages WhatsApp entrants. Chaque conversation affiche :
- Le fil complet des messages (entrants + sortants)
- Les notes internes des agents (fond orange, invisible au client)
- L'historique de la campagne associée

### 7.2 Statuts de conversation

| Statut | Description |
|--------|------------|
| **Ouverte** | Nouvelle conversation, personne assignée |
| **Assignée** | Prise en charge par un agent |
| **Résolue** | Traitée, archivée |
| **En attente** | En attente d'informations client |

### 7.3 Priorités

| Priorité | Usage |
|----------|-------|
| 🔴 **Urgente** | Plainte client, problème critique |
| 🟠 **Haute** | Demande commerciale importante |
| 🟡 **Normale** | Questions standards |
| ⚪ **Basse** | Informations générales |

### 7.4 Réponses rapides

Créez des templates de réponse rapide avec des raccourcis clavier.

**Dans l'interface :**
1. Inbox → (icône ⚡ dans la zone de saisie)
2. Cliquez sur une réponse rapide ou tapez `/` pour chercher

**Créer une réponse rapide :**
```bash
curl -X POST https://api.numericexport.com/api/v1/inbox/canned \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Facture disponible",
    "shortcut": "/facture",
    "content": "Bonjour {{name}}, votre facture est disponible dans le message précédent.",
    "category": "Support"
  }'
```

### 7.5 Gestion des STOP

Quand un client répond "STOP", "ARRÊTER", "UNSUBSCRIBE" ou "DÉSABONNER" :
1. Son numéro est automatiquement ajouté à la liste `opt_out_contacts`
2. Aucun message ne lui sera plus envoyé (toutes campagnes confondues)
3. La conversation est visible dans l'inbox avec le flag `is_stop: true`

> ⚠️ **Important** : Vous ne pouvez PAS réactiver un numéro opt-out sans le consentement explicite de la personne.

---

## 8. A/B Testing

### 8.1 Comment fonctionne l'A/B test

Le moteur utilise le **test Z statistique bilatéral** pour déterminer le gagnant :

```
1. Vous définissez 2 variantes (A et B) avec des templates différents
2. Les contacts sont répartis aléatoirement (50/50 par défaut)
3. Après N heures, le système calcule si la différence est significative
4. Si confiance ≥ seuil (95% par défaut) → gagnant déclaré automatiquement
5. Si pas encore significatif → réévaluation dans 6h
```

### 8.2 Critères de victoire

| Critère | Mesure | Quand l'utiliser |
|---------|--------|-----------------|
| **Taux de lecture** | % de messages lus | Comparer l'engagement |
| **Taux de livraison** | % de messages livrés | Comparer la délivrabilité |
| **Taux de réponse** | % de contacts ayant répondu | Comparer l'engagement actif |

### 8.3 Interpréter les résultats

```
Confiance 95-99% : ✅ Gagnant statistiquement significatif
Confiance 80-94% : ⏳ Données insuffisantes — continuer le test
Confiance < 80%  : 📊 Résultats non concluants
```

**Exemple de lecture :**
```
Variante A : 420 envois, 198 lus → 47.1%
Variante B : 420 envois, 247 lus → 58.8%
Lift : +24.8% en faveur de B
Confiance statistique : 97.3% ✅ → B est gagnant
```

### 8.4 Conseils pour un bon A/B test

- **Changez UN seul élément** à la fois (template OU horaire, pas les deux)
- **Minimum 100 contacts** par variante pour des résultats fiables
- **Laissez courir 24h minimum** avant d'évaluer
- **Ne regardez pas les résultats trop tôt** — biais d'observation

### 8.5 Test d'horaire (send_time)

Comparez l'impact de l'heure d'envoi :

```json
{
  "test_type": "send_time",
  "variants": [
    { "variant_name": "A", "label": "Matin 8h",  "template_name": "next_new_chat_v1", "send_hour": 8 },
    { "variant_name": "B", "label": "Soir 19h",  "template_name": "next_new_chat_v1", "send_hour": 19 }
  ]
}
```

---

## 9. Intelligence Artificielle

### 9.1 Scoring des contacts

Le système attribue un score de qualité (0-100) à chaque contact basé sur :

| Composante | Poids | Description |
|-----------|-------|-------------|
| Taux de lecture | 50% | Fréquence d'ouverture des messages |
| Taux de livraison | 30% | Numéro joignable et actif |
| Taux de réponse | 20% | Engagement actif |
| Pénalité inactivité | -0 à -40 | Jours depuis dernière interaction |

**Segments automatiques :**

| Segment | Critères | Action recommandée |
|---------|----------|-------------------|
| 🏆 **Champion** | Score ≥ 70 + actif < 14j | Programmes VIP, nouveaux produits |
| 💙 **Fidèle** | Score 50-70 + actif < 30j | Maintenir l'engagement |
| 🌱 **Prometteur** | Score 30-50 | Nurturing, éducation |
| ⚠️ **À risque** | Risque churn ≥ 50% | Campagne réengagement urgente |
| 😴 **Inactif** | Aucune activité > 60j | SMS ou email de réactivation |
| ✨ **Nouveau** | Premier contact | Séquence onboarding |

### 9.2 Optimisation horaire

L'IA analyse les patterns de lecture de vos contacts pour recommander le meilleur moment d'envoi.

**Profil type Cameroun (heuristique défaut) :**
```
🌅 7h-9h   : Bon    (70%) — Lever, lecture des notifications
☀️ 12h-13h : Moyen  (60%) — Pause déjeuner
🌇 18h-21h : Excellent (85-95%) — Fin de journée, temps libre
🌙 22h+    : Mauvais (10%) — Heure de sommeil
```

**Comment améliorer les recommandations :**
1. Envoyez plus de campagnes pour accumuler des données
2. Cliquez **"Recalculer le profil"** dans **IA & Multi-canal → Timing IA**
3. Après ~100 messages, le profil devient fiable (confiance ≥ 60%)

### 9.3 Analyse IA de campagne

Depuis le dashboard ou la page détail d'une campagne, cliquez **"Analyse IA"** pour obtenir :

- **Note globale** (A à F)
- **Résumé de performance**
- **Points forts et faiblesses**
- **Actions prioritaires** avec impact attendu
- **Comparaison benchmarks** secteur

> 💡 **Conseil** : Utilisez l'analyse IA après chaque campagne terminée pour améliorer continuellement vos performances.

---

## 10. Multi-canal : SMS & Email

### 10.1 Logique de fallback

Le multi-canal permet d'envoyer en séquence selon la disponibilité :

```
WhatsApp → (si échec) SMS → (si échec) Email
```

**Cas d'usage :**
- Contact sans WhatsApp → SMS automatique
- Numéro WhatsApp invalide → SMS ou Email
- Message urgent qui doit impérativement arriver

### 10.2 Configurer un provider SMS

**Africa's Talking (recommandé pour le Cameroun) :**
```bash
curl -X POST https://api.numericexport.com/api/v1/multichannel/providers/sms \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "provider_name": "africas_talking",
    "api_key": "VOTRE_CLE_API",
    "sender_id": "NumExp",
    "config": { "username": "votre_username" },
    "cost_per_sms": 0.04
  }'
```

**Nexah (opérateur Cameroun — Orange/MTN) :**
```bash
-d '{
  "provider_name": "nexah",
  "api_key": "VOTRE_CLE_API",
  "sender_id": "NumExp",
  "config": { "clientid": "VOTRE_CLIENT_ID" }
}'
```

### 10.3 Configurer un provider Email

**Brevo (recommandé — interface française) :**
```bash
curl -X POST https://api.numericexport.com/api/v1/multichannel/providers/email \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "provider_name": "brevo",
    "api_key": "VOTRE_CLE_BREVO",
    "from_email": "noreply@votredomaine.com",
    "from_name": "NumericExport"
  }'
```

### 10.4 Variables dans les messages SMS et Email

Utilisez le même format `{{variable}}` que pour WhatsApp :

```
SMS: "Bonjour {{name}}, votre facture de {{montant}} FCFA est disponible."
Email HTML: "<p>Bonjour <strong>{{name}}</strong>,<br>Montant dû : {{montant}} FCFA</p>"
```

### 10.5 Coûts indicatifs

| Canal | Coût unitaire | Pour 1 000 contacts |
|-------|--------------|---------------------|
| WhatsApp | ~0.005 $ | ~3 100 FCFA |
| SMS (Cameroun) | ~0.04 $ | ~24 800 FCFA |
| Email | ~0.001 $ | ~620 FCFA |

---

## 11. Rapports & Exports

### 11.1 Export CSV

Télécharge la liste de tous vos contacts avec leurs statuts.

**Via l'interface :** Campagne → Contacts → **Exporter CSV**

**Via l'API :**
```bash
curl -o contacts.csv \
  "https://api.numericexport.com/api/v1/campaigns/CAMPAIGN_ID/export/csv?status=delivered" \
  -H "Authorization: Bearer YOUR_JWT"
```

**Colonnes du CSV exporté :**
```
Téléphone, Nom, Statut, Variables, Mis en file, Envoyé, Livré, Lu, Échoué, ID Message WA, Erreur, Raison ignoré
```

### 11.2 Rapport PDF

Génère un rapport professionnel 2 pages incluant :
- KPIs (8 métriques clés)
- Graphique d'évolution sur 7 jours
- Entonnoir de conversion
- Détails techniques de la campagne
- Tableau des 100 premiers contacts

**Via l'interface :** Rapports → Sélectionnez la campagne → **Générer PDF**

> ⏳ La génération prend 10-30 secondes. Un lien de téléchargement apparaît dans l'onglet "Exports" une fois prêt. Le fichier expire après 7 jours.

### 11.3 Métriques clés et leur interprétation

| Métrique | Formule | Benchmark secteur | Excellent |
|---------|---------|------------------|-----------|
| **Taux de livraison** | Livrés / Envoyés | 85-90% | > 95% |
| **Taux de lecture** | Lus / Livrés | 50-60% | > 70% |
| **Taux de réponse** | Réponses / Lus | 5-10% | > 15% |
| **Taux d'échec** | Échecs / Envoyés | < 5% | < 2% |
| **Taux opt-out** | Désabonnements / Envoyés | < 0.5% | < 0.1% |

---

## 12. Bonnes pratiques

### 12.1 Conformité et respect des utilisateurs

✅ **À faire :**
- Obtenez le consentement explicite avant d'envoyer
- Mentionnez clairement qui vous êtes dans le message
- Respectez les horaires appropriés (évitez 22h-7h)
- Honorez les demandes de STOP immédiatement
- Limitez la fréquence à 1-2 messages/semaine par contact

❌ **À ne pas faire :**
- Envoyer à des numéros récupérés sans consentement
- Ignorer les opt-out
- Envoyer le même message plusieurs fois en peu de temps
- Utiliser des messages trompeurs ou agressifs

### 12.2 Optimiser les performances

**Taux de livraison faible (< 85%) :**
1. Vérifiez la qualité de votre liste (numéros valides)
2. Assurez-vous que vos contacts ont WhatsApp
3. Vérifiez le rating de qualité de votre numéro
4. Réduisez le rate limit d'envoi

**Taux de lecture faible (< 40%) :**
1. Testez différentes heures d'envoi (utilisez l'IA Timing)
2. Améliorez le premier paragraphe de votre message
3. Lancez un A/B test sur 2 templates différents
4. Segmentez mieux votre audience

**Beaucoup d'opt-out (> 1%) :**
1. Réduisez la fréquence d'envoi
2. Revoyez le contenu de vos messages
3. Améliorez la pertinence (segmentation)
4. Proposez une option de réduction de fréquence

### 12.3 Gestion des quotas

Votre quota est affiché dans le coin supérieur droit de l'interface.

| Phase | Quota | Réinitialisation |
|-------|-------|-----------------|
| Essai | 25 messages total + 5/jour | Sur achat |
| Payant | Selon votre offre | À la recharge |

Pour recharger :
1. **Paramètres → Mon compte → Recharger**
2. Ou contactez support@numericexport.com

### 12.4 Checklist avant lancement d'une campagne

```
□ Le template est approuvé par Meta
□ Le numéro émetteur est actif
□ Le fichier CSV a été vérifié (numéros valides)
□ Les variables du template correspondent aux colonnes CSV
□ L'heure d'envoi est appropriée (entre 8h et 21h)
□ Le quota restant est suffisant
□ Les URL de PDF sont accessibles (si applicable)
□ Une campagne test a été envoyée sur votre propre numéro
□ Le cooldown de 14 jours est respecté pour les contacts récents
```

---

## 13. Résolution de problèmes

### 13.1 Erreurs courantes

**"Aucun identifiant client trouvé (token invalide)"**
→ Votre session a expiré. Reconnectez-vous.

**"Délai minimum de 14 jours requis"**
→ Ce contact a déjà reçu un message de votre compte il y a moins de 14 jours. Attendez ou utilisez la whitelist développeurs pour vos tests.

**"Ce numéro s'est désabonné"**
→ Le contact a envoyé STOP. Vous ne pouvez plus lui envoyer de messages.

**"Compte désactivé"**
→ Votre compte a été suspendu. Contactez support@numericexport.com.

**"Période d'essai expirée"**
→ Votre quota d'essai est épuisé. Passez à une offre payante.

**"Template non trouvé"**
→ Le nom du template est incorrect ou n'est pas approuvé. Vérifiez dans NEXT LTD.

**"URL du PDF invalide"**
→ L'URL du PDF doit commencer par `https://` et être accessible publiquement.

### 13.2 Problèmes d'import CSV

**Caractères spéciaux mal encodés**
→ Enregistrez votre CSV en UTF-8 (sans BOM) depuis Excel : Enregistrer sous → CSV UTF-8

**Numéros non reconnus**
→ Vérifiez le format : `+237XXXXXXXXX` ou `6XXXXXXXX` pour le Cameroun

**"Import impossible sur une campagne active"**
→ Mettez la campagne en pause avant d'importer de nouveaux contacts

### 13.3 Problèmes d'envoi

**Messages envoyés mais non livrés**
1. Vérifiez que le destinataire a WhatsApp installé
2. Vérifiez que son numéro est correct et actif
3. Regardez les logs de la campagne pour le message d'erreur NEXT LTD

**La campagne est en `running` mais n'avance pas**
1. Vérifiez que la file BullMQ est active (workers)
2. Vérifiez la connexion Redis
3. Consultez les logs serveur : `pm2 logs api`

**A/B test ne sélectionne pas de gagnant**
→ Le seuil de confiance (95%) n'est pas atteint. Soit attendez plus longtemps, soit réduisez le seuil à 90% dans les paramètres du test.

### 13.4 Contact support

- **Email** : support@numericexport.com
- **WhatsApp** : +237689588347 (9h-18h, Lun-Ven)
- **Documentation API** : https://api.numericexport.com/docs

---

## 14. Référence API

### Authentification

Toutes les requêtes nécessitent un token JWT dans le header :

```bash
Authorization: Bearer VOTRE_JWT_TOKEN
```

Pour les intégrations système (API Token) :
```bash
Authorization: Bearer nxt_VOTRE_API_TOKEN
```

### Endpoints principaux

#### Campagnes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/campaigns` | Lister les campagnes |
| `POST` | `/api/v1/campaigns` | Créer une campagne |
| `GET` | `/api/v1/campaigns/:id` | Détails d'une campagne |
| `PUT` | `/api/v1/campaigns/:id` | Modifier une campagne |
| `POST` | `/api/v1/campaigns/:id/launch` | Lancer une campagne |
| `POST` | `/api/v1/campaigns/:id/pause` | Mettre en pause |
| `POST` | `/api/v1/campaigns/:id/cancel` | Annuler |
| `GET` | `/api/v1/campaigns/:id/stats` | Statistiques |
| `GET` | `/api/v1/campaigns/:id/contacts` | Liste des contacts |
| `POST` | `/api/v1/campaigns/:id/contacts/import` | Import CSV/Excel |
| `GET` | `/api/v1/campaigns/:id/export/csv` | Export CSV |
| `POST` | `/api/v1/campaigns/:id/export/pdf` | Générer PDF |
| `GET` | `/api/v1/campaigns/stats` | Stats globales |

#### Segments

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/segments` | Lister les segments |
| `POST` | `/api/v1/segments` | Créer un segment |
| `POST` | `/api/v1/segments/preview` | Prévisualiser |
| `POST` | `/api/v1/segments/:id/refresh` | Recalculer |
| `GET` | `/api/v1/segments/:id/contacts` | Contacts du segment |

#### Messages directs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/messages/send` | Envoyer un message unique |
| `GET` | `/api/v1/messages` | Historique des messages |
| `GET` | `/api/v1/messages/:id` | Détail d'un message |
| `GET` | `/api/v1/messages/stats/summary` | Statistiques |

#### IA & A/B Testing

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/ai/scores` | Scores contacts |
| `POST` | `/api/v1/ai/scores/compute` | Calculer un score |
| `GET` | `/api/v1/ai/timing` | Recommandations horaires |
| `GET` | `/api/v1/ai/campaigns/:id/analyze` | Analyse IA |
| `GET` | `/api/v1/ab-tests` | Lister les tests A/B |
| `POST` | `/api/v1/ab-tests` | Créer un test |
| `POST` | `/api/v1/ab-tests/:id/launch` | Lancer avec contacts |
| `GET` | `/api/v1/ab-tests/:id/results` | Résultats statistiques |

#### Multi-canal

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/multichannel/sms/send` | Envoyer SMS |
| `POST` | `/api/v1/multichannel/email/send` | Envoyer Email |
| `POST` | `/api/v1/multichannel/send` | Envoi avec fallback |
| `GET` | `/api/v1/multichannel/stats` | Stats par canal |
| `POST` | `/api/v1/multichannel/providers/sms` | Config provider SMS |
| `POST` | `/api/v1/multichannel/providers/email` | Config provider Email |

### Exemple complet : Campagne factures via API

```bash
# 1. Créer la campagne
CAMPAIGN=$(curl -s -X POST https://api.numericexport.com/api/v1/campaigns \
  -H "Authorization: Bearer nxt_184c6e48..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Factures Mai 2026",
    "phone_number": "+237689588347",
    "template_name": "next_001_facture_en_01",
    "template_language": "fr",
    "template_params": { "entreprise": "NEXT LTD" },
    "send_mode": "batch",
    "batch_size": 50,
    "rate_per_minute": 30,
    "category": "Facturation"
  }')

CAMPAIGN_ID=$(echo $CAMPAIGN | jq -r '.campaign.id')
echo "Campagne créée: $CAMPAIGN_ID"

# 2. Importer les contacts CSV
curl -X POST "https://api.numericexport.com/api/v1/campaigns/$CAMPAIGN_ID/contacts/import" \
  -H "Authorization: Bearer nxt_184c6e48..." \
  -F "file=@contacts_mai2026.csv"

# 3. Lancer la campagne
curl -X POST "https://api.numericexport.com/api/v1/campaigns/$CAMPAIGN_ID/launch" \
  -H "Authorization: Bearer nxt_184c6e48..."

# 4. Suivre les stats toutes les 5 minutes
watch -n 300 'curl -s "https://api.numericexport.com/api/v1/campaigns/'$CAMPAIGN_ID'/stats" \
  -H "Authorization: Bearer nxt_184c6e48..." | jq .campaign'
```

---

*Documentation NumericExport — Module Campagnes v3.0 — Mai 2026*
*Pour toute question : support@numericexport.com*
