import { getAccessToken } from '../lib/token.js';
import { cache, makeRecCacheKey } from '../lib/cache.js';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_GENRES = new Set([
	'acoustic', 'afrobeat', 'alt-rock', 'alternative', 'ambient', 'anime',
	'black-metal', 'bluegrass', 'bossa-nova', 'brazil', 'breakbeat',
	'british', 'canto-pop', 'chanson', 'chill', 'classical', 'club',
	'country', 'dance', 'dancehall', 'death-metal', 'deep-house',
	'demo', 'detroit-techno', 'disco', 'disney', 'drum-and-bass',
	'dub', 'dubstep', 'edm', 'electro', 'electronic', 'emo',
	'folk', 'forro', 'french', 'funk', 'garage', 'german', 'gospel',
	'goth', 'grime', 'grunge', 'guitar', 'happy', 'hard-rock',
	'hardcore', 'heavy-metal', 'hip-hop', 'holidays', 'honky-tonk',
	'house', 'idm', 'indian', 'indie', 'indie-pop', 'industrial',
	'iranian', 'j-dance', 'j-idol', 'j-pop', 'j-rock', 'jazz',
	'k-pop', 'kids', 'latin', 'latino', 'malay', 'mandopop', 'metal',
	'metal-misc', 'minimal-techno', 'movies', 'mpb', 'new-age',
	'new-release', 'opera', 'pagode', 'party', 'philippines-opm',
	'piano', 'pop', 'pop-film', 'post-dubstep', 'power-pop',
	'progressive-house', 'psych-rock', 'punk', 'punk-rock', 'r-n-b',
	'rainy-day', 'reggae', 'reggaeton', 'road-trip', 'rock',
	'rock-n-roll', 'rockabilly', 'romance', 'sad', 'salsa', 'samba',
	'sertanejo', 'show-tunes', 'singer-songwriter', 'ska', 'sleep',
	'soul', 'soundtracks', 'spanish', 'study', 'summer', 'swedish',
	'synth-pop', 'tango', 'techno', 'trance', 'trip-hop', 'turkish',
	'work-out', 'world-music',
]);

const TRACK_ID_RE = /^[A-Za-z0-9]{22}$/;

function jsonRes(status, body, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...headers },
	});
}

function validateTrackId(id) {
	return TRACK_ID_RE.test(id);
}

function validateGenre(g) {
	return VALID_GENRES.has(g.toLowerCase());
}

function parseSeeds(url) {
	const seedTracks = [];
	const seedGenres = [];

	const trackRaw = url.searchParams.get('seed_tracks');
	if (trackRaw) {
		for (const id of trackRaw.split(',').slice(0, 5)) {
			const trimmed = id.trim();
			if (validateTrackId(trimmed)) seedTracks.push(trimmed);
		}
	}

	const genreRaw = url.searchParams.get('seed_genres');
	if (genreRaw) {
		for (const g of genreRaw.split(',').slice(0, 5)) {
			const trimmed = g.trim().toLowerCase();
			if (validateGenre(trimmed)) seedGenres.push(trimmed);
		}
	}

	const totalSeeds = seedTracks.length + seedGenres.length;
	if (totalSeeds === 0) return { seedTracks: null, seedGenres: null, error: 'No valid seeds provided' };
	if (totalSeeds > 5) {
		if (seedGenres.length > 0) seedGenres.length = 5 - seedTracks.length;
		else seedTracks.length = 5;
	}

	return { seedTracks: seedTracks.length ? seedTracks : null, seedGenres: seedGenres.length ? seedGenres : null };
}

function parseFilters(url) {
	const filters = {};
	const keys = [
		'min_acousticness', 'max_acousticness',
		'min_danceability', 'max_danceability',
		'min_energy', 'max_energy',
		'min_instrumentalness', 'max_instrumentalness',
		'min_liveness', 'max_liveness',
		'min_loudness', 'max_loudness',
		'min_popularity', 'max_popularity',
		'min_speechiness', 'max_speechiness',
		'min_tempo', 'max_tempo',
		'min_valence', 'max_valence',
		'min_duration_ms', 'max_duration_ms',
		'min_key', 'max_key',
		'min_mode', 'max_mode',
		'min_time_signature', 'max_time_signature',
	];

	for (const key of keys) {
		const val = url.searchParams.get(key);
		if (val !== null && val !== undefined) {
			const num = parseFloat(val);
			if (!isNaN(num)) {
				filters[key] = num;
			}
		}
	}

	return Object.keys(filters).length > 0 ? filters : null;
}

function parseBlacklist(url) {
	const raw = url.searchParams.get('blacklist_artists');
	if (!raw) return null;
	return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
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
		audioFeatures: null,
	};
}

