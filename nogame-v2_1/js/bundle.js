// This is a workaround for OneDrive CORS issues with ES modules
// It loads all dependencies in the correct order

(async function() {
  try {
    // Load all files in order
    const sportsbooks = await import('./sportsbooks.js');
    const mockData = await import('./mockData.js');
    const bestOdds = await import('./bestOdds.js');
    const favorites = await import('./favorites.js');
    const gameCard = await import('./gameCard.js');
    
    // Make everything global so app.js can access it
    window.SPORTSBOOKS = sportsbooks.SPORTSBOOKS;
    window.SPORTS = mockData.SPORTS;
    window.getSports = mockData.getSports;
    window.getGames = mockData.getGames;
    window.getLeague = mockData.getLeague;
    window.dateForOffset = mockData.dateForOffset;
    window.getGameById = mockData.getGameById;
    window.getOddsForGame = mockData.getOddsForGame;
    
    window.renderGameCard = gameCard.renderGameCard;
    window.renderExpandedOdds = gameCard.renderExpandedOdds;
    window.renderOddsTable = gameCard.renderOddsTable;
    
    window.toggleFavoriteGame = favorites.toggleFavoriteGame;
    window.isGameFavorited = favorites.isGameFavorited;
    window.getFavorites = favorites.getFavorites;
    window.onFavoritesChange = favorites.onFavoritesChange;
    
    window.compareAmericanOdds = bestOdds.compareAmericanOdds;
    window.getBestOddsByMarket = bestOdds.getBestOddsByMarket;
    window.formatOdds = bestOdds.formatOdds;
    window.formatLine = bestOdds.formatLine;
    
    // Now load the main app
    const app = await import('./app.js');
    
  } catch (err) {
    console.error('Failed to load bundles:', err);
  }
})();
