import * as util from "/src/util";

export function hideHighlight(isAutoReaderRunning, checkSkipCase) {
    if (checkSkipCase && isAutoReaderRunning) {
        return;
    }
    document.querySelectorAll(".mtt-highlight").forEach((el) => el.remove());
}

export function highlightText(range, setting, isAutoReaderRunning = false, force = false) {
    if (!force && (!range || setting["mouseoverHighlightText"] == "false")) {
        return;
    }
    hideHighlight(isAutoReaderRunning);
    var rects = range.getClientRects();
    rects = util.filterOverlappedRect(rects);
    var adjustX = window.scrollX;
    var adjustY = window.scrollY;
    if (util.isEbookReader()) {
        var ebookViewerRect = util.getEbookIframe()?.getBoundingClientRect();
        adjustX += ebookViewerRect?.left;
        adjustY += ebookViewerRect?.top;
    }

    for (var rect of rects) {
        var div = document.createElement("div");
        div.className = "mtt-highlight";
        div.style.cssText = `position:absolute;left:${rect.left + adjustX}px;top:${rect.top + adjustY}px;width:${rect.width}px;height:${rect.height}px`;
        document.body.appendChild(div);
    }
}
