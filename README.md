# Spotify Recommendations API

A Vercel serverless function that proxies Spotify's Recommendations API for the Flixo bot's autoplay feature.

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

Fetches track recommendations based on a seed track.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `endpoint` | string | Yes | Must be `recommendations` |
| `id` | string | Yes | Spotify track ID (22 chars) |
| `limit` | number | No | Number of tracks (1-100, default 20) |

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
        }
      }
    ]
  },
  "meta": {
    "seed": "trackId",
    "limit": 20,
    "count": 20
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
- The free tier of Vercel works fine for this use case
