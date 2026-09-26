# CvSU Lost and Found Ticket Desk

An online lost-and-found ticketing system built for **CSSO & ELITS** at Cavite State University.  
Students submit reports for items lost around DIT; officers manage, track, and follow up from a dedicated admin dashboard.

---

## Project Structure

```text
├── index.html         # Single-page app (landing, #submit form, #admin dashboard)
├── styles.css         # Responsive glassmorphism styling
├── script.js          # Firebase Auth + Firestore logic (ES modules)
├── firestore.rules    # Server-side security rules & rate limits
├── firebase.json      # Hosting config + security headers
├── .firebaserc        # Firebase project alias
├── .gitignore         # Keeps secrets & caches out of git
└── README.md          # ← You are here
```

---

## How to Ship This Properly

Follow these steps **in order**. Each step must succeed before moving to the next.

### Step 0 — Prerequisites

- **Node.js** installed (for the Firebase CLI)
- A Google account with access to the Firebase project
- The [Firebase CLI](https://firebase.google.com/docs/cli):
  ```bash
  npm install -g firebase-tools
  firebase login
  ```

### Step 1 — Restrict Your API Key (Important!)

The `apiKey` in `script.js` is a **public identifier**, not a secret — Firebase designed it to be embedded in client code. But you must restrict it so strangers can't abuse your project quotas:

1. Go to **Google Cloud Console → APIs & Services → [Credentials](https://console.cloud.google.com/apis/credentials)**.
2. Click the API key used by `cvsu-lost-and-found-48294`.
3. Under **Application restrictions**, select **HTTP referrers (web sites)** and add:
   - `cvsu-lost-and-found-48294.web.app/*`
   - `cvsu-lost-and-found-48294.firebaseapp.com/*`
   - `localhost/*` (remove after testing)
4. Under **API restrictions**, select **Restrict key** and check only:
   - Cloud Firestore API
   - Identity Toolkit API (Firebase Auth)
   - Token Service API
5. Click **Save**.

> **Result:** Even though the key is visible in the source, it can only be used from your approved domains and only for the APIs you selected. Outsiders cannot steal it.

### Step 2 — Enable Firebase Authentication

1. Open **Firebase Console → Authentication → Sign-in method**.
2. Enable **Google** (for student sign-in):
   - Click Google → Enable → Save.
   - The `script.js` already passes `hd: "cvsu.edu.ph"` which restricts the Google picker to CvSU accounts. Non-CvSU emails are rejected in code even if they bypass the picker hint.
3. Enable **Email/Password** (for officer admin login):
   - Click Email/Password → Enable → Save.
4. Under **Settings → Authorized domains**, add your production domain if it's a custom domain (Firebase Hosting domains are auto-added).

### Step 3 — Create Admin Officer Accounts

Officers log in with email/password, but they also need the custom claim `officer: true` to unlock the dashboard. Here's how:

1. In Firebase Console → Authentication → Users, click **Add user** and create the officer's account (e.g. `officer1@cvsu.edu.ph` + a strong password).

2. Set the custom claim using a **one-time local script**. Create a file called `set-officer.mjs` (DO NOT commit this file):

   ```js
   // set-officer.mjs — run locally, never commit
   import admin from "firebase-admin";
   import { readFileSync } from "fs";

   // Download the service account key from:
   // Firebase Console → Project settings → Service accounts → Generate new private key
   const serviceAccount = JSON.parse(readFileSync("serviceAccountKey.json", "utf8"));

   admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

   // Replace with the officer's UID (copy from Firebase Console → Authentication → Users)
   const uid = "PASTE_OFFICER_UID_HERE";

   await admin.auth().setCustomUserClaims(uid, { officer: true });
   console.log(`✓ officer claim set for ${uid}`);
   process.exit(0);
   ```

3. Run it:
   ```bash
   npm install firebase-admin   # one-time install
   node set-officer.mjs
   ```

4. **Delete** `serviceAccountKey.json` and `set-officer.mjs` immediately after. The `.gitignore` already blocks `serviceAccountKey.json` and `*.pem`, but don't leave them lying around.

> ⚠️ **Never commit `serviceAccountKey.json`** — it gives full admin access to your Firebase project.

### Step 4 — Create the Firestore Database

1. Open **Firebase Console → Firestore Database → Create database**.
2. Choose **production mode** (the rules in `firestore.rules` will handle access).
3. Pick the region closest to your users (e.g. `asia-southeast1` for the Philippines).
4. The `lostTickets` collection is created automatically on the first ticket submission.

### Step 5 — Deploy

```bash
# From the project root:
firebase deploy
```

This deploys both the website (Firebase Hosting) and the security rules (Firestore). The `firebase.json` is configured to:
- Add security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- Exclude `README.md`, `firestore.rules`, and hidden files from the public hosting.

### Step 6 — Verify It Works

1. Open `https://cvsu-lost-and-found-48294.web.app`
2. Click **"Report Lost Item"** → you should land on the submit form.
3. Click **"Sign in with CvSU Google"** → only `@cvsu.edu.ph` accounts should work.
4. Submit a test ticket → a popup modal should appear with the ticket number.
5. Navigate to `#admin` → log in with the officer email/password → you should see the ticket.
6. Click **"← Back to home"** to verify navigation works.

---

## What's Safe to Keep in the Public Repo

| Item | Safe? | Why |
|---|---|---|
| `apiKey` in `script.js` | ✅ Yes | Firebase API keys are public identifiers, not secrets. Protected via referrer + API restrictions (Step 1). |
| `projectId`, `authDomain`, `storageBucket` | ✅ Yes | Public project metadata. No different from your `.web.app` URL. |
| `firestore.rules` | ✅ Yes | These are access control rules — making them visible is fine (and encouraged for review). |
| `firebase.json` | ✅ Yes | Hosting config with no secrets. |
| `serviceAccountKey.json` | ❌ NEVER | Full admin access. Blocked by `.gitignore` — delete after use. |
| `.env` / `.env.local` | ❌ NEVER | Blocked by `.gitignore`. |

---

## Security Layers

| Layer | How it protects you |
|---|---|
| **Google sign-in with `hd: "cvsu.edu.ph"`** | Only CvSU Google accounts can reach the sign-in picker. Code double-checks and signs out non-CvSU emails. |
| **Firestore rules — `isVerifiedCvsuStudent()`** | Server-side: rejects writes from any account that isn't a verified `@cvsu.edu.ph`. |
| **Firestore rules — `isOfficer()`** | Only accounts with the `officer: true` custom claim can read, update, or delete tickets. |
| **Firestore rules — `withinRateLimit()`** | Server-side: max 3 tickets per email per hour via a `count()` query. |
| **Client-side rate limiter** | Immediate UX feedback — blocks the submit button after 3 attempts/hour without waiting for a server rejection. |
| **API key restrictions** | Even if someone copies the key, it only works from your approved domains + approved APIs. |
| **Security headers** | `X-Frame-Options: DENY` (no iframe embedding), `nosniff`, strict referrer policy, no camera/mic/geo permissions. |

---

## Free-Tier Limits

Everything runs on Firebase's free Spark plan:

| Service | Free Quota |
|---|---|
| Firestore | 50k reads, 20k writes, 20k deletes / day, 1 GiB storage |
| Authentication | 10k monthly active users |
| Hosting | 10 GiB storage, 360 MB/day bandwidth |

For a campus-scale deployment (a few hundred students + a handful of officers), you'll stay well within these limits.

---

## Local Development

```bash
# Serve locally (ES modules require a server, not file://)
npx -y serve .

# Then open http://localhost:3000
# Admin: http://localhost:3000/#admin
```

---

## License

Created for CSSO — Cavite State University.
