# Phase 2 — Real Data Integration

## What's Included

### 1. Supabase Edge Function (`odds-proxy`)
Located at: `supabase/functions/odds-proxy/index.ts`

This function:
- Proxies requests to The Odds API
- Keeps your API key secure on the server
- Caches responses to conserve your 500 req/month quota
- Returns quota usage info in response headers

### 2. Updated `apiData.js`
Located at: `docs/js/apiData.js`

This module:
- Calls the Supabase Edge Function (not The Odds API directly)
- Transforms API responses into the format your UI expects
- Includes browser-side caching (30s for scores, 60s for odds)
- Has team abbreviation mappings for NFL, NBA, MLB, NHL
- Supports all major US sports

---

## Deployment Steps

### Step 1: Deploy the Edge Function

Open PowerShell and navigate to your project:

```cmd
cd "C:\Users\amin\Documents\Nogame updated"
```

Copy the edge function file to your Supabase functions directory:

```cmd
mkdir supabase\functions\odds-proxy
copy "path\to\odds-proxy\index.ts" supabase\functions\odds-proxy\index.ts
```

Set the API key as a Supabase secret:

```cmd
npx supabase secrets set ODDS_API_KEY=3196fcd087730b529f32647b5d0fda76
```

Deploy the function:

```cmd
npx supabase functions deploy odds-proxy
```

### Step 2: Update the Website

Copy the new `apiData.js` to your docs folder:

```cmd
copy "path\to\apiData.js" docs\js\apiData.js
```

### Step 3: Update `app.js` to Use Real Data

The existing `app.js` needs to be updated to:
1. Import from the new `apiData.js`
2. Use async/await for data fetching
3. Show loading states while data loads

### Step 4: Push to GitHub

```cmd
git add -A
git commit -m "Phase 2: Connect real odds data via Supabase proxy"
git push origin main
```

GitHub Pages will automatically deploy the changes.

### Step 5: Test

1. Visit https://nogame.dev
2. Open the browser console (F12)
3. You should see messages like:
   ```
   [Odds API] Quota: 3 used, 497 remaining | Cache: MISS
   ```
4. Subsequent page loads should show:
   ```
   [Odds API] Quota: 3 used, 497 remaining | Cache: HIT
   ```

---

## Quota Management

Your free tier gives you 500 requests/month. Here's how we conserve them:

### Server-side cache (Edge Function)
- Sports list: cached 1 hour
- Scores: cached 1 minute
- Odds: cached 2 minutes
- Events: cached 5 minutes

### Browser-side cache (apiData.js)
- Sports list: cached 10 minutes
- Scores: cached 30 seconds
- Odds: cached 1 minute
- Events: cached 2 minutes

### Smart fetching
- "All Sports" only fetches top 7 sports (not all 17)
- Individual sport tabs only fetch that sport's keys
- Odds are only fetched when the user views a sport (lazy loading)

### Estimated usage
- Each page load: ~2-7 API calls (depending on sport selection)
- With caching: ~50-100 unique calls per day
- Monthly estimate: ~1,500-3,000 cached calls → ~100-200 actual API calls
- Well within the 500/month free tier

---

## Architecture

```
Browser (nogame.dev)
    ↓ fetch()
Supabase Edge Function (odds-proxy)
    ↓ fetch() with API key
The Odds API (api.the-odds-api.com)
    ↓ response
Edge Function (caches + forwards)
    ↓ JSON response
Browser (renders games + odds)
```

The API key NEVER leaves the Supabase server.

---

## Troubleshooting

### "ODDS_API_KEY not configured"
Run: `npx supabase secrets set ODDS_API_KEY=your_key_here`

### "API error: 401"
Your API key may be invalid. Check at https://the-odds-api.com/account/

### "API error: 429"
You've exceeded your monthly quota. Wait until next month or upgrade your plan.

### Empty game list
- Check the browser console for error messages
- Verify the Edge Function is deployed: `npx supabase functions list`
- Test the function directly: `curl https://axlybeznzibovvqkllzq.supabase.co/functions/v1/odds-proxy?endpoint=sports`

### CORS errors
The Edge Function includes CORS headers. If you see CORS errors, make sure the function is deployed correctly.

---

## What's Next (Phase 3)

- Match detail pages with full odds comparison
- Player props and futures markets
- H2H, standings, and stats tabs
- Push notifications for odds movements
- WebSocket for real-time score updates
