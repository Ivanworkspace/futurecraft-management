# FutureCraft - Gestionale Prenotazioni

Sistema di prenotazione per sessioni di registrazione contenuti. I clienti possono prenotare slot in modo **anonimo** (altri vedono solo "Non disponibile"), con limite di **2 prenotazioni al mese**.

## Funzionalità

- **Login** con email e password (Firebase Auth)
- **Calendario** con due slot giornalieri: Mattina (9-13) e Pomeriggio (15-18)
- **Prenotazione anonima**: gli altri clienti vedono solo che lo slot non è disponibile
- **Limite 2 appuntamenti/mese** per ogni cliente
- **Pannello Admin** per visualizzare tutte le prenotazioni
- Design moderno con animazioni (Framer Motion, Tailwind)

## Setup

### 1. Installa le dipendenze

```bash
cd booking-gestionale
npm install
```

### 2. Crea l'account Admin

1. Vai su [Firebase Console](https://console.firebase.google.com) → progetto **futurecraftmanagament**
2. **Authentication** → **Users** → **Add user**
3. Crea un utente con:
   - **Email**: `admin@futurecraftmanagement.com`
   - **Password**: scegline una sicura

4. (Opzionale) Per usare un'altra email admin, modifica `src/config.ts`:
   ```ts
   export const ADMIN_EMAIL = "tua-email-admin@example.com";
   ```

### 3. Abilita Firestore e Authentication

- **Firestore Database**: crea un database in modalità production
- **Authentication**: abilita il provider "Email/Password"

### 4. Deploy delle regole Firestore

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore
```

### 5. Avvio in sviluppo

```bash
npm run dev
```

### 6. Deploy su Vercel

1. Pusha il codice su GitHub (vedi sotto)
2. Vai su [vercel.com](https://vercel.com) → **Add New Project** → importa il repo
3. Vercel rileva automaticamente Vite. Clicca **Deploy**
4. **Importante**: Aggiungi il dominio Vercel in Firebase Console → **Authentication** → **Settings** → **Authorized domains** → aggiungi `tuo-progetto.vercel.app`

## Crea i clienti

Per ogni cliente, crea un utente in **Firebase Console** → **Authentication** → **Add user** con email e password. Condividi le credenziali con il cliente per farlo accedere.

## Deploy su GitHub e Vercel

```bash
cd booking-gestionale

# Inizializza Git (se non già fatto)
git init

# Aggiungi il remote
git remote add origin https://github.com/Ivanworkspace/futurecraft-management.git

# Aggiungi, committa e pusha
git add .
git commit -m "FutureCraft - Gestionale prenotazioni"
git branch -M main
git push -u origin main
```

Poi su [vercel.com](https://vercel.com): **New Project** → Importa `Ivanworkspace/futurecraft-management` → Deploy.

---

## Struttura

- `/login` - Pagina di login
- `/` - Calendario prenotazioni (clienti)
- `/admin` - Pannello admin (solo per admin@futurecraftmanagement.com)
