# Duty Doctor Roster

Monthly emergency-department roster generator built with Node.js, TypeScript, raw PostgreSQL queries, and React.

## Setup

1. Create a Supabase project and run [`supabase/duty-doctor-roster-schema.sql`](supabase/duty-doctor-roster-schema.sql) in the SQL editor.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to the Supabase connection string.
3. Start the API: `cd backend; npm install; npm run dev`.
4. Start the UI in a second terminal: `cd frontend; npm install; npm run dev`.

The API defaults to `http://localhost:5000`. Set `VITE_API_URL` when the API is deployed elsewhere.