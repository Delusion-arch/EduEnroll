# EduEnroll

A student registration and course enrollment web app with separate student and admin sides. Students sign up, browse courses and request enrollment. Admins review requests, track attendance and see reports.

I built it as a second take on the student registration problem, this time with a serverless backend (Firebase) instead of my own Express server. The Express + SQLite version is in [outr-student-portal](https://github.com/Delusion-arch/outr-student-portal).

## What it does

**Students**
- Create a profile and complete registration
- Browse available courses and request enrollment
- Track the status of each request (pending / approved)
- See their own attendance history

**Admins**
- Approve or reject enrollment requests
- Add and manage courses, with capacity limits
- Take daily attendance per course
- Dashboard with totals, attendance performance and course feedback charts

## Tech stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS 4 and shadcn/ui components
- Firebase Authentication and Cloud Firestore
- Recharts for the dashboard charts

## Project layout

```
src/
  components/   Register, StudentDashboard, AdminDashboard, Profile, ui/
  lib/          Firebase setup and helpers
firestore.rules Firestore security rules (role-based access)
docs/           Data model (users, courses, enrollments, attendance, feedback)
```

## Run it locally

You need Node.js 20+ and a Firebase project with Authentication and Firestore turned on.

```bash
git clone https://github.com/Delusion-arch/EduEnroll.git
cd EduEnroll
npm install
cp .env.example .env   # fill in your Firebase web app values
npm run dev            # http://localhost:3000
```

Deploy the rules in `firestore.rules` to your Firebase project so role checks work.

## Run it with Docker

```bash
cp .env.example .env   # same Firebase values as above
docker compose up --build
```

Then open http://localhost:8080. The image builds the app with Vite and serves the static files with nginx. Firebase values are passed in as build arguments because Vite bakes them into the bundle at build time.

## Notes

- Access control lives in `firestore.rules`, not only in the UI. Students can only read and write their own records.
- Next on my list: automated tests and a CI pipeline that builds the Docker image on every push.
