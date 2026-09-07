# Spotify Recommendations API

A Vercel serverless function that proxies Spotify's Recommendations API for the Flixo bot's autoplay feature.

## Features

- **In-memory caching** — Reduces Spotify API calls with configurable TTL
- **Multi-seed support** — Up to 5 seed tracks + 5 genre seeds
- **Audio feature filters** — Filter by energy, valence, danceability, tempo, etc.
- **Blacklist filter** — Exclude specific artists from results
- **Retry logic** — Automatic retry with backoff on rate limits (429)
- **Audio features endpoint** — Get audio features for recommended tracks
- **Health check** — Monitor API and token status

## Setup

### 1. Create a Spotify App

1. Go to https://developer.spotify.com/dashboard
2. Click **Create App**
3. Name it anything (e.g. "Flixo Recommendations")
4. Set the **Redirect URI** to `http://localhost:3000/callback`
5. Copy your **Client ID** and **Client Secret**

### 2. Deploy to Vercel

```bash
# Clone or download this folder
cd spotify-recs-api

# Deploy to Vercel
vercel --prod
```

Or connect the repo to Vercel via GitHub for automatic deployments.

### 3. Set Environment Variables

In your Vercel dashboard, add:

| Variable | Value |
|----------|-------|
| `SPOTIFY_CLIENT_ID` | Your Spotify Client ID |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify Client Secret |

### 4. Update Bot Config

In your bot's `src/utils/autoplay.js`, set the `REC_API`:

```js
const REC_API = 'https://your-project.vercel.app/api/recommendations';
```

## API Endpoints

### `GET /api/recommendations`

Fetches track recommendations based on seed tracks and/or genres.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoint` | string | Yes | Must be `recommendations` |
| `seed_tracks` | string | No | Comma-separated Spotify track IDs (max 5) |
| `seed_genres` | string | No | Comma-separated genre names (max 5) |
| `limit` | number | No | Number of tracks (1-100, default 20) |
| `market` | string | No | ISO 3166-1 alpha-2 country code (default `US`) |
| `features` | boolean | No | Include audio features in response (`true`/`false`) |
| `blacklist_artists` | string | No | Comma-separated artist names to exclude |

**Audio Feature Filters:**

| Param | Type | Description |
|-------|------|-------------|
| `min_energy` / `max_energy` | float | Energy level (0.0-1.0) |
| `min_valence` / `max_valence` | float | Positivity (0.0-1.0) |
| `min_danceability` / `max_danceability` | float | Danceability (0.0-1.0) |
| `min_acousticness` / `max_acousticness` | float | Acousticness (0.0-1.0) |
| `min_instrumentalness` / `max_instrumentalness` | float | Instrumentalness (0.0-1.0) |
| `min_liveness` / `max_liveness` | float | Liveness (0.0-1.0) |
| `min_speechiness` / `max_speechiness` | float | Speechiness (0.0-1.0) |
| `min_tempo` / `max_tempo` | float | Tempo in BPM |
| `min_loudness` / `max_loudness` | float | Loudness in dB |
| `min_popularity` / `max_popularity` | int | Popularity (0-100) |
| `min_duration_ms` / `max_duration_ms` | int | Duration in milliseconds |
| `min_key` / `max_key` | int | Musical key (0-11) |
| `min_mode` / `max_mode` | int | Mode (0=minor, 1=major) |
| `min_time_signature` / `max_time_signature` | int | Time signature |

**Example Requests:**

```bash
# Basic recommendation
curl "https://your-app.vercel.app/api/recommendations?endpoint=recommendations&seed_tracks=4cOdK2wGhE3fKFKSR3dH9n&limit=10"

# Multi-seed with genre
curl "https://your-app.vercel.app/api/recommendations?endpoint=recommendations&seed_tracks=4cOdK2wGhE3fKFKSR3dH9n&seed_genres=pop,rock&limit=20"

# With audio features and filters
curl "https://your-app.vercel.app/api/recommendations?endpoint=recommendations&seed_tracks=4cOdK2wGhE3fKFKSR3dH9n&features=true&min_energy=0.6&max_energy=0.9&market=US"

# With blacklist
curl "https://your-app.vercel.app/api/recommendations?endpoint=recommendations&seed_tracks=4cOdK2wGhE3fKFKSR3dH9n&blacklist_artists=artist1,artist2"
```

**Response:**

```json
{
  "data": {
    "tracks": [
      {
        "encoded": "spotify:track:...",
        "info": {
          "identifier": "...",
          "author": "Artist Name",
          "title": "Track Title",
          "uri": "https://open.spotify.com/track/...",
          "artworkUrl": "https://i.scdn.co/image/...",
          "sourceName": "spotify",
          "length": 240000,
          "isrc": "..."
        },
        "audioFeatures": {
          "energy": 0.85,
          "valence": 0.72,
          "danceability": 0.68,
          "tempo": 120.5,
          "acousticness": 0.12,
          "instrumentalness": 0.0,
          "liveness": 0.08,
          "speechiness": 0.04,
          "loudness": -5.2,
          "key": 7,
          "mode": 1,
          "duration_ms": 240000
        }
      }
    ]
  },
  "meta": {
    "seed": "trackId",
    "limit": 20,
    "count": 20,
    "market": "US",
    "cached": false
  }
}
```

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-07T00:00:00.000Z",
  "checks": {
    "spotify": { "status": "ok" }
  },
  "stats": {
    "cacheSize": 12
  }
}
```

## Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Pull env vars
vercel env pull

# Run dev server
vercel dev
```

## Notes

- The Spotify token is cached in memory and refreshed automatically before expiry
- In serverless, each cold start gets a fresh token cache (tokens are short-lived anyway)
- Response caching reduces redundant Spotify API calls (1 hour TTL)
- The free tier of Vercel works fine for this use case
- Valid genres: https://developer.spotify.com/documentation/web-api/reference/#/operations/get-recommendations
