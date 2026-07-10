# Sports backend public-data export

This directory preserves the data that was publicly readable on the export date. It contains no Supabase service-role key, database password, Auth users, private tables, or storage objects.

Files:

- `metadata.json`: provenance, counts, categories, and the catalog checksum.
- `supabase-servers.json`: all publicly readable rows from `public.servers`, including published server URLs.
- `supabase-matches.json`: all publicly readable rows from `public.matches`.
- `backend-sources.json`: flattened Supabase server URLs and DAMITV embed sources for easier future import.
- `dami-catalog.json`: the complete DAMITV JSON catalog returned for this snapshot, including its published embed/source fields.
- `schema.sql`: idempotent Supabase table, index, grant, and read-only RLS setup.
- `seed.sql`: idempotent inserts/upserts for the two Supabase tables plus the raw catalog snapshot.

## Restore into your own Supabase project

1. Create a Supabase project you control.
2. Open its SQL Editor and run `schema.sql`.
3. Review the URLs and data in `seed.sql`, then run it.
4. Set your deployment's `VITE_SPORTS_SUPABASE_URL` and `VITE_SPORTS_SUPABASE_ANON_KEY` to the new project's public URL and anon key.
5. Never expose a Supabase service-role key in a `VITE_` variable or browser code.

The current app reads `matches` and `servers`. The full DAMITV response is retained in `dami_catalog_snapshots` for possible future migration; the app does not currently read that table.

## Refresh the export

With the source URL and public anon key configured in the ignored local `.env`, run:

```powershell
npm run export:backend
```

This overwrites the JSON and SQL snapshots in this directory. Match schedules, viewer counts, embed URLs, and upstream availability are time-sensitive. Saving a snapshot does not make third-party embeds permanent and does not grant redistribution or streaming rights.
