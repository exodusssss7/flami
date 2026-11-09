# Security

## Reporting a problem

Open a private security advisory on this repository (Security tab > Report a vulnerability).
Please do not open a public issue for anything that lets someone read other people's chats or take over an account.

## What is and is not secret here

- **No server secrets live in this repo.** There are no service accounts, admin keys or `.env` files. The app is a static site
  that talks to Firebase directly from the browser.
- `app/config.js` (gitignored) holds your Firebase **web** config, a GIPHY key and an optional Metered TURN credential.
  Firebase web keys are not secrets by design, they identify the project. Protection comes from `firestore.rules`.
  Still, treat all three as exposed to anyone who loads your site, and:
  - restrict the Firebase API key by HTTP referrer in Google Cloud Console > APIs and Services > Credentials,
  - keep the Metered and GIPHY keys on free plans so abuse cannot become a bill.
- Never commit `.firebaserc` or any service account JSON. `.gitignore` already blocks both.

## Known limits (honest list)

- Messages are not end-to-end encrypted. Anyone with access to your Firebase project can read them.
- Signup is open. Any signed-in user can read all profiles (name, username, photo) because people search needs it.
- A signed-in user can create a group and add any account to it without that account's consent.
- GIF messages store a URL. A malicious member could post a GIF URL on a server they control to see viewers' IP addresses.
- Calls ring only for people with the app open (no push notifications).
- The Metered free TURN relay is capped at about 500 MB a month.
- There is no Content Security Policy header yet. Firebase SDK modules load from `www.gstatic.com` without subresource integrity.

## Firestore rules summary

Chats, messages and media are readable only by chat members. Writes are field-whitelisted and size-capped. Only a sender can
edit their own text, only admins can rename a group or remove others, and a member can only remove themselves.
Call signals are readable only by the two peers. Deploy the rules with the app: `firebase deploy --only firestore:rules`.
