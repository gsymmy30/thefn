# thefunction

### Preview

![thefunction landing preview](./docs/preview-landing.png)

## Getting Started

```bash
npm run dev
```

Open `http://localhost:3000` (or your configured port).

## Environment

Create `.env.local`:

```bash
AUTH_PROVIDER=local
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SQLITE_DB_PATH=data/thefn.sqlite
```

## Notes

- `AUTH_PROVIDER=local` enables fast local account creation without email provider limits.
- Uploaded profile photos and local DB are stored under `data/` and are gitignored.
