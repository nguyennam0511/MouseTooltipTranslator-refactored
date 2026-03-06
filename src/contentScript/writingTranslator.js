import * as util from "/src/util";
import { getSelectionText, getFocusedWritingBox } from "/src/util/dom.js";
import delay from "delay";

export async function translateWriting(setting) {
    //check current focus is write box and hot key pressed
    // if is google doc do not check writing box
    if (!getFocusedWritingBox() && !util.isGoogleDoc()) {
        return;
    }
    // get writing text
    var writingText = await getWritingText();
    if (!writingText) {
        return;
    }
    // translate
    var { targetText, isBroken } = await util.requestTranslate(
        writingText,
        "auto",
        setting["writingLanguage"],
        setting["translateTarget"]
    );
    //skip no translation or is too late to respond
    if (isBroken) {
        return;
    }
    insertText(targetText);
}

async function getWritingText() {
    // get current selected text,
    if (hasSelection() && getSelectionText()?.length > 1) {
        return getSelectionText();
    }
    // if no select, select all using native selection API
    selectAllInActiveElement();
    var text = getSelectionText();
    await makeNonEnglishTypingFinish();
    return text;
}

function hasSelection() {
    return window.getSelection().type != "Caret";
}

// Replacement for deprecated document.execCommand("selectAll")
function selectAllInActiveElement() {
    var ele = util.getActiveElement();
    if (!ele) return;
    if ("select" in ele) {
        // <input> and <textarea>
        ele.select();
    } else if (ele.isContentEditable) {
        // contenteditable elements
        var range = document.createRange();
        range.selectNodeContents(ele);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

async function makeNonEnglishTypingFinish() {
    // IME fix
    //refocus input text to prevent prev remain typing
    await delay(10);
    var ele = util.getActiveElement();
    window.getSelection().removeAllRanges();
    ele?.blur();
    await delay(10);
    ele?.focus();
    await delay(50);
    selectAllInActiveElement();
    await delay(50);
}

async function insertText(text) {
    var writingBox = getFocusedWritingBox();

    if (!text) {
        return;
    } else if (util.isGoogleDoc()) {
        pasteTextGoogleDoc(text);
    } else if (writingBox?.getAttribute("spellcheck") === "true") {
        //for discord twitch
        await pasteTextInputBox(text);
        await pasteTextExecCommand(text, false);
    } else {
        //for bard , butterflies.ai
        await pasteTextExecCommand(text);
        await pasteTextInputBox(text, false);
    }
}

async function pasteTextExecCommand(text, firstTry = true) {
    if (!hasSelection() && !firstTry) {
        return;
    }
    // Use InputEvent instead of deprecated document.execCommand("insertText")
    var ele = util.getActiveElement();
    if (ele && "setRangeText" in ele) {
        // For <input> and <textarea>
        var start = ele.selectionStart;
        var end = ele.selectionEnd;
        ele.setRangeText(text, start, end, "end");
        ele.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } else {
        // Fallback for contenteditable elements
        document.execCommand("insertText", false, text);
    }
    await delay(300);
}

async function pasteTextInputBox(text, firstTry = true) {
    if (!hasSelection() && !firstTry) {
        return;
    }
    var ele = util.getActiveElement();
    pasteText(ele, text);
    await delay(300);
}

function pasteTextGoogleDoc(text) {
    // https://github.com/matthewsot/docs-plus
    var el = document.getElementsByClassName("docs-texteventtarget-iframe")?.[0];
    if (el) {
        el = el.contentDocument.querySelector("[contenteditable=true]");
        pasteText(el, text);
    }
}

function pasteText(ele, text) {
    var clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    var paste = new ClipboardEvent("paste", {
        clipboardData,
        data: text,
        dataType: "text/plain",
        bubbles: true,
        cancelable: true,
    });
    paste.docs_plus_ = true;
    if (ele) {
        ele.dispatchEvent(paste);
    }
    clipboardData.clearData();
}
