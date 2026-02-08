# Risoluzione errori comuni

## 1. Firestore: "Missing or insufficient permissions" (permission-denied)

Le regole Firestore devono essere **pubblicate** nel progetto. Scegli una delle due opzioni.

### Opzione A – Da terminale
```bash
cd booking-gestionale
firebase deploy --only firestore
```

### Opzione B – Da Firebase Console
1. Apri [Firebase Console](https://console.firebase.google.com) → progetto **futurecraftmanagament**
2. **Firestore Database** → scheda **Regole**
3. Sostituisci tutto il contenuto con le regole che trovi nel file **firestore.rules** del progetto
4. Clicca **Pubblica**

Se le regole non sono quelle giuste, le letture/scritture falliscono con "permission-denied".

---

## 2. CORS / "Creazione cliente" non funziona da localhost

Per usare **Crea cliente** mentre l’app gira su `http://localhost:5173`:

1. Vai in [Firebase Console](https://console.firebase.google.com) → progetto **futurecraftmanagament**
2. **Authentication** → **Impostazioni** (Settings) → **Domini autorizzati**
3. Controlla che ci sia **localhost** nell’elenco
4. Se manca, clicca **Aggiungi dominio** e inserisci: `localhost`

Poi ridistribuisci la Cloud Function (stessa regione del client, es. europe-west1):

```bash
cd booking-gestionale/functions
npm install
cd ..
firebase deploy --only functions
```

L’app usa la regione **europe-west1**: la funzione deve essere deployata lì (nel codice è già impostato).

---

## 3. useAuth must be used within AuthProvider

Se compare questo errore, di solito è un problema temporaneo di caricamento. Prova a:

- Ricaricare la pagina (F5)
- Fare logout e di nuovo login, poi riaprire la pagina Admin

Se persiste, controlla che in **App.tsx** l’`AuthProvider` avvolga tutte le route (inclusa quella `/admin`).
