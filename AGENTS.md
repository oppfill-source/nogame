# AGENTS.md

This file provides guidance to coding agents (such as Codex) when working with code in this repository.

## Commands

```bash
# Start dev server (Expo Go or simulator)
npx expo start

# Start with cleared cache (use when changing native config or seeing stale errors)
npx expo start --clear

# TypeScript type-check
npx tsc --noEmit

# Install packages (always use --legacy-peer-deps due to react@19.1.0 peer conflict)
npm install <package> --legacy-peer-deps
```

`.npmrc` already contains `legacy-peer-deps=true`, so plain `npm install` works for subsequent installs.

There are no unit tests yet. Type-checking is the primary correctness tool.

## Architecture

### Tech Stack
- **Expo SDK 54** + React Native 0.81.5 + React 19.1.0, New Architecture enabled
- **Expo Router v6** — file-based routing
- **NativeWind v4** — Tailwind CSS via `className` prop
- **Supabase** — Postgres database, auth (email/password), Realtime, Edge Functions
- **TanStack React Query v5** — all server state; Zustand v5 — client-only state
- **The Odds API** — live odds from 40+ bookmakers
- **Claude claude-sonnet-4-6** (via Edge Function) — AI betting picks
- **Expo Notifications** — push alerts for high-value AI picks

### Routing Structure
```
app/
  _layout.tsx              # Root: QueryClientProvider, SafeAreaProvider, auth listener, useNotifications
  (tabs)/
    _layout.tsx            # 5-tab layout (Games, AI Picks, My Bets, Community, Profile)
    index.tsx              # Games feed with sport filter
    ai-picks.tsx           # AI-generated picks, rate-limited refresh
    my-bets.tsx            # Bet tracker (Open / Settled / Stats tabs)
    community.tsx          # Community picks feed + PostPickSheet FAB
    profile.tsx            # User profile + settings
  game/[id].tsx            # Game detail: odds comparison table, AddBetSheet
  bankroll/index.tsx       # Bankroll management, deposit/withdraw, Kelly calc
  community/
    [userId].tsx           # Public user profile
    pick/[pickId].tsx      # Pick detail with real-time comments
  (modals)/
    auth.tsx               # Login / signup modal
```

### State Management Split
- **React Query**: `useBets`, `useGames`, `useAiPicks`, `useCommunityFeed`, individual game/profile queries
- **Zustand (persisted)**: `useBankrollStore` (balance, Kelly fraction), `useAuthStore` (session/user/profile)
- **Zustand (ephemeral)**: `useUIStore` (selectedSport, viewed AI pick IDs, toasts)

### Key Libraries and Files

**`lib/odds-api.ts`** — `getUpcomingGames(sportKey)` → `OddsGame[]`; uses `EXPO_PUBLIC_ODDS_API_KEY`

**`lib/odds-utils.ts`** — `formatOdds`, `calcPayout`, `kellyFraction(winProb, odds, fraction=0.25)`, `impliedProbability`, `findBestOdds`, `normalizeOddsGame`, `formatGameTime`

**`lib/affiliates.ts`** — `openBookmaker(key)` deep-links to sportsbook app, falls back to web URL; `getBookmakerOddsRows(game)` marks best home/away odds with `isBestHome`/`isBestAway` flags

**`lib/ai.ts`** — `refreshAiPicks()` calls Supabase Edge Function; `getCachedAiPicks()` reads non-expired picks from DB ordered by `value_rating` desc

**`constants/sports.ts`** — 17 sports with Odds API key, emoji, short name; exports `SPORTS`, `SPORT_BY_KEY`, `ALL_SPORTS_KEY`

**`constants/affiliates.ts`** — 7 bookmakers with deep links, web URLs, bonus text, rating

### Mock Data Fallbacks
All hooks check for env vars and fall back to mock data so the app runs without any API keys:
- `useGames` — 6 mock games when `EXPO_PUBLIC_ODDS_API_KEY` is absent
- `useAiPicks` — 3 mock AI picks when Supabase is unconfigured
- `useCommunityFeed` — 4 mock community picks
- `game/[id].tsx` — mock game detail for IDs starting with `"mock-"`

### Environment Variables (`.env.local`)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ODDS_API_KEY=       # The Odds API — 500 free requests/month
```

Supabase Edge Functions use secrets set via `supabase secrets set`:
```
ANTHROPIC_API_KEY=              # For generate-ai-picks function
ODDS_API_KEY=                   # Server-side copy for Edge Functions
```

### Supabase Backend
Run migrations against your project with `supabase db push` or via the Supabase dashboard SQL editor.

**Tables**: `profiles`, `bets`, `bankroll_transactions`, `ai_picks`, `picks`, `pick_likes`, `pick_comments`, `follows`, `bookmakers`

RLS is enabled on all tables. Key policies:
- `profiles` — public read, self-write
- `bets` / `bankroll_transactions` — owner only
- `picks` / `pick_comments` / `pick_likes` / `follows` — public read, authenticated write own

Realtime is enabled on `picks` and `pick_comments` for live updates in `pick/[pickId].tsx`.

**Edge Functions** (in `supabase/functions/`):
- `generate-ai-picks` — fetches live odds → calls Claude → inserts into `ai_picks` → triggers push for picks with `value_rating >= 8`. Rate-limited to 1 call per 15 min per user.
- `send-push-notification` — broadcasts to all push tokens or a specific user via Expo Push API

Deploy with: `supabase functions deploy generate-ai-picks`

### Odds API Quota Conservation
- `staleTime: 5 * 60_000` in `useGames` — no refetch within 5 minutes
- When "All Sports" is selected, only the top 3 sports are fetched (not all 17)
- `game/[id].tsx` reuses the full sport list query instead of a per-game endpoint

### American Odds Convention
All odds throughout the app are American format (integers: -110, +150). `formatOdds` adds the `+` prefix for positives. `calcPayout(stake, odds)` returns total payout including stake.

### Kelly Criterion
Default Kelly fraction is 0.25 (quarter-Kelly). User can change it in bankroll settings. `kellyFraction(winProb, americanOdds, fraction)` in `lib/odds-utils.ts` returns the bet size as a decimal of bankroll.
