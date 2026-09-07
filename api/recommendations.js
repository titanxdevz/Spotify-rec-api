import { getAccessToken } from '../lib/token.js';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonRes(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	});
}

function validateSpotifyId(id) {
	return /^[A-Za-z0-9]{22}$/.test(id);
}

function transformTrack(track) {
	return {
		encoded: `spotify:track:${track.id}`,
		info: {
			identifier: track.id,
			isSeekable: true,
			author: track.artists?.map((a) => a.name).join(', ') || 'Unknown',
			length: track.duration_ms,
			isStream: false,
			title: track.name,
			uri: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
			artworkUrl: track.album?.images?.[0]?.url || null,
			sourceName: 'spotify',
			isrc: track.isrc || null,
		},
		pluginInfo: {},
	};
}

export default async function handler(req) {
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	if (req.method !== 'GET') {
		return jsonRes(405, { error: 'Method not allowed' });
	}

	try {
		const url = new URL(req.url);
		const endpoint = url.searchParams.get('endpoint');
		const trackId = url.searchParams.get('id');
		const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 20, 1), 100);

		if (endpoint !== 'recommendations') {
			return jsonRes(400, { error: 'Invalid endpoint. Use ?endpoint=recommendations' });
		}

		if (!trackId) {
			return jsonRes(400, { error: 'Missing ?id= parameter (Spotify track ID)' });
		}

		if (!validateSpotifyId(trackId)) {
			return jsonRes(400, { error: 'Invalid Spotify track ID format (expected 22 chars)' });
		}

		const accessToken = await getAccessToken();

		const spotifyUrl = new URL('https://api.spotify.com/v1/recommendations');
		spotifyUrl.searchParams.set('seed_tracks', trackId);
		spotifyUrl.searchParams.set('limit', limit.toString());
		spotifyUrl.searchParams.set('market', 'US');

		const spotifyRes = await fetch(spotifyUrl.toString(), {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!spotifyRes.ok) {
			const errBody = await spotifyRes.text();
			console.error(`Spotify API error ${spotifyRes.status}:`, errBody);
			return jsonRes(spotifyRes.status, {
				error: 'Spotify API error',
				details: spotifyRes.status === 429 ? 'Rate limited' : 'Upstream error',
			});
		}

		const spotifyData = await spotifyRes.json();
		const tracks = (spotifyData.tracks || []).map(transformTrack);

		return jsonRes(200, {
			data: { tracks },
			meta: {
				seed: trackId,
				limit,
				count: tracks.length,
			},
		});
	} catch (err) {
		console.error('Recommendations error:', err);
		return jsonRes(500, { error: 'Internal server error' });
	}
}
