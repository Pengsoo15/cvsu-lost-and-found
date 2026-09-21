# How To Ship This Website

This guide explains how to put the Lost and Found website online in simple
steps.

## What You Have Now

The project has these main files:

```text
index.html
styles.css
script.js
FIREBASE_SETUP.md
```

Right now, tickets are saved in the browser for testing. For real use, connect
Firebase Firestore so submitted tickets are stored online.

## Step 1: Test The Website Locally

1. Open the project folder.
2. Double-click `index.html`.
3. Submit a test ticket.
4. Check that the CvSU email validation works.
5. Open the hidden admin page by adding `#admin` to the URL.

Example:

```text
index.html#admin
```

6. Use the demo passcode from `script.js`.
7. Confirm that tickets appear in the hidden admin dashboard.
8. Try marking a ticket as `Solved`.

## Step 2: Connect Firebase

Follow the detailed comments inside `script.js` and the guide in
`FIREBASE_SETUP.md`.

Short version:

1. Go to Firebase Console.
2. Create a Firebase project.
3. Add a Web App.
4. Copy your Firebase config.
5. Enable Firestore Database.
6. Enable Firebase Authentication for admin access.
7. Paste your Firebase config into `script.js`.
8. Change `DATA_MODE` from `"local"` to `"firebase"`.
9. Use the commented Firebase code inside `ticketStore`.
10. Update Firestore Security Rules so only admins can view and manage tickets.

Do not ship the demo passcode as real security.

## Step 3: Choose A Hosting Option

Use one of these:

```text
Firebase Hosting - best choice if you are already using Firebase
GitHub Pages - simple static hosting
Netlify - easy drag-and-drop deploy
Vercel - easy static deploy
```

Recommended: Firebase Hosting.

## Step 4: Deploy With Firebase Hosting

Install Node.js first if it is not installed.

Then install Firebase CLI:

```bash
npm install -g firebase-tools
```

Log in:

```bash
firebase login
```

Inside this project folder, initialize hosting:

```bash
firebase init hosting
```

When Firebase asks questions:

```text
Use an existing project? Yes
Choose your Firebase project
Public directory? .
Configure as single-page app? No
Set up automatic builds? No
Overwrite index.html? No
```

Then deploy:

```bash
firebase deploy
```

Firebase will give you a live website URL.

## Step 5: Test The Live Website

After deployment:

1. Open the live URL.
2. Submit a ticket using a `@cvsu.edu.ph` email.
3. Open the hidden admin URL:

```text
https://your-site-url.web.app/#admin
```

4. Sign in as admin if Firebase Authentication is connected.
5. Confirm the ticket appears.
6. Mark the ticket as solved.
7. Check that `Solved By` and `Solved At` are saved.
8. Try the `Email student` button.

## Step 6: Before Real School Use

Make sure these are done:

```text
Firebase Firestore is connected
Firebase Authentication is enabled
Admin access is protected by real login
Firestore Security Rules are not in test mode
Only approved admins can read all tickets
Only approved admins can update or delete tickets
Students can only submit tickets
The admin URL is shared only with authorized officers
```

## Step 7: Recommended Firestore Rules Idea

Use this idea as a starting point, then adjust it for your real admin accounts.

```text
Students may create tickets.
Students may not list all tickets.
Admins may read all tickets.
Admins may update status, solvedBy, and solvedAt.
Admins may delete tickets only if your organization allows deletion.
```

For real security, use Firebase Authentication custom claims or an `admins`
collection that lists authorized admin user IDs.

## Simple Launch Checklist

```text
[ ] Local form works
[ ] CvSU email checker works
[ ] Firebase project created
[ ] Firestore enabled
[ ] Firebase Authentication enabled
[ ] Admin protection added
[ ] Firestore Security Rules updated
[ ] Site deployed
[ ] Live ticket submission tested
[ ] Hidden admin dashboard tested
[ ] Gmail reply button tested
```

## Notes For Admins

The public website should only show the landing page and ticket submission.

The hidden admin dashboard is accessed through:

```text
#admin
```

Example:

```text
https://your-site-url.web.app/#admin
```

Admins can:

```text
View submitted tickets
Change ticket status
Mark a ticket as solved
Record who solved it
Record when it was solved
Export tickets as CSV
Reply to students by email
```
