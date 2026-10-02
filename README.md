# Tuition Media

Tuition Media connects students and guardians with verified teachers. Firebase Authentication manages credentials; profiles live in the Firestore `tutionmedia` collection and tuition requests live in `tuitionPosts`.

## Firebase setup

1. In Firebase Console, enable **Authentication > Sign-in method > Email/Password**.
2. Create a Cloud Firestore database in the same Firebase project.
3. Confirm the `NEXT_PUBLIC_FIREBASE_*` values in `.env` point to that project.
4. Set `ADMIN_PASSWORD` to the admin password and `ADMIN_SESSION_SECRET` to a unique random secret of at least 32 characters in ignored `.env.local`. Never commit these values.
5. Create a Firebase service account and set `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` in `.env.local`. Store the private key with `\n` line breaks; never commit this file. These server credentials are still required for admin data operations.
6. Install the Firebase CLI, select the matching project with `firebase use <project-id>`, and deploy the included rules with `firebase deploy --only firestore:rules`.
7. Restart `npm run dev` after changing environment variables. Set the same server-only variables in Vercel and redeploy.

## Routes

- `/` — role-aware landing page; students can create tuition posts and browse verified teachers, while verified teachers can browse open tuition posts.
- `/auth` — student and teacher registration/sign-in.
- `/student` — create/manage private tuition posts and browse verified teachers.
- `/teacher` — verification status and search/filter for open tuition posts.
- `/teachers` — verified teacher directory (student account required).
- `/admin` — server-validated password sign-in, then account management, teacher verification, and post moderation.

Firestore rules keep student posts private to their owner and make newly submitted posts immediately available to active, verified teachers; existing pending posts are also visible. Tuition posts include a contact number, which is shown to active, verified teachers viewing open posts. Deploy updated rules after changing them with `firebase deploy --only firestore:rules`. Admins can still moderate posts after submission. Teacher listings require an active student and show only approved profiles. Admin data operations use the server-only Firebase Admin SDK and an expiring, signed, HTTP-only cookie.

Admin API access requires the server-configured `ADMIN_PASSWORD` and a signed, expiring, HTTP-only session cookie. Student and teacher sign-in and registration continue to use Firebase Authentication.

## Validation

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Database note

This project uses Firebase Authentication and Cloud Firestore. Prisma does not support Firestore as a datasource and cannot generate a migration for it, so the `firestore.rules` file is the applicable database security/configuration artifact. If a Prisma schema and migrations are required, the persistence target needs to be changed to a Prisma-supported database rather than Firestore.
