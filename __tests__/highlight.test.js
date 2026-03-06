jest.mock("../src/util.js", () => ({
    filterOverlappedRect: (rects) => rects,
    isEbookReader: () => false,
}));

import { highlightText, hideHighlight } from "../src/contentScript/highlight.js";

describe("Highlight DOM Module", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("highlightText builds highlight elements correctly based on Range rects", () => {
        const mockRange = {
            getClientRects: () => [
                { left: 10, top: 10, width: 100, height: 30 }
            ]
        };
        const mockSetting = { mouseoverHighlightText: "true" };

        // Fake window scroll values
        window.scrollX = 0;
        window.scrollY = 0;

        highlightText(mockRange, mockSetting, false, false);

        const highlights = document.querySelectorAll(".mtt-highlight");
        expect(highlights.length).toBe(1);
        expect(highlights[0].style.left).toBe("10px");
        expect(highlights[0].style.top).toBe("10px");
        expect(highlights[0].style.width).toBe("100px");
        expect(highlights[0].style.height).toBe("30px");
    });

    test("hideHighlight cleans up all DOM fragments associated with mtt-highlight class", () => {
        const div1 = document.createElement("div");
        div1.className = "mtt-highlight";
        const div2 = document.createElement("div");
        div2.className = "mtt-highlight";

        document.body.appendChild(div1);
        document.body.appendChild(div2);

        expect(document.querySelectorAll(".mtt-highlight").length).toBe(2);

        hideHighlight(false, false);
        expect(document.querySelectorAll(".mtt-highlight").length).toBe(0);
    });
});
