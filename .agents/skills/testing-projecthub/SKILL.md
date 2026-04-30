# Testing ProjectHub

## Local Development Setup

### Prerequisites
- PostgreSQL running on localhost:5432
- Node.js installed
- Local database: `projectmgmt` with user `devuser` / password `devpass`

### Start Servers
```bash
# Backend (port 4000)
cd backend && npm run dev
# Uses: npx ts-node-dev --respawn src/index.ts

# Frontend (port 3000, proxies /api to localhost:4000)
cd frontend && npm run dev
# Uses: npx vite
```

### Database Migrations
```bash
cd backend && npx prisma migrate deploy
```

## Devin Secrets Needed
- No secrets required for local testing (uses local PostgreSQL with devuser/devpass)
- For production Neon database: `DATABASE_URL` secret needed

## Navigation Paths
- **Dashboard**: `/` (shows task stats + recent projects)
- **Projects List**: `/projects`
- **Project Detail**: `/projects/:id` (tasks, members, add member form)
- **Kanban Board**: `/projects/:id/kanban`
- **AI Assistant**: `/ai` (chat interface)
- **Login**: `/login`
- **Signup**: `/signup`

Sidebar links: Dashboard, Projects, AI Assistant. Logout button in sidebar footer.

## Multi-User Testing

To test team collaboration features, you need two user accounts. The approach:
1. Sign up User A via the browser UI
2. Create User B via curl (to avoid logging out User A):
   ```bash
   curl -s -X POST http://localhost:4000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Bob","email":"bob@test.com","password":"password123"}'
   ```
3. Use browser logout/login to switch between users
4. Alternatively, save Bob's JWT token from the signup response and use curl with `Authorization: Bearer <token>` for API-level testing

## AI Assistant Commands

The AI uses deterministic NLP parsing (no LLM API needed). Supported commands:

### Create
- `Create a high priority task to fix login bug`
- `Create a task called deploy API assigned to Bob` (create + assign)

### Move/Update
- `Move payment task to In Progress`
- `Move fix login to Done`

### Delete
- `Delete the task related to UI bug`

### Assign
- `Assign setup CI pipeline to Alice`
- Name matching is fuzzy: exact match → partial match → email match

### Unassign
- `Unassign login bug`

### List
- `Show all tasks` — lists all tasks across accessible projects
- `Show my tasks` / `List my tasks` — tasks created by current user
- `List assigned to me` — tasks assigned to current user
- `List unassigned tasks` — tasks with no assignee

## Key Testing Scenarios

### Team Collaboration Flow
1. User A creates project → auto-added as OWNER
2. User A adds User B by email → User B becomes MEMBER
3. User B sees shared project in their project list and dashboard
4. Both users can create/edit/move tasks in the shared project
5. Task assignee dropdown shows all project members

### AI Cross-Team Access
- AI commands search tasks across ALL projects the user has access to (owned + member)
- A MEMBER can move/assign/delete tasks in projects they don't own
- Assignment validation: AI checks if assignee is a project member before assigning
- If assignee name doesn't match, AI lists available team members

## Common Issues
- If the backend shows "address already in use" on port 4000, kill the existing process first
- The AI assistant might not find tasks if the search term is too short or ambiguous — use distinctive task names for testing
- Dashboard stats might show stale data if the page was loaded before task changes — navigate away and back to refresh
- The frontend proxies `/api` requests to the backend via Vite config — if the backend is down, you'll see network errors in the browser console
