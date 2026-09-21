# CvSU Lost and Found Ticket Desk

An online lost-and-found ticketing system built for **CSSO & ELITS** at Cavite State University (CvSU). 

Students can submit detailed reports for items lost around DIT, and authorized officers can manage, track, update status, and communicate with students directly from a dedicated admin portal.

---

## Features

- **Student Ticket Submission**:
  - Simple, responsive form for reporting lost belongings.
  - Validation ensuring official `@cvsu.edu.ph` institutional emails.
  - Generates unique ticket numbers (`LF-YYYY-XXXXX`).
  - Live preview before submitting.
- **Officer Admin Portal** (`#admin`):
  - Protected by **Firebase Authentication** (email & password).
  - Real-time ticket queue with status tracking (`Open`, `Reviewing`, `Matched`, `Solved`).
  - Records who solved the ticket and when.
  - Direct student follow-up via prefilled Gmail / mailto links.
  - One-click CSV report export.
- **Cloud Backend**:
  - Powered by **Google Cloud Firestore** for real-time cloud data storage.
  - Secured via Firestore security rules ensuring student submission privacy.

---

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism Design), JavaScript (ES Modules).
- **Backend & Database**: Firebase Firestore.
- **Authentication**: Firebase Auth.
- **Hosting**: Firebase Hosting.

---

## Project Structure

```text
├── index.html         # Landing page, student form, and hidden admin portal
├── styles.css         # Responsive glassmorphism styling
├── script.js          # Firestore database logic and Firebase Auth integration
├── firestore.rules    # Production security rules for Firestore
├── firebase.json      # Firebase hosting and rules deployment config
├── .firebaserc        # Firebase project alias
├── FIREBASE_SETUP.md  # Detailed Firebase setup and officer management notes
└── SHIP_GUIDE.md      # Step-by-step production shipping checklist
```

---

## Getting Started

### Local Testing
Because this project uses JavaScript ES modules (`type="module"`), serve the folder using any local HTTP server:

```bash
# Using Python
python -m http.server 3000

# Or using Node.js / npx
npx serve .
```
Then open `http://localhost:3000` in your browser.

### Admin Access
Navigate to:
```text
http://localhost:3000/#admin
```
Log in using officer credentials created in the Firebase Console.

---

## Deployment

Deploy directly to Firebase Hosting:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to your Google account
firebase login

# Deploy website and security rules
firebase deploy
```

---

## License
Created for CSSO & ELITS - Cavite State University.
