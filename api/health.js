import { getAccessToken } from '../lib/token.js';
import { cache } from '../lib/cache.js';

export default async function handler(req) {
	const health = {
		status: 'ok',
		timestamp: new Date().toISOString(),
		checks: {},
		stats: {
			cacheSize: cache.size(),
		},
	};

	try {
		await getAccessToken();
		health.checks.spotify = { status: 'ok' };
	} catch (err) {
		health.status = 'degraded';
		health.checks.spotify = { status: 'error', message: err.message };
	}

	const status = health.status === 'ok' ? 200 : 503;
	return new Response(JSON.stringify(health, null, 2), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-cache',
		},
	});
}
