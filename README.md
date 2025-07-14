# The BugBase

A modern, full-featured bug tracking system for software development teams.

## Features

- **Bug Management**: Create, track, and manage bugs with rich markdown support
- **Real-time Collaboration**: Live updates, comments, and notifications
- **Advanced Search**: Powerful filtering and saved searches
- **Role-based Access**: Granular permissions for different user types
- **API-First**: RESTful API with comprehensive documentation
- **Modern UI**: Responsive design with dark mode support

## Tech Stack

- **Backend**: Node.js, TypeScript, Express, PostgreSQL, Redis
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Infrastructure**: Docker, Nginx, Socket.io

## Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd BugBase

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start with Docker Compose
docker-compose up -d

# Run migrations
npm run db:migrate

# Start development servers
npm run dev
```

## Documentation

- [Planning](./PLANNING.md) - Project overview and architecture
- [Tasks](./TASK.md) - Current development status and roadmap
- [Deployment](./DEPLOYMENT.md) - Deployment and infrastructure guide

## Contributing

Please read our contributing guidelines before submitting PRs.

## License

[License Type] - see LICENSE file for details