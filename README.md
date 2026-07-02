# School Portal

A multi-role school management platform:

- **`/web`** — Next.js (TypeScript + Tailwind) app. Full Admin control panel,
  plus Class Teacher / Subject Teacher / Parent dashboards.
- **`/mobile`** — Flutter app for Teacher and Parent roles (Admin uses the web
  app only).
- **`/firebase`** — Firebase backend: Firestore security rules, Storage
  rules, and Cloud Functions.

Backend is entirely Firebase: Auth, Firestore, Cloud Functions, Storage, and
Cloud Messaging (push notifications).

## Current status

This is being built incrementally. So far:

- [x] Repo scaffolding (this commit)
- [ ] Auth + Firestore security rules + role-claims Cloud Functions
- [ ] Admin web module (students, teachers, parents, classes, attendance, exams, fees, announcements)
- [ ] Class Teacher / Subject Teacher web module
- [ ] Parent web module
- [ ] Flutter mobile app (Teacher + Parent flows)

## Prerequisites you need to set up

I can write all the application code, security rules, and Cloud Functions,
but I can't create a real Firebase project or generate live API
keys/credentials for you — that requires your own Google/Firebase account.
Before running this for real, you'll need to:

1. **Create a Firebase project** at https://console.firebase.google.com (or
   tell me a project ID you already have).
2. In the project, enable: **Authentication** (Email/Password provider),
   **Firestore**, **Storage**, and **Cloud Messaging**.
3. Set the project ID in `.firebaserc` (replace
   `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).
4. Add a **Web app** in Firebase project settings, copy its config values
   into `web/.env.local` (copy from `web/.env.local.example`).
5. For mobile: install the [FlutterFire CLI](https://firebase.flutter.dev/docs/cli/)
   and run `flutterfire configure` from inside `/mobile` — this generates
   `lib/firebase_options.dart` with your real project values and creates the
   native `android/`, `ios/` platform folders (via `flutter create .` if you
   haven't already; those folders aren't checked into this repo since they're
   large generated boilerplate specific to your machine/Flutter version).

## Running the web app

```bash
cd web
npm install
cp .env.local.example .env.local   # then fill in your Firebase config
npm run dev
```

To develop against the local Firebase emulators instead of a live project,
set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local` and run the
emulators (below) alongside `npm run dev`.

## Running Cloud Functions / emulators

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
cd firebase/functions && npm install && cd ../..
firebase emulators:start
```

This starts local Auth, Firestore, Storage, Functions, and Hosting
emulators (see `firebase.json`) without touching a live project.

## Running the mobile app

```bash
cd mobile
flutter create .          # generates android/ios/etc. platform folders (first time only)
flutterfire configure     # generates lib/firebase_options.dart for your project
flutter pub get
flutter run
```

## Deploying

```bash
firebase deploy --only firestore:rules,storage,functions
firebase deploy --only hosting   # after `npm run build` in /web
```
