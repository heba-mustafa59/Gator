# Gator - CLI RSS Feed Aggregator

Gator is a command-line RSS feed reader built with Node.js, TypeScript, and Drizzle ORM. It manages users, tracks feed subscriptions, and runs a background service to scrape articles into a PostgreSQL database.

## Prerequisites
- **Node.js** (v18+)
- **PostgreSQL** instance running locally

## Installation & Setup

1. **Clone & Install**:
   ```bash
   git clone <your-repo-url>
   cd gator
   npm install
   ```

2. **Configure Environment**:
   Create a `~/.gatorconfig.json` file in your home directory:
   ```json
   {
     "db_url": "postgres://username:password@localhost:5432/gator?sslmode=disable",
     "current_user_name": ""
   }
   ```

3. **Run Migrations**:
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

## CLI Commands

Run commands using `npm run start <command>`.

### Auth & Profiles
- `register <username>` - Create a new user profile.
- `login <username>` - Switch to an existing user.
- `users` - List all registered accounts.

### Subscriptions
- `addfeed <name> <url>` - Add and automatically follow a new feed.
- `feeds` - View all feeds in the system.
- `follow <url>` - Follow an existing feed URL.
- `unfollow <url>` - Unfollow a feed URL.
- `following` - List your current feed subscriptions.

### Aggregator & Reader
- `agg <duration>` - Run the background scraper loop (e.g., `agg 1m`). Press `Ctrl + C` to stop.
- `browse [limit]` - View latest scraped articles from followed feeds (defaults to 2).
- `reset` - Clear all data from the database.
