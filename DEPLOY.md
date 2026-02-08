# Deploy – FutureCraft

## 1. Push su GitHub

```bash
cd /Users/ivansantantonio/Desktop/cursor/booking-gestionale

git add .
git status
git commit -m "Build e deploy"
git push origin main
```

(Se non hai ancora il remote: `git remote add origin https://github.com/Ivanworkspace/futurecraft-management.git`)

---

## 2. Deploy su Vercel

### Opzione A – Da sito Vercel
1. Vai su [vercel.com](https://vercel.com) e accedi.
2. **Add New** → **Project**.
3. Importa il repo **futurecraft-management** (o **Ivanworkspace/futurecraft-management**).
4. Vercel rileva Vite: conferma **Build Command** `npm run build` e **Output Directory** `dist`.
5. Clicca **Deploy**.
6. Alla fine avrai un URL tipo `futurecraft-management.vercel.app` (o simile).

### Opzione B – Da terminale (Vercel CLI)
```bash
cd /Users/ivansantantonio/Desktop/cursor/booking-gestionale
npx vercel
```
Segui le domande (link al progetto esistente o nuovo). Per produzione: `npx vercel --prod`.

---

## 3. Firebase – Dominio autorizzato

Dopo il deploy, aggiungi l’URL Vercel a Firebase:

1. [Firebase Console](https://console.firebase.google.com) → progetto **futurecraftmanagament**
2. **Authentication** → **Impostazioni** (Settings) → **Domini autorizzati**
3. **Aggiungi dominio** → inserisci il dominio Vercel (es. `futurecraft-management.vercel.app`, senza `https://`)
4. Salva

Così il login e “Crea cliente” funzioneranno anche dall’app in produzione.

---

## Riepilogo

| Step | Comando / Azione |
|------|-------------------|
| 1 | `git add . && git commit -m "Deploy" && git push` |
| 2 | Vercel: importa repo → Deploy (o `npx vercel --prod`) |
| 3 | Firebase → Authentication → Domini autorizzati → aggiungi il dominio Vercel |

Dopo questi passaggi l’app è online e, dall’URL deployato, “Crea cliente” in Admin dovrebbe funzionare senza errore CORS.
