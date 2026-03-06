import { getRtlDir } from "/src/util/lang.js";

export function wrapMain(targetText, targetLang) {
    if (!targetText) {
        return "";
    }
    var span = document.createElement("span");
    span.setAttribute("dir", getRtlDir(targetLang));
    span.textContent = targetText;
    return span.outerHTML;
}

export function wrapDict(dict, targetLang) {
    if (!dict) {
        return "";
    }
    var htmlText = wrapMain(dict, targetLang);
    // wrap first text as bold
    dict
        .split("\n")
        .map((line) => line.split(":")[0])
        .map(
            (text) => {
                var b = document.createElement("b");
                b.textContent = text;
                return (htmlText = htmlText.replace(text, b.outerHTML));
            }
        );
    return htmlText;
}

export function wrapInfoText(text, type, dirLang = null) {
    if (!text) {
        return "";
    }
    var el = document.createElement(type);
    if (dirLang) el.setAttribute("dir", getRtlDir(dirLang));
    el.textContent = "\n" + text;
    return el.outerHTML;
}

export function wrapMainImage(imageUrl) {
    if (!imageUrl) {
        return "";
    }
    var img = document.createElement("img");
    img.src = imageUrl;
    img.className = "mtt-image";
    return img.outerHTML;
}
