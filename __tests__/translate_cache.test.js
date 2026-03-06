import { getCachedTranslation, setCachedTranslation, clearTranslationCache } from "../src/util/translate_cache.js";

// Mock the global webextension-polyfill used in cache
jest.mock("webextension-polyfill", () => {
    let mockStore = {};
    return {
        storage: {
            local: {
                get: jest.fn(async (key) => ({ [key]: mockStore[key] })),
                set: jest.fn(async (data) => {
                    Object.assign(mockStore, data);
                }),
                remove: jest.fn(async (key) => {
                    delete mockStore[key];
                })
            }
        }
    };
}, { virtual: true });

describe("Translation Cache", () => {
    beforeEach(async () => {
        await clearTranslationCache();
    });

    test("should store and retrieve translation correctly", async () => {
        await setCachedTranslation("apple", "en", "vi", "google", "quả táo");

        const result = await getCachedTranslation("apple", "en", "vi", "google");
        expect(result).toBe("quả táo");
    });

    test("should return null if cache is not found", async () => {
        const result = await getCachedTranslation("unknown", "en", "vi", "google");
        expect(result).toBeNull();
    });

    test("should return null after cache is cleared", async () => {
        await setCachedTranslation("test", "en", "es", "bing", "prueba");
        expect(await getCachedTranslation("test", "en", "es", "bing")).toBe("prueba");

        await clearTranslationCache();
        expect(await getCachedTranslation("test", "en", "es", "bing")).toBeNull();
    });
});
