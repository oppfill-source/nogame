# NoGame — Live Scores & Odds Comparison Platform

A fast, responsive live-scores and best-odds-comparison website modeled after Flashscore / Eredmenyek, tailored for US sports betting.

## Architecture Overview

### Tech Stack
- **No framework** — Vanilla HTML + ES modules + CSS. Single-page application with client-side routing.
- **CSS custom properties** — Design tokens in `:root` define the entire dark theme.
- **Event delegation** — All interactive behavior uses event bubbling to a single handler per region.
- **Deterministic mock data** — Shaped exactly like the real API contract; swap `mockData.js` for a real feed.

### File Structure

```
index.html                 # Main live-scores dashboard
landing.html              # Marketing page (your original index.html)
styles.css                # Existing design tokens and global styles
css/scores.css            # Scores-page specific styles

js/
  app.js                  # Page controller (state, render, event handlers)
  gameCard.js             # GameCard component (render functions)
  bestOdds.js             # American-odds math utilities
  mockData.js             # Deterministic mock data (shapes the API contract)
  sportsbooks.js          # Sportsbook provider registry
  favorites.js            # localStorage-backed favorites store
```

### Data Flow

```
mockData.js (shapes Sport, League, Team, Game, OddsMarket)
    ↓
app.js (state + render)
    ↓
gameCard.js (renders Game rows/cards + expandable odds)
    ↓ uses utilities from ↓
bestOdds.js (American-odds comparison, line-aware grouping)
sportsbooks.js (book metadata)
favorites.js (localStorage persistence)
```

## Key Concepts

### 1. American Odds Comparison

**Core Principle**: "Higher is always better for the bettor" (after normalization).

**Implementation** in `bestOdds.js`:
- `normalizeAmericanOdds(odds)` → convert to implied probability, negate → score where higher = better payout
- `compareAmericanOdds(a, b)` → -1/0/1 comparator
- `getBestOddsByMarket(odds, marketType)` → groups odds by (marketType, selection, **line**), finds best in each group

**Key behavior**: 
- Spreads and totals with different lines are **never cross-compared**
- If two books tie for best, **both are marked Best**
- `-2.5 at -105` and `-3.0 at -100` are in different groups; each has its own winner

### 2. Game Card (Reusable Component)

**Desktop**: Compact row with league grouping
- Left: status / time
- Middle: teams, scores (away above home)
- Right: odds preview (away odds | home odds | expand chevron)
- Far right: favorite star

**Mobile**: Full-width card
- Teams and scores
- Odds preview below (full width)
- Favorite star

**Expandable**:
- Click anywhere on the card → expands odds panel
- Market tabs: Moneyline / Spread / Total
- Full sportsbook table with best odds bolded + green highlight
- Last updated timestamp + responsible gambling disclaimer

### 3. State Management

Global state object in `app.js`:
```javascript
state = {
  sport: 'all|nfl|nba|...',
  dayOffset: -2 to +6,
  tab: 'all|live|odds|finished|scheduled|favorites',
  expandedGameId: null,
  searchQuery: ''
}
```

**Rendering**: `render()` is the single source of truth. Called after every state change.
**Persistence**: Favorites only; localStorage via `favorites.js`.

### 4. Event Handling

All interactive behavior uses a single delegated listener per region:

```javascript
feed.addEventListener('click', e => {
  const favBtn = e.target.closest('[data-action="toggle-fav"]');
  if (favBtn) { /* handle favorite */ }
  
  const oddsToggle = e.target.closest('[data-action="toggle-odds"]');
  if (oddsToggle) { /* expand odds */ }
  
  const card = e.target.closest('.gc');
  if (card && !e.target.closest('button')) { /* click row → expand */ }
});
```

This keeps the codebase lightweight and maintainable.

## Migrating to a Real API

When you have real sports data and odds feeds:

### Step 1: Replace `mockData.js`

The module exports:
- `getSports()` → `Sport[]`
- `getLeagues(sportId)` → `League[]`
- `getGames({ sport, dayOffset, status, league })` → `Game[]`
- `getGameById(gameId)` → `Game | null`
- `getOddsForGame(gameId)` → `OddsMarket[]`

