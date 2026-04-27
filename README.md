# ProjectHub - Jira-like Project Management App

A full-stack project management application with Kanban boards and an AI-powered task assistant.

## Tech Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Natural language task management assistant

## Features

- **Authentication**: JWT-based signup/login
- **Projects**: Create and manage multiple projects
- **Tasks**: Full CRUD with title, description, status, and priority
- **Kanban Board**: Drag-and-drop tasks across To Do, In Progress, and Done columns
- **Dashboard**: Task statistics and overview
- **AI Assistant**: Natural language commands for task management
  - "Create a high priority task to fix login bug"
  - "Move payment task to In Progress"
  - "Delete the task related to UI bug"

## Project Structure

```
SE_PROJ/
├── backend/
│   ├── prisma/           # Database schema & migrations
│   ├── src/
│   │   ├── lib/          # Prisma client
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/       # API routes (auth, projects, tasks, ai)
│   │   └── index.ts      # Express app entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios API client
│   │   ├── components/   # Layout components
│   │   ├── context/      # Auth context
│   │   ├── pages/        # Page components
│   │   ├── types/        # TypeScript types
│   │   └── App.tsx       # Router & app entry
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend
cp .env.example .env
# Update DATABASE_URL in .env with your PostgreSQL credentials
npm install
npx prisma migrate dev
npm run dev
```

The backend runs on `http://localhost:4000`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and proxies API calls to the backend.

### Environment Variables

#### Backend (.env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `PORT` | Server port (default: 4000) |
| `OPENAI_API_KEY` | OpenAI API key (optional, for enhanced AI) |

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project with tasks
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List tasks (optional `?projectId=`)
- `GET /api/tasks/stats` - Get task statistics
- `GET /api/tasks/:id` - Get task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### AI Assistant
- `POST /api/ai/command` - Process natural language command
