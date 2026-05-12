// supabase/functions/odds-proxy/index.ts
// Secure proxy for The Odds API — keeps the API key on the server
// Deploy: supabase functions deploy odds-proxy
// Set secret: supabase secrets set ODDS_API_KEY=3196fcd087730b529f32647b5d0fda76

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY') || '';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// In-memory cache to conserve API quota (500 req/month)
const cache = new Map<string, { data: unknown; expires: number }>();

// Cache durations (in seconds)
const CACHE_TTL: Record<string, number> = {
  sports:  3600,     // 1 hour — sports list rarely changes
  scores:  60,       // 1 minute — live scores need freshness
  odds:    120,      // 2 minutes — odds update frequently but quota is limited
  events:  300,      // 5 minutes — event list is fairly stable
};

function getCacheTTL(endpoint: string): number {
  for (const [key, ttl] of Object.entries(CACHE_TTL)) {
    if (endpoint.includes(key)) return ttl;
  }
  return 120; // default 2 minutes
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!ODDS_API_KEY) {
    return new Response(JSON.stringify({ error: 'ODDS_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || '';
    const params = url.searchParams.get('params') || '';

    // Whitelist allowed endpoints to prevent abuse
    const allowedEndpoints = [
      'sports',
      'scores',
      'odds',
      'events',
    ];

    // Validate endpoint format: "sports", "sports/{sportKey}/scores", etc.
    const endpointParts = endpoint.split('/');
    if (!allowedEndpoints.some(a => endpointParts.includes(a) || endpointParts[0] === a)) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache
    const cacheKey = `${endpoint}?${params}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cache-Expires': new Date(cached.expires).toISOString(),
        },
      });
    }

    // Build the API URL
    const apiUrl = `${ODDS_API_BASE}/${endpoint}?apiKey=${ODDS_API_KEY}&${params}`;
    
    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ 
        error: 'API request failed', 
        status: apiResponse.status,
        details: errorText,
      }), {
        status: apiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await apiResponse.json();

    // Extract quota info from response headers
    const remainingRequests = apiResponse.headers.get('x-requests-remaining');
    const usedRequests = apiResponse.headers.get('x-requests-used');

    // Cache the response
    const ttl = getCacheTTL(endpoint);
    cache.set(cacheKey, {
      data,
      expires: Date.now() + ttl * 1000,
    });

    // Clean expired cache entries periodically
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (val.expires < now) cache.delete(key);
      }
    }

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Requests-Remaining': remainingRequests || 'unknown',
        'X-Requests-Used': usedRequests || 'unknown',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
