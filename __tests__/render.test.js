import { wrapMain, wrapDict, wrapInfoText, wrapMainImage } from "../src/contentScript/render.js";

describe("Render HTML Utils", () => {
    test("wrapMain format correctly", () => {
        const html = wrapMain("Hello Translators", "en");
        expect(html).toContain("Hello Translators");
        expect(html).toContain("<span");
        expect(html).toContain('dir="ltr"');
    });

    test("wrapMain handles empty text", () => {
        expect(wrapMain("", "en")).toBe("");
    });

    test("wrapDict parses definitions correctly", () => {
        const dictData = "apple: an fruit\nbanana: another fruit";
        const html = wrapDict(dictData, "en");
        expect(html).toContain("<b>apple</b>");
        expect(html).toContain("<b>banana</b>");
    });

    test("wrapInfoText formats correct tag", () => {
        const html = wrapInfoText("Pronunciation", "i", "en");
        expect(html).toContain("<i");
        expect(html).toContain("Pronunciation");
    });

    test("wrapMainImage creates img markup", () => {
        const html = wrapMainImage("https://example.com/img.png");
        expect(html).toContain("<img");
        expect(html).toContain('src="https://example.com/img.png"');
        expect(html).toContain('class="mtt-image"');
    });
});