async function fetchWithRetry(url, options, retries = 3) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		const res = await fetch(url, options);

		if (res.status === 429) {
			const retryAfter = parseInt(res.headers.get('Retry-After') || '2');
			await new Promise((r) => setTimeout(r, retryAfter * 1000));
			continue;
		}

		if (res.ok || attempt === retries) return res;

		await new Promise((r) => setTimeout(r, 500 * attempt));
	}

	return fetch(url, options);
}

async function fetchAudioFeatures(trackIds, accessToken) {
	if (!trackIds.length) return {};

	try {
		const ids = trackIds.slice(0, 100).join(',');
		const res = await fetchWithRetry(
			`https://api.spotify.com/v1/audio-features?ids=${ids}`,
			{ headers: { Authorization: `Bearer ${accessToken}` } },
			2,
		);

		if (!res.ok) return {};

		const data = await res.json();
		const map = {};
		for (const item of data.audio_features || []) {
			if (item) map[item.id] = {
				danceability: item.danceability,
				energy: item.energy,
				valence: item.valence,
				tempo: item.tempo,
				acousticness: item.acousticness,
				instrumentalness: item.instrumentalness,
				liveness: item.liveness,
				speechiness: item.speechiness,
				loudness: item.loudness,
				key: item.key,
				mode: item.mode,
				duration_ms: item.duration_ms,
			};
		}
		return map;
	} catch {
		return {};
	}
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
		const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 20, 1), 100);
		const market = url.searchParams.get('market') || 'US';
		const features = url.searchParams.get('features') === 'true';

		if (endpoint !== 'recommendations') {
			return jsonRes(400, { error: 'Invalid endpoint. Use ?endpoint=recommendations' });
		}

		const { seedTracks, seedGenres, error: seedError } = parseSeeds(url);
		if (seedError) {
			return jsonRes(400, { error: seedError });
		}

		const filters = parseFilters(url);
		const blacklist = parseBlacklist(url);

		const cacheKey = makeRecCacheKey(seedTracks, seedGenres, limit, market, filters);
		const cached = cache.get(cacheKey);
		if (cached) {
			let tracks = cached;
			if (blacklist?.length) {
				tracks = tracks.filter((t) => {
					const author = t.info.author.toLowerCase();
					return !blacklist.some((b) => author.includes(b));
				});
			}
			return jsonRes(200, {
				data: { tracks: tracks.slice(0, limit) },
				meta: { seed: seedTracks?.[0] || seedGenres?.[0], limit, count: tracks.length, cached: true },
			});
		}

		const accessToken = await getAccessToken();

		const spotifyUrl = new URL('https://api.spotify.com/v1/recommendations');
		spotifyUrl.searchParams.set('limit', limit.toString());
		spotifyUrl.searchParams.set('market', market);

		if (seedTracks) spotifyUrl.searchParams.set('seed_tracks', seedTracks.join(','));
		if (seedGenres) spotifyUrl.searchParams.set('seed_genres', seedGenres.join(','));

		if (filters) {
			for (const [k, v] of Object.entries(filters)) {
				spotifyUrl.searchParams.set(k, v.toString());
			}
		}

		const spotifyRes = await fetchWithRetry(
			spotifyUrl.toString(),
			{ headers: { Authorization: `Bearer ${accessToken}` } },
			3,
		);

		if (!spotifyRes.ok) {
			const errBody = await spotifyRes.text();
			console.error(`Spotify API error ${spotifyRes.status}:`, errBody);
			return jsonRes(spotifyRes.status, {
				error: 'Spotify API error',
				details: spotifyRes.status === 429 ? 'Rate limited' : 'Upstream error',
			});
		}

		const spotifyData = await spotifyRes.json();
		let tracks = (spotifyData.tracks || []).map(transformTrack);

		if (blacklist?.length) {
			tracks = tracks.filter((t) => {
				const author = t.info.author.toLowerCase();
				return !blacklist.some((b) => author.includes(b));
			});
		}

		if (features && tracks.length > 0) {
			const ids = tracks.map((t) => t.info.identifier);
			const audioMap = await fetchAudioFeatures(ids, accessToken);
			for (const track of tracks) {
				track.audioFeatures = audioMap[track.info.identifier] || null;
			}
		}

		cache.set(cacheKey, tracks, 3600_000);

		return jsonRes(200, {
			data: { tracks },
			meta: {
				seed: seedTracks?.[0] || seedGenres?.[0],
				limit,
				count: tracks.length,
				market,
				cached: false,
			},
		});
	} catch (err) {
		console.error('Recommendations error:', err);
		return jsonRes(500, { error: 'Internal server error' });
	}
}
