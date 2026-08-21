export function immutableMap<K, V>(source: Map<K, V>): ReadonlyMap<K, V> {
	return Object.freeze({
		get size() { return source.size },
		get: source.get.bind(source),
		has: source.has.bind(source),
		entries: source.entries.bind(source),
		keys: source.keys.bind(source),
		values: source.values.bind(source),
		forEach: source.forEach.bind(source),
		[Symbol.iterator]: source[Symbol.iterator].bind(source),
	})
}
