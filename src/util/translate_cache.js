/**
 * translate_cache.js
 *
 * Persistent translation cache using chrome.storage.local.
 * Replaces in-memory only caching so translations survive browser restarts.
 *
 * Cache key format: "<text>|<sourceLang>|<targetLang>|<engine>"
 * TTL: 24 hours per entry
 * Max entries: 2000 (LRU eviction)
 */

var browser;
try {
    browser = require("webextension-polyfill");
} catch (e) { }

const CACHE_KEY = "translationCache";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const MAX_CACHE_SIZE = 2000;

/**
 * Build a unique cache key from translate params.
 */
function buildCacheKey(text, sourceLang, targetLang, engine) {
    return `${text}|${sourceLang}|${targetLang}|${engine}`;
}

/**
 * Load the full cache object from chrome.storage.local.
 * Returns an object: { [key]: { result, timestamp } }
 */
async function loadCache() {
    try {
        var data = await browser.storage.local.get(CACHE_KEY);
        return data?.[CACHE_KEY] || {};
    } catch (e) {
        return {};
    }
}

/**
 * Save the full cache object back to chrome.storage.local.
 */
async function saveCache(cache) {
    try {
        await browser.storage.local.set({ [CACHE_KEY]: cache });
    } catch (e) { }
}

/**
 * Evict expired entries and enforce MAX_CACHE_SIZE using LRU strategy.
 */
function pruneCache(cache) {
    var now = Date.now();

    // Remove expired entries
    for (var key of Object.keys(cache)) {
        if (now - cache[key].timestamp > CACHE_TTL_MS) {
            delete cache[key];
        }
    }

    // If still over limit, remove oldest entries
    var keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_SIZE) {
        var sorted = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        var toRemove = sorted.slice(0, keys.length - MAX_CACHE_SIZE);
        for (var k of toRemove) {
            delete cache[k];
        }
    }

    return cache;
}

/**
 * Get a cached translation result.
 * Returns null if not found or expired.
 */
export async function getCachedTranslation(text, sourceLang, targetLang, engine) {
    var cache = await loadCache();
    var key = buildCacheKey(text, sourceLang, targetLang, engine);
    var entry = cache[key];

    if (!entry) return null;

    var isExpired = Date.now() - entry.timestamp > CACHE_TTL_MS;
    if (isExpired) {
        delete cache[key];
        await saveCache(cache);
        return null;
    }

    // Update timestamp (LRU touch)
    entry.timestamp = Date.now();
    cache[key] = entry;
    // Save asynchronously (fire and forget)
    saveCache(cache);

    return entry.result;
}

/**
 * Store a translation result in the persistent cache.
 */
export async function setCachedTranslation(text, sourceLang, targetLang, engine, result) {
    if (!result) return;

    var cache = await loadCache();
    var key = buildCacheKey(text, sourceLang, targetLang, engine);

    cache[key] = {
        result,
        timestamp: Date.now(),
    };

    cache = pruneCache(cache);
    await saveCache(cache);
}

/**
 * Clear all cached translations (useful for settings reset).
 */
export async function clearTranslationCache() {
    try {
        await browser.storage.local.remove(CACHE_KEY);
    } catch (e) { }
}
