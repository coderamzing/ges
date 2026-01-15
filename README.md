## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- PostgreSQL database
- Git

### Step-by-Step Setup

#### 1. Clone the repository

```bash
git clone <repository-url>
cd ges
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Set up environment variables

Create a `.env` file in the root directory:

```bash
touch .env
```

Add the following environment variables to `.env`:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/ges?schema=public"

# JWT Secret (change this to a strong random string in production)
JWT_SECRET="your-secret-key-change-in-production"

# Server Port (optional, defaults to 3000)
PORT=3000
```

**Note:** Replace `username`, `password`, and database name `ges` with your actual PostgreSQL credentials.

#### 4. Create PostgreSQL database (if not exists)

```bash
# Connect to PostgreSQL and create database
psql -U postgres
CREATE DATABASE ges;
\q
```

Or using a single command:

```bash
createdb -U postgres ges
```

#### 5. Generate Prisma Client

```bash
npx prisma generate
```

#### 6. Run database migrations

This will create all the tables in your database based on the Prisma schema:

```bash
npx prisma migrate dev --name add_hasReploe_to_camp_ivniation
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "ges", schema "public" at "localhost:5432"

The migration `20260111153738_add_campaign_relations` was modified after it was applied.
We need to reset the "public" schema at "localhost:5432"

You may use prisma migrate reset to drop the development database.
All data will be lost.
 init
npx prisma validate
```

**For production environments**, use:

```bash
npx prisma migrate deploy
```

#### 7. Verify migration status (optional)

Check that your database schema is up to date:

```bash
npx prisma migrate status
```

#### 8. (Optional) Seed the database

If you have seed data, run:

```bash
npx prisma db seed
```

## Running the Application

### Development mode

```bash
npm run start:dev
```

The application will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Watch mode (with hot-reload)

```bash
npm run start:dev
```

### Production mode

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

### API Documentation

Once the application is running, you can access the Swagger API documentation at:

```
http://localhost:3000/api/docs
```

## Database Management

### View database with Prisma Studio

```bash
npx prisma studio
```

This will open Prisma Studio in your browser where you can view and edit data.

### Create a new migration

After modifying `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name <migration-name>
```

### Reset the database (⚠️ WARNING: This will delete all data)

```bash
npx prisma migrate reset
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

# Use Cat to Pipe the File
This bypasses the directory permission issue by reading the file as bb8 and "piping" the content into the psql command.
```bash
cat ges-local.sql | sudo -u postgres psql -d ges
```

# TEST USER
email - admin@ges.io





# Connect to the ges database using connection URL
```bash
psql postgresql://postgres:root@localhost:5432/ges
```

# List all tables in the database
```bash
\dt
```


# Import ges.sql(or any file) database dump
```bash
psql "postgresql://postgres:root@localhost:5432/ges" -f ~/Downloads/ges.sql
```

# Import ges-local.sql using postgres user (alternative)
```bash
cat ges-local.sql | sudo -u postgres psql -d ges
```

# Login as postgres user and connect to database
```bash
sudo -i -u postgres psql -d ges
```

# Verify tables after import
```bash
\dt
```

# Fix campaign delete logic (code change)(if getting any issue take backend first)
- Fixed delete campaign issue (delete all related records)
- Fixed delete campaign template issue

# Sync Prisma schema with existing database
```bash
npx prisma db pull
npx prisma generate
npx prisma studio
```

