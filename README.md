# sczor

sczor is a salon management application built with Next.js App Router, Prisma ORM, NextAuth credentials auth, and Tailwind CSS.

## Features

- Multi-tenant salon setup
- Appointments, customers, services, staff
- Attendance management and reports
- POS and billing with invoices
- Loyalty program and member tiers
- Reports and analytics dashboards
- Settings module for profile, hours, billing, team, and subscription

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Prisma ORM 7 + PostgreSQL
- NextAuth (credentials)
- Tailwind CSS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Push database schema:

```bash
npm run db:push
```

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Seed demo data:

```bash
npm run db:seed
```

6. Start development server:

```bash
npm run dev
```

## Environment Variables

Define these variables in `.env`:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - random secret for auth sessions
- `NEXTAUTH_URL` - app URL (for local: `http://localhost:3000`)

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - run ESLint
- `npm run db:push` - sync Prisma schema to database
- `npm run db:studio` - open Prisma Studio
- `npm run db:seed` - seed demo tenant/data

## Demo Credentials

After seeding:

- Email: `demo@sczor.com`
- Password: `demo123`
