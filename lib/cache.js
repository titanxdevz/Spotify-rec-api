const DEFAULT_TTL = 3600_000;

class MemoryCache {
	constructor() {
		this.store = new Map();
		this.timers = new Map();
	}

	get(key) {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			this.delete(key);
			return null;
		}
		return entry.value;
	}

	set(key, value, ttl = DEFAULT_TTL) {
		if (this.timers.has(key)) clearTimeout(this.timers.get(key));

		const expiresAt = Date.now() + ttl;
		this.store.set(key, { value, expiresAt });

		const timer = setTimeout(() => this.delete(key), ttl + 1000);
		this.timers.set(key, timer);
	}

	delete(key) {
		this.store.delete(key);
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
		}
	}

	size() {
		return this.store.size;
	}
}

export const cache = new MemoryCache();

export function makeRecCacheKey(seedTracks, seedGenres, limit, market, filters) {
	const parts = [
		seedTracks ? seedTracks.sort().join(',') : '',
		seedGenres ? seedGenres.sort().join(',') : '',
		limit,
		market,
	].filter(Boolean);
	if (filters) {
		for (const [k, v] of Object.entries(filters).sort()) {
			parts.push(`${k}=${v}`);
		}
	}
	return `rec:${parts.join('|')}`;
}
