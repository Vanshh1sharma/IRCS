# Indian Red Cross Society - NIET

A React and native Node.js foundation for the Indian Red Cross Society - NIET initiative at Noida Institute of Engineering & Technology.

## Run

1. Copy `.env.example` to `.env` and add `DATABASE_URL` only when database-backed routes are enabled.
2. Run `pnpm install`.
3. Start the API with `pnpm --filter @workspace/backend run dev`.
4. Start the website with `pnpm --filter @workspace/frontend run dev`.

The frontend is available at `http://localhost:5173` and the health endpoint is `http://localhost:5000/api/healthz`.

## Architecture

- Frontend: React, Vite, TypeScript, React Router, Tailwind CSS and Lucide React.
- Backend: native Node.js `http` REST server.
- Database: Supabase PostgreSQL through `pg`; no local database or migrations are used.

Forms and donation processing are intentionally not connected yet. No form claims to submit or store information in this phase. Official organisational information remains marked as a placeholder until supplied.