Replace the generator functions with real API calls. Keep the return shapes identical.

### Step 2: Add API keys

Create a `config.js`:
```javascript
export const API_CONFIG = {
  SPORTS_DATA_API_KEY: 'your-api-key',
  ODDS_API_KEY: 'your-api-key',
  REAL_TIME_ENDPOINT: 'wss://...'  // if using WebSocket
}
```

### Step 3: Implement WebSocket for true live updates

Currently uses polling (`setInterval`, 30s). For production:
1. Keep polling as a fallback
2. Add a WebSocket connection to a real-time feed
3. Update `app.js` to listen for live events instead of polling

### Step 4: Add affiliate links

In `sportsbooks.js`, add:
```javascript
{
  id: 'dk',
  name: 'DraftKings',
  affiliateUrl: 'https://draftkings.com?ref=...'
}
```

Then in `gameCard.js`, wrap book names in links when rendering the odds table.

## Responsible Gambling Compliance

The footer and all odds displays include:
- "Odds informational purposes only"
- "Availability varies by state"
- National Problem Gambling Helpline: 1-800-522-4700
- No betting CTAs (only app download links)
- Clear disclaimer that NoGame is an analytics tool only

## Testing & Validation

### Unit Tests (Included)
Run these manually to verify odds math:
```bash
node -e "
import('./js/bestOdds.js').then(m => {
  console.log('Testing: +135 vs +120');
  console.log('Result:', m.compareAmericanOdds(135, 120)); // expect 1
});
"
```

### Manual Testing
1. **Live tab**: Only live/halftime games show
2. **Search**: Type "lakers" → filters to LAL games
3. **Favorites**: Click star → persists in localStorage
4. **Odds markets**: Click Spread tab → shows lines grouped independently
5. **Mobile**: Use DevTools device emulation; odds preview sits below teams
6. **Responsible gambling**: Footer always visible, disclaimers in odds panel

## Performance Optimization

**Already implemented**:
- Deterministic mock data (no API calls for demo)
- Event delegation (one listener per region, not per game)
- CSS transitions for smooth UX (collapse, fade, scroll)
- Lazy odds rendering (load on expand, not on initial render)
- Live-sync indicator (visible feedback without flashing)

**Future opportunities**:
- Intersection Observer for lazy-loading images (sportsbook logos)
- Service Worker for offline fallback
- IndexedDB for caching odds history
- Virtual scrolling if games exceed 100+ per day (unlikely)

## Accessibility

- Semantic HTML (`<button>`, `<article>`, `role="tablist"`)
- ARIA attributes (`aria-label`, `aria-expanded`, `aria-haspopup`)
- Keyboard support (Escape to close dropdowns, Tab navigation)
- Color contrast (WCAG AA in dark mode)
- Focus indicators (visible outline on interactive elements)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

Requires ES modules and modern DOM APIs (no IE11).

## Contributing

### Adding a new sport

1. Add to `SPORTS` in `mockData.js`
2. Add leagues in `LEAGUES` (link to sport via `sportId`)
3. Add teams in `TEAMS` (link to league via `leagueId`)
4. Add schedule template in `LEAGUE_SCHEDULE` (for mock generation)
5. Update `baseTotalForSport()` if this sport has a total market

### Adding a new sportsbook

1. Add to `SPORTSBOOKS` in `sportsbooks.js` (metadata + states)
2. Update state availability lists if needed
3. Odds are auto-generated per book in `mockData.js`; no changes needed

### Changing the odds display

Edit `gameCard.js`:
- `renderGameCard()` — card structure
- `renderExpandedOdds()` — modal structure
- `renderOddsTable()` — table rows

## Known Limitations (Phase 1)

- **No player props** — Moneyline, Spread, Total only
- **No fixtures/futures** — Next week's odds not yet supported
- **No lineups/injuries** — News tab not yet implemented
- **No H2H/standings** — Match detail pages not yet built
- **No affiliate links** — Placeholder books only (legal/compliance review needed before launch)
- **Mock data only** — No real sports data feed connected

These are Phase 2+ features.

## Questions?

See the code comments throughout for implementation details. The architecture is designed to be readable and maintainable.
