# Website audience overlay

`GET /metrika-users?from=YYYY-MM-DD&to=YYYY-MM-DD&step=day|week|month|year`
returns unique users (`ym:s:users`) from counter 32072156 only. The public
dashboard already exposes aggregate business statistics; this endpoint exposes
only anonymous website audience numbers, with no customer IDs or source OAuth.

Production secret: `DASHBOARD_METRIKA_TOKEN`. Set through Supabase Secrets;
never include its value in files, deployment source, browser code or logs.

`supabase functions deploy metrika-users --project-ref zdmhrtwdsreznsjmdads`
uses `supabase/config.toml`. Gateway verification remains enabled; production
accepts the project's existing public publishable key in the `apikey` header.
The existing promo-bot and pricing tables/RPC are untouched.

Dates and group are validated. Time zone is Moscow; only completed days are
requested. Users for each bucket are calculated by the Metrika bytime API, not
summed from daily users. Arbitrary start/end dates, including clipped weeks,
months and years, are requested exactly. Sampling is rejected. No future zeros
are fabricated. Errors return a short code, never upstream diagnostics.

Responses are cached for 10 minutes in a bounded server memory cache, with
deduplication of in-flight requests; browser responses are cached for 5 minutes.
CORS permits the dashboard origin and loopback preview. There are no write
methods, caller-controlled counter IDs, upstream URLs, metrics or filters.

Tests: `node scripts/test-metrika-users.mjs`.
