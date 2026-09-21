# Firebase Setup & Production Guide

This project is now connected to Firebase (`cvsu-lost-and-found-48294`).

## Architecture & Production Flow

1. **Ticket Submission**:
   - Students visit the site and fill out the lost item ticket form.
   - The ticket is validated (must end with `@cvsu.edu.ph`) and written directly to Firestore in the `lostTickets` collection with server-side timestamps.
2. **Admin Portal**:
   - Access via URL hash: `index.html#admin` (or `https://your-domain.web.app/#admin`).
   - Officers log in using their email and password via **Firebase Authentication**.
   - Authenticated officers can view all tickets, filter by status, update status to "Solved", record who solved it, delete tickets, and export the list to CSV.
3. **Email Follow-ups**:
   - Officers can click `Email student` to launch an auto-composed mailto message to the student's CvSU email.

---

## What Has Been Configured in the Code

- **Firebase SDK**: Loaded via ES modules in `index.html` and `script.js`.
- **Database**: Cloud Firestore using collection `lostTickets`.
- **Authentication**: Firebase Auth (`signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`).
- **Security Rules**: Defined in `firestore.rules`.

---

## 3 Quick Steps in Firebase Console Before Going Live

### 1. Enable Firestore Database
1. Go to [Firebase Console - Firestore](https://console.firebase.google.com/project/cvsu-lost-and-found-48294/firestore).
2. Click **Create database** (if not already created).
3. Select your region (e.g. `asia-southeast1` for Philippines/Southeast Asia).
4. Go to the **Rules** tab, paste the contents of `firestore.rules`, and click **Publish**:
   ```javascript
   rules_version = '2';

   service cloud.firestore {
     match /databases/{database}/documents {
       match /lostTickets/{ticketId} {
         allow create: if request.resource.data.email.matches('.*@cvsu[.]edu[.]ph$')
                       && request.resource.data.fullName is string
                       && request.resource.data.item is string;

         allow read, update, delete: if request.auth != null;
       }
     }
   }
   ```

### 2. Enable Firebase Authentication
1. Go to [Firebase Console - Authentication](https://console.firebase.google.com/project/cvsu-lost-and-found-48294/authentication).
2. Click **Get Started** and enable **Email/Password** as a sign-in provider.
3. In the **Users** tab, click **Add user**:
   - Add the email and password for each CSSO/ELITS officer who should have access to the admin dashboard.

### 3. Deploy to Firebase Hosting
1. Install Firebase tools (if you haven't already):
   ```bash
   npm install -g firebase-tools
   ```
2. Log in and deploy:
   ```bash
   firebase login
   firebase deploy
   ```
