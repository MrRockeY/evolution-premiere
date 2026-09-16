# Evolution Fitness — Patna City

Premium website and member platform (Evolution OS) for Evolution Fitness Gym Unisex Advance, Jauganj, Patna City.

## Features

- Public marketing site with memberships, enquiry form (WhatsApp), and location
- Member authentication (sign in / sign up)
- Owner dashboard: revenue, members, plans, fees, expenses, attendance, templates, advice
- Member dashboard: profile, membership, workouts, diet, exercises, check-in, progress, Ask Trainer

## Stack

- React 19 + TanStack Start / Router / Query
- Tailwind CSS 4 + Vite 8
- Supabase (Auth + Postgres)

## Setup

1. Copy `.env.example` to `.env` and add your Supabase project URL and publishable key.
2. Run `supabase/schema.sql` once in the Supabase SQL Editor.
3. Install and start:

```sh
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run db:schema` | Apply schema via Supabase access token |
| `npm run db:auth-urls` | Configure Auth redirect URLs for production |

## Production

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your host (or use `.env.production`). Configure Supabase Auth Site URL and redirect allow-list to your live domain.

## Contact

Evolution Fitness Gym Unisex Advance · Jauganj, Kanghan Ghat, Patna City · 8507214841
