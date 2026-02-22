# FENICE Quick Start

Zero to running in 2 minutes.

## Prerequisites

- **Node.js 22+** -- [Download](https://nodejs.org/)
- **Docker** -- [Download](https://www.docker.com/) (for MongoDB)
- **Git** -- [Download](https://git-scm.com/)

## Steps

### 1. Clone the Repository

```bash
git clone https://github.com/formray/fenice.git
cd fenice
```

### 2. Run Setup

```bash
./setup.sh
```

This will:
- Verify Node.js 22+ and Docker are installed
- Install backend and client dependencies via `npm ci`
- Create `.env` from `.env.example` (if not present)
- Create `client/.env` from `client/.env.example` (if not present)

### 3. Start Development

```bash
./dev.sh
```

This will:
- Start MongoDB 7 via Docker Compose
- Wait for MongoDB to be ready
- Start the FENICE backend server on port 3000
- Start the 3D client on port 5173

### 4. Explore the API

Open your browser:

| URL                                | What You'll See                          |
| ---------------------------------- | ---------------------------------------- |
| http://localhost:5173              | FENICE 3D World client (M1 static city) |
| http://localhost:3000/docs          | Scalar interactive API documentation     |
| http://localhost:3000/docs/llm      | LLM-readable Markdown documentation      |
| http://localhost:3000/openapi       | Raw OpenAPI 3.1 JSON specification       |
| http://localhost:3000/api/v1/health | Health check endpoint                    |
| http://localhost:3000/api/v1/mcp    | MCP discovery manifest for AI agents     |

### 5. Try the API

Register a user:
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "fullName": "Test User",
    "password": "securepassword123"
  }'
```

Login:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

Use the `accessToken` from the response to access protected endpoints:
```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <your-access-token>"
```

Set the client world token:
```bash
echo "VITE_WS_TOKEN=<your-access-token>" > client/.env
```

Then refresh `http://localhost:5173` to connect the 3D world client to `GET /api/v1/world-ws`.

## Other Commands

```bash
./stop.sh      # Stop MongoDB and all Docker services
./reset.sh     # Full clean: remove node_modules, dist, Docker volumes, reinstall

npm run test   # Run all tests
npm run build  # Build for production
```

## Next Steps

- Read [CLAUDE.md](CLAUDE.md) for full project context
- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architecture decisions
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes
- Read [ROADMAP.md](ROADMAP.md) for future plans
