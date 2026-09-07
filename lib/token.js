const TOKEN_CACHE_KEY = 'spotify:access_token';
const TOKEN_EXPIRY_BUFFER = 60_000;

let cachedToken = null;
let cachedExpiry = 0;

async function fetchNewToken() {
	const clientId = process.env.SPOTIFY_CLIENT_ID;
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
	}

	const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${credentials}`,
		},
		body: 'grant_type=client_credentials',
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Spotify token error ${res.status}: ${body}`);
	}

	const data = await res.json();

	return {
		accessToken: data.access_token,
		expiresIn: data.expires_in * 1000,
		obtainedAt: Date.now(),
	};
}

export async function getAccessToken() {
	const now = Date.now();

	if (cachedToken && now < cachedExpiry - TOKEN_EXPIRY_BUFFER) {
		return cachedToken;
	}

	const token = await fetchNewToken();
	cachedToken = token.accessToken;
	cachedExpiry = token.obtainedAt + token.expiresIn;

	return cachedToken;
}
