# Testing ProjectHub

## Local Development Setup

### Database
- PostgreSQL must be running on `localhost:5432`
- Default credentials: `devuser` / `devpass`, database `projectmgmt`
- Run migrations: `cd backend && npx prisma migrate dev`

### Backend
```bash
cd backend && npx ts-node-dev src/index.ts
# Runs on port 4000
# Serves API at /api/* and frontend static files from frontend/dist/
```

### Frontend
```bash
cd frontend && VITE_API_URL="/api" npx vite build
# Builds to frontend/dist/ which is served by the backend
# For development with hot reload: cd frontend && npm run dev (port 3001)
```

### Public Access via Tunnel
```bash
cloudflared tunnel --url http://localhost:4000
# Creates a temporary public URL (changes each restart)
# May need DNS resolution: add the tunnel domain to /etc/hosts
# curl https://dns.google/resolve?name=<domain>&type=A to get the IP
```

## Testing Workflow

1. Start backend server
2. Build frontend with `VITE_API_URL="/api"`
3. Navigate to the app URL
4. Sign up with a fresh account (no pre-set credentials exist)
5. Test: Dashboard → Projects → Create Project → Create Task → Kanban Board → AI Assistant

## Key Test Assertions

### Auth Token Persistence
- After signup/login, navigate to Projects page
- If stuck on "Loading projects...", the auth token is being cleared
- Root cause might be the `/auth/me` endpoint not checking the correct auth header
- The backend accepts both `Authorization` and `X-Authorization` headers as fallback

### AI Assistant Commands
- Create: "Create a high priority task to fix login bug"
- Move: "Move [task name] to In Progress"
- Delete: "Delete the task related to [keyword]"
- Unrecognized input returns help text with examples

## Common Issues

### Cloudflare Tunnel Drops
- Quick tunnels have no uptime guarantee and may drop
- Always restart with `cloudflared tunnel --url http://localhost:4000`
- The URL changes on each restart — share the new one

### CORS for Split Deployment
- When frontend (Netlify) and backend (Vercel) are on different domains, CORS must be configured
- Backend uses `cors({ origin: true, credentials: true, allowedHeaders: [...] })`
- Frontend should use standard `Authorization` header (not `X-Authorization`)

## Devin Secrets Needed
- No secrets required for local testing
- For production deployment: `DATABASE_URL` (Neon PostgreSQL) and `JWT_SECRET`
