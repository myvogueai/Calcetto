# ⚽ Calcetto 5v5 — App di prenotazione partite

App web per organizzare partite di calcetto 5 contro 5 con campo virtuale, timer, mischia squadre e lista d'attesa.  
**Stack**: React + Vite + Firebase (Firestore + Hosting)

---

## 📋 Funzionalità

| Feature | Dettagli |
|---------|----------|
| 🔑 Accesso con PIN | PIN di gruppo (default `CALCE2026`), modificabile dall'admin |
| 🏟️ Campo da gioco | Visuale verticale, Squadra A (blu) vs Squadra B (rosso), 5 posti fissi per squadra |
| 🔀 Mischia squadre | Voto a maggioranza (60%, min 2), contatore live |
| ⏱️ Timer partita | 20/30/45/60/90 min, pausa/riprendi, +5 min, fischio finale (Web Audio) |
| ⏳ Lista d'attesa | Promozione automatica quando si libera un posto |
| 🔄 Sync in tempo reale | Firestore `onSnapshot` — tutti i dispositivi sincronizzati live |
| ⚙️ Pannello Admin | Cambia PIN, nuova partita, modalità test |

---

## 🚀 Setup passo-passo

### STEP 1 — Crea il progetto Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Clicca **"Aggiungi progetto"** → dai un nome (es. `calcetto-5v5`)
3. Puoi disabilitare Google Analytics se non ti serve
4. Aspetta la creazione del progetto

### STEP 2 — Attiva Firestore

1. Nel tuo progetto Firebase, vai su **"Firestore Database"** (menu a sinistra)
2. Clicca **"Crea database"**
3. Scegli **"Avvia in modalità test"** (puoi applicare le regole di sicurezza dopo)
4. Scegli la regione più vicina (es. `europe-west1`)
5. Clicca **"Abilita"**

### STEP 3 — Crea un'app Web

1. Nella home del progetto, clicca l'icona **`</>`** (Web)
2. Dai un nome all'app (es. `calcetto-web`)
3. Spunta **"Configura anche Firebase Hosting"** se vuoi farlo in un solo passaggio
4. Clicca **"Registra app"**
5. Ti verrà mostrato un blocco di codice con `firebaseConfig` — **copialo**

### STEP 4 — Incolla la configurazione nell'app

Apri il file `src/firebase.js` e sostituisci il blocco `firebaseConfig`:

```js
// src/firebase.js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← il tuo valore
  authDomain: "il-tuo-progetto.firebaseapp.com",
  projectId: "il-tuo-progetto",
  storageBucket: "il-tuo-progetto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

> ⚠️ **Non condividere mai** `apiKey` in repo pubblici. Per la sicurezza in produzione,
> usa [Firebase App Check](https://firebase.google.com/docs/app-check) o restrizioni di dominio sulla Console Google Cloud.

### STEP 5 — Aggiorna `.firebaserc`

Apri `.firebaserc` e sostituisci il Project ID:

```json
{
  "projects": {
    "default": "il-tuo-project-id"
  }
}
```

### STEP 6 — Deploy automatico con GitHub Actions (consigliato)

Ogni push su `main` esegue automaticamente build e deploy su Firebase Hosting.

#### 6a. Ottieni il token Firebase (una tantum, dal tuo computer)

Apri un terminale locale nella cartella del progetto e lancia:

```bash
npx firebase login:ci
```

1. Si apre il browser → accedi con l'account Google del progetto **myvogueai**
2. Autorizza l'accesso
3. Nel terminale compare un token lungo, ad esempio:
   ```
   ✔  Success! Use this token to login on a CI server:

   1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
4. **Copialo subito** — non viene mostrato di nuovo

> Il token non scade subito, ma può essere revocato. Se il deploy inizia a fallire con errori di autenticazione, rigeneralo con lo stesso comando.

#### 6b. Inserisci il token nei GitHub Secrets

1. Apri il repository su GitHub: **myvogueai/Calcetto**
2. Vai su **Settings** → **Secrets and variables** → **Actions**
3. Clicca **New repository secret**
4. Compila così:
   - **Name:** `FIREBASE_TOKEN`
   - **Secret:** incolla il token copiato al passo precedente
5. Clicca **Add secret**

URL diretto: https://github.com/myvogueai/Calcetto/settings/secrets/actions

#### 6c. Attiva il workflow

Il file `.github/workflows/firebase-deploy.yml` deve essere presente sul branch `main` (merge della PR o push diretto).

Da quel momento, ogni `git push` su `main`:
- installa le dipendenze
- esegue `npm run build`
- fa deploy su **Firebase Hosting** + **regole Firestore** (`calcetto`)

Puoi anche lanciare il deploy manualmente da **Actions** → **Deploy to Firebase Hosting** → **Run workflow**.

L'app sarà disponibile su: **https://myvogueai.web.app**

---

### Deploy manuale (alternativa)

```bash
npm run build
npx firebase login
npx firebase deploy
```

---

## 🔒 Sicurezza Firestore (opzionale)

Il file `firestore.rules` è già configurato per consentire letture/scritture a chiunque
(necessario dato che non c'è autenticazione). Se vuoi restringere l'accesso ai soli
domini autorizzati, puoi aggiungere restrizioni di dominio nella [Google Cloud Console](https://console.cloud.google.com)
sotto **API e servizi → Credenziali → tua API key**.

---

## 💻 Sviluppo locale

```bash
npm install     # la prima volta
npm run dev     # avvia il dev server su http://localhost:5173
```

---

## 📱 Come si usa

### Utente normale
1. Apri il link e inserisci il **PIN gruppo** (`CALCE2026` di default)
2. Scrivi il tuo nome → **Aggiungi** → **Conferma**
3. Tocca una **casella libera** sul campo per schierarti
4. Se il campo è pieno → entri in **lista d'attesa** automaticamente
5. Usa **✏️** per cambiare nome, **🚪** per liberare il posto
6. Vota **"Mischia squadre"** se vuoi rimescolare (serve 60% dei giocatori)

### Admin (organizzatore)
1. Tocca l'icona **⚙️** in alto a destra
2. Al primo accesso crei il tuo PIN admin
3. Dal pannello puoi:
   - Cambiare il PIN gruppo e il PIN admin
   - Avviare/pausare/resettare il timer
   - Svuotare il campo (**Nuova partita**)
   - Riempire con nomi finti per test (**Riempi**)
