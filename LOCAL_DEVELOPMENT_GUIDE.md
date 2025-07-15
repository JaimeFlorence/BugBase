# 🚀 BugBase Local Development Quick Start Guide

This guide will help you get BugBase running on your local machine in just a few minutes!

## Prerequisites

Before starting, make sure you have these installed:

1. **Docker Desktop** (includes Docker and Docker Compose)
   - [Download for Windows/Mac](https://www.docker.com/products/docker-desktop/)
   - For Linux: `sudo apt install docker.io docker-compose` (Ubuntu/Debian)

2. **Node.js** (version 16 or higher)
   - [Download from nodejs.org](https://nodejs.org/)
   - Or use nvm: `nvm install 18`

3. **Git** (to clone the repository)
   - [Download Git](https://git-scm.com/downloads)

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/JaimeFlorence/BugBase.git
cd BugBase
```

## Step 2: Start the Database Services

First, let's start PostgreSQL, Redis, and MinIO using Docker:

```bash
# Start the database services
docker-compose up -d

# Verify services are running
docker-compose ps
```

You should see:
- `bugbase-postgres` running on port 5432
- `bugbase-redis` running on port 6379
- `bugbase-minio` running on ports 9000/9001

## Step 3: Set Up the Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file for local development
cat > .env << EOF
# Database
DATABASE_URL="postgresql://bugbase:bugbase_dev@localhost:5432/bugbase_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secret
JWT_SECRET="your-local-dev-secret-key-change-in-production"

# Server
PORT=3001
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
EOF

# Create uploads directory
mkdir -p uploads

# Run database migrations
npx prisma migrate dev

# Seed the database with sample data
npx prisma db seed

# Start the backend server
npm run dev
```

The backend should now be running at `http://localhost:3001`

## Step 4: Set Up the Frontend

Open a new terminal window:

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
EOF

# Start the frontend development server
npm run dev
```

The frontend should now be running at `http://localhost:5173`

## Step 5: Access BugBase

1. Open your browser and go to `http://localhost:5173`
2. You'll see the login page

### Default Test Users (from seed data):

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | password123 | Admin |
| pm@example.com | password123 | Project Manager |
| dev@example.com | password123 | Developer |
| qa@example.com | password123 | QA Tester |
| reporter@example.com | password123 | Reporter |

## 🎉 You're Ready!

You can now:
- Create and manage bugs
- Add comments and attachments
- Create projects
- Manage users (as admin)
- See real-time updates

## Common Commands

### Backend Commands
```bash
cd backend

# Run in development mode (auto-restart on changes)
npm run dev

# Run tests
npm test

# Check types
npm run typecheck

# Lint code
npm run lint

# Database commands
npx prisma studio     # Open database GUI
npx prisma migrate dev # Run migrations
npx prisma db seed    # Reseed database
```

### Frontend Commands
```bash
cd frontend

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Commands
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart postgres
```

## Troubleshooting

### Port Already in Use?
If you get "port already in use" errors:

```bash
# Check what's using the ports
lsof -i :3001  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process using the port
kill -9 <PID>
```

### Database Connection Issues?
```bash
# Make sure PostgreSQL is running
docker-compose ps

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Can't Install Dependencies?
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Frontend Can't Connect to Backend?
- Make sure backend is running on port 3001
- Check the `VITE_API_URL` in frontend/.env
- Check browser console for CORS errors

## Next Steps

- Read the [User Guide](USERS_GUIDE.md) to learn all features
- Check [TESTING.md](TESTING.md) to run the test suite
- See [PLANNING.md](PLANNING.md) for architecture details
- For production deployment, see [HOSTINGER_DEPLOYMENT_GUIDE.md](HOSTINGER_DEPLOYMENT_GUIDE.md)

## Need Help?

- Check the browser console (F12) for frontend errors
- Check terminal output for backend errors
- PostgreSQL GUI: run `npx prisma studio` in backend folder
- MinIO console: http://localhost:9001 (minioadmin/minioadmin)