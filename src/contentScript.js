// inject translation tooltip based on user text hover event
//it gets translation and tts from background.js
//intercept pdf url

import tippy, { sticky, hideAll } from "tippy.js";
import matchUrl from "match-url-wildcard";
import delay from "delay";
import browser from "webextension-polyfill";
import TextUtil from "/src/util/text_util.js";
import SettingUtil from "/src/util/setting_util.js";
import { getRtlDir } from "/src/util/lang.js";
import { translateWriting } from "/src/contentScript/writingTranslator.js";
import { handleTTS } from "/src/contentScript/tts.js";
import { highlightText, hideHighlight } from "/src/contentScript/highlight.js";
import { addElementEnv, applyStyleSetting } from "/src/contentScript/styleSetup.js";
import {
  wrapMain,
  wrapDict,
  wrapInfoText,
  wrapMainImage,
} from "/src/contentScript/render.js";

import {
  enableSelectionEndEvent,
  getSelectionText,
} from "/src/event/selection";
import {
  enableMouseoverTextEvent,
  getNextExpandedRange,
  getMouseoverText,
  forceTriggerMouseoverText
} from "/src/event/mouseover";
import * as util from "/src/util";
import * as dom_util from "/src/util/dom";

import * as ocrView from "/src/ocr/ocrView.js";
import subtitle from "/src/subtitle/subtitle.js";
import { langListOpposite } from "/src/util/lang.js";
import * as speech from "/src/speech";

//init environment var======================================================================\
var setting;
var tooltip;
var style;
var styleSubtitle;
var tooltipContainer;
var tooltipContainerEle;

var clientX = 0;
var clientY = 0;
var mouseTarget = null;
var mouseMoved = false;
var mouseMovedCount = 0;
var keyDownList = { always: true }; //use key down for enable translation partially
var keyDownDoublePress = {};
var keyDownPressTime = {};
var mouseKeyMap = ["ClickLeft", "ClickMiddle", "ClickRight"];

var destructionEvent = "destructmyextension_MouseTooltipTranslator"; // + chrome.runtime.id;
const controller = new AbortController();
const { signal } = controller;

var selectedText = "";
var prevSelected = "";
var hoveredData = {};
var stagedText = null;
var prevTooltipText = "";
var isAutoReaderRunning = false;
var isStopAutoReaderOn = false;

var tooltipRemoveTimeoutId = "";
var tooltipRemoveTime = 3000;
var autoReaderScrollTime = 400;

var listenText = "";

//tooltip core======================================================================

(async function initMouseTooltipTranslator() {
  try {
    injectGoogleDocAnnotation(); //check google doc and add annotation env var
    loadDestructor(); //remove previous tooltip script
    await getSetting(); //load setting
    if (checkExcludeUrl()) {
      return;
    }
    await dom_util.waitJquery(); //wait jquery load
    detectPDF(); //check current page is pdf
    checkVideo(); // check  video  site for subtitle
    checkGoogleDocs(); // check google doc

    var env = addElementEnv(); //add tooltip container
    tooltipContainerEle = env.tooltipContainerEle;
    tooltipContainer = env.tooltipContainer;
    style = env.style;
    styleSubtitle = env.styleSubtitle;
    tooltip = env.tooltip;

    applyStyleSetting(setting, tooltip, tooltipContainerEle, style, styleSubtitle); //add tooltip style
    addMsgListener(); // get background listener for copy request
    loadEventListener(); //load event listener to detect mouse move
    loadSpeechRecognition();
    startMouseoverDetector(); // start current mouseover text detector
    startTextSelectDetector(); // start current text select detector
  } catch (error) {
    console.log(error);
  }
})();

//determineTooltipShowHide based on hover, check mouse over word on every 700ms
function startMouseoverDetector() {
  enableMouseoverTextEvent(window, setting, keyDownList, signal);
  addEventHandler("mouseoverText", stageTooltipTextHover);
}

//determineTooltipShowHide based on selection
function startTextSelectDetector() {
  enableSelectionEndEvent(window, setting["tooltipEventInterval"], signal); //set mouse drag text selection event
  addEventHandler("selectionEnd", stageTooltipTextSelect);
}

function stageTooltipTextHover(event, useEvent = true) {
  hoveredData = useEvent ? event?.mouseoverText : hoveredData;
  // if mouseover detect setting is on and
  // if no selected text
  if (
    setting["translateWhen"].includes("mouseover") &&
    hoveredData &&
    !isOtherServiceActive()
  ) {
    var { mouseoverText, mouseoverRange } = hoveredData;
    stageTooltipText(mouseoverText, "mouseover", mouseoverRange);
  }
}

function stageTooltipTextSelect(event, useEvent = true) {
  // if translate on selection is enabled
  if (
    setting["translateWhen"].includes("select") &&
    !isOtherServiceActive(true)
  ) {
    prevSelected = selectedText;
    selectedText = useEvent ? event?.selectedText : selectedText;
    stageTooltipText(selectedText, "select");
  }
}

function isOtherServiceActive(excludeSelect = false) {
  return listenText || isAutoReaderRunning || (!excludeSelect && selectedText);
}

//process detected word
async function stageTooltipText(text, actionType, range) {
  var isTtsOn =
    keyDownList[setting["TTSWhen"]] ||
    (setting["TTSWhen"] == "select" && actionType == "select");
  var isTtsSwap = keyDownDoublePress[setting["TTSWhen"]];
  var isTooltipOn = keyDownList[setting["showTooltipWhen"]];
  var timestamp = Number(Date.now());

  // skip if mouse target is tooltip or no text, if no new word or  tab is not activated
  // hide tooltip, if  no text
  // if tooltip is off, hide tooltip
  if (
    !checkWindowFocus() ||
    checkMouseTargetIsTooltip() ||
    stagedText == text ||
    !util.isExtensionOnline() ||
    (selectedText == prevSelected && !text && actionType == "select") //prevent select flicker
  ) {
    return;
  } else if (!text) {
    stagedText = text;
    hideTooltip();
    return;
  } else if (!isTooltipOn && !isTtsOn) {
    hideTooltip();
    return;
  } else if (!isTooltipOn) {
    hideTooltip();
  }


  //stage current processing word
  stagedText = text;
  var translatedData = await util.requestTranslate(
    text,
    setting["translateSource"],
    setting["translateTarget"],
    setting["translateReverseTarget"]
  );
  var { targetText, sourceLang, targetLang } = translatedData;

  // if translation is not recent one, do not update
  //if translated text is empty, hide tooltip
  if (stagedText != text) {
    return;
  } else if (
    !targetText ||
    sourceLang == targetLang ||
    setting["langExcludeList"].includes(sourceLang)
  ) {
    hideTooltip();
    return;
  }

  //if tooltip is on or activation key is pressed, show tooltip
  if (isTooltipOn) {
    handleTooltip(text, translatedData, actionType, range);
  }
  //if use_tts is on or activation key is pressed, do tts
  if (isTtsOn) {
    handleTTS(
      text,
      sourceLang,
      targetText,
      targetLang,
      timestamp,
      false,
      isTtsSwap
    );
  }
}

function checkMouseTargetIsTooltip() {
  try {
    return tooltip?.popper?.contains(mouseTarget);
  } catch (error) {
    return false;
  }
}

//tooltip show hide logic=========================================================
function showTooltip(text) {
  if (prevTooltipText != text) {
    hideTooltip(true);
  }
  prevTooltipText = text;
  cancelRemoveTooltipContainer();
  checkTooltipContainerInit();
  tooltip?.setContent(text);
  tooltip?.show();
}

function hideTooltip(resetAll = false) {
  if (resetAll) {
    // hideAll({ duration: 0 }); //hide all tippy
  }
  tooltip?.hide();
  hideHighlight(isAutoReaderRunning);
  removeTooltipContainer();
}

function removeTooltipContainer() {
  cancelRemoveTooltipContainer();
  tooltipRemoveTimeoutId = setTimeout(() => {
    document.getElementById("mttContainer")?.remove();
  }, tooltipRemoveTime);
}

function cancelRemoveTooltipContainer() {
  clearTimeout(tooltipRemoveTimeoutId);
}

function checkTooltipContainerInit() {
  checkTooltipContainer();
  checkStyleContainer();
}
function checkTooltipContainer() {
  if (!document.getElementById("mttContainer")) {
    document.body.appendChild(tooltipContainer);
  }
}

function checkStyleContainer() {
  if (!document.getElementById("mttstyle")) {
    document.head.appendChild(style);
  }
}


function handleTooltip(text, translatedData, actionType, range) {
  var { targetText, sourceLang, targetLang, transliteration, dict, imageUrl } =
    translatedData;
  var isShowOriTextOn = setting["tooltipInfoSourceText"] == "true";
  var isShowLangOn = setting["tooltipInfoSourceLanguage"] == "true";
  var isTransliterationOn = setting["tooltipInfoTransliteration"] == "true";
  var tooltipTransliteration = isTransliterationOn ? transliteration : "";
  var tooltipLang = isShowLangOn ? langListOpposite[sourceLang] : "";
  var tooltipOriText = isShowOriTextOn ? text : "";
  var isDictOn = setting["tooltipWordDictionary"] == "true";
  var dictData = isDictOn ? wrapDict(dict, targetLang) : "";

  var tooltipMainText =
    wrapMainImage(imageUrl) || dictData || wrapMain(targetText, targetLang);
  var tooltipSubText =
    wrapInfoText(tooltipOriText, "i", sourceLang) +
    wrapInfoText(tooltipTransliteration, "b") +
    wrapInfoText(tooltipLang, "sup");
  var tooltipText = tooltipMainText + tooltipSubText;

  showTooltip(tooltipText);

  util.requestRecordTooltipText(
    text,
    sourceLang,
    targetText,
    targetLang,
    dict,
    actionType
  );
  highlightText(range, setting, isAutoReaderRunning);
}

// Listener - detect mouse move, key press, mouse press, tab switch==========================================================================================
function loadEventListener() {
  //use mouse position for tooltip position
  addEventHandler("mousemove", handleMousemove);
  addEventHandler("touchstart", handleTouchstart);

  addEventHandler("scroll", () => hideHighlight(isAutoReaderRunning, true));
  //detect activation hold key pressed
  addEventHandler("keydown", handleKeydown);
  addEventHandler("keyup", handleKeyup);
  addEventHandler("mousedown", handleMouseKeyDown);
  addEventHandler("mouseup", handleMouseKeyUp);

  //detect tab switching to reset env
  addEventHandler("blur", resetTooltipStatus);
  addEventHandler("beforeunload", killAutoReader);
}

function handleMousemove(e) {
  //if mouse moved far distance two times, check as mouse moved
  if (!checkMouseOnceMoved(e.clientX, e.clientY)) {
    setMouseStatus(e);
    return;
  }
  setMouseStatus(e);
  setTooltipPosition(e.clientX, e.clientY);
  ocrView.checkImage(e.clientX, e.clientY, setting, keyDownList);
}

function handleTouchstart(e) {
  mouseMoved = true;
}

function handleKeydown(e) {
  //if user pressed ctrl+f  ctrl+a, hide tooltip
  if (/KeyA|KeyF/.test(e.code) && e.ctrlKey) {
    mouseMoved = false;
    hideTooltip();
  } else if (e.code == "Escape") {
    util.requestStopTTS();
    util.requestKillAutoReaderTabs(true);
  } else if (e.key == "HangulMode" || e.key == "Process") {
    return;
  } else if (e.key == "Alt") {
    e.preventDefault(); // prevent alt site unfocus
  }

  holdKeydownList(e.code);
}

function handleKeyup(e) {
  releaseKeydownList(e.code);
}

function handleMouseKeyDown(e) {
  holdKeydownList(mouseKeyMap[e.button]);
}
function handleMouseKeyUp(e) {
  releaseKeydownList(mouseKeyMap[e.button]);
}

function holdKeydownList(key) {
  var detectKeyDown = recordKeydownList(key);
  recordDoublePress(key);
  runKeydownPostProcess(key, detectKeyDown);
}

function recordKeydownList(key) {
  var detectKeyDown = false;
  if (key && !keyDownList[key] && !util.isCharKey(key)) {
    keyDownList[key] = true;
    detectKeyDown = true;
  }
  return detectKeyDown;
}

function recordDoublePress(key) {
  if (keyDownList[key]) {
    const now = Date.now();
    if (now - keyDownPressTime[key] < 1000) {
      keyDownDoublePress[key] = true;
    } else {
      keyDownDoublePress[key] = false;
    }
    keyDownPressTime[key] = Date.now();
  } else {
    keyDownList[key] = { lastPressed: Date.now() };
  }
}

async function runKeydownPostProcess(key, detectKeyDown) {
  // run keydown process
  if (detectKeyDown) {
    if (setting["keyDownTranslateWriting"] == key) {
      translateWriting(setting);
    }
    if (setting["keySpeechRecognition"] == key) {
      speech.startSpeechRecognition();
    }
    if (setting["keyDownAutoReader"] == key) {
      startAutoReader();
    }
    if (setting["keyToggleMouseoverTextType"] == key) {
      setting["mouseoverTextType"] = setting["mouseoverTextType"] == "word" ? "sentence" : "word";
      setting.save();
    }
    restartWordProcess();
  }

  if (util.isCharKey(key)) {
    util.requestStopTTS(Date.now() + 500);
    killAutoReader();
  }
}

async function startAutoReader() {
  if (!keyDownList[setting["keyDownAutoReader"]]) {
    return;
  }
  var isTtsSwap = keyDownDoublePress[setting["keyDownAutoReader"]];
  util.clearSelection();
  util.requestKillAutoReaderTabs();
  await killAutoReader();
  var { mouseoverText, mouseoverRange } = await getMouseoverText(
    clientX,
    clientY
  );
  processAutoReader(mouseoverRange, isTtsSwap);
}

async function processAutoReader(stagedRange, isTtsSwap) {
  if (!stagedRange || isStopAutoReaderOn) {
    hideTooltip();
    isStopAutoReaderOn = false;
    isAutoReaderRunning = false;
    return;
  }
  isAutoReaderRunning = true;
  var text = util.extractTextFromRange(stagedRange);
  var translatedData = await util.requestTranslate(
    text,
    setting["translateSource"],
    setting["translateTarget"],
    setting["translateReverseTarget"]
  );
  var { targetText, sourceLang, targetLang } = translatedData;

  scrollAutoReader(stagedRange);
  setTimeout(() => {
    highlightText(stagedRange, setting, isAutoReaderRunning, true);
  }, autoReaderScrollTime);
  showTooltip(targetText);

  var nextStagedRange = getNextExpandedRange(
    stagedRange,
    setting["mouseoverTextType"]
  );
  preloadNextTranslation(nextStagedRange);
  await callTTS(
    text,
    sourceLang,
    targetText,
    targetLang,
    Date.now(),
    true,
    isTtsSwap
  );

  processAutoReader(nextStagedRange, isTtsSwap);
}

async function preloadNextTranslation(stagedRange) {
  if (!stagedRange) {
    return;
  }
  await delay(700);
  var text = util.extractTextFromRange(stagedRange);
  util.requestTranslate(
    text,
    setting["translateSource"],
    setting["translateTarget"],
    setting["translateReverseTarget"]
  );
}

function scrollAutoReader(range) {
  var rect = range.getBoundingClientRect();
  if (util.isPDFViewer()) {
    var viewerContainer = document.getElementById("viewerContainer");
    if (viewerContainer) {
      var scrollTopValue = viewerContainer.scrollTop + rect.top - viewerContainer.clientHeight / 2;
      viewerContainer.scrollTo({ top: scrollTopValue, behavior: "smooth" });
    }
  } else {
    var scrollTopValue = window.scrollY + rect.top - window.innerHeight / 2;
    window.scrollTo({ top: scrollTopValue, behavior: "smooth" });
  }
}

async function killAutoReader() {
  if (!isAutoReaderRunning || isStopAutoReaderOn) {
    return;
  }
  isStopAutoReaderOn = true;
  util.requestStopTTS(Date.now(), true);
  await util.waitUntilForever(() => !isAutoReaderRunning);
  isStopAutoReaderOn = false;
}
function disableEdgeMiniMenu(e) {
  if (util.isEdge() && mouseKeyMap[e.button] == "ClickLeft") {
    e.preventDefault();
  }
}


async function releaseKeydownList(key) {
  await delay(20);
  keyDownList[key] = false;
  if (key == setting["keySpeechRecognition"]) {
    speech.stopSpeechRecognition();
  }
}

function resetTooltipStatus(keyReset = true, mouseReset = true) {
  if (keyReset) {
    keyDownList = { always: true }; //reset key press
  }
  if (mouseReset) {
    mouseMoved = false;
    mouseMovedCount = 0;
  }
  selectedText = "";
  stagedText = null;
  hideTooltip();
  ocrView.removeAllOcrEnv();
  listenText = "";
  speech.stopSpeechRecognition();
}

async function restartWordProcess() {
  //rerun staged text
  await delay(10); //wait for select changed by click
  var selectedText = getSelectionText();
  stagedText = null;
  if (selectedText) {
    stageTooltipTextSelect("", false);
  } else {
    forceTriggerMouseoverText();
    // stageTooltipTextHover("", false);
  }
}

function setMouseStatus(e) {
  clientX = e.clientX;
  clientY = e.clientY;
  mouseTarget = e.target;
}
function setTooltipPosition(x, y) {
  if (tooltipContainerEle) {
    tooltipContainerEle.style.transform = `translate(${x}px,${y}px)`;
  }
}

function checkMouseOnceMoved(x, y) {
  if (
    mouseMoved == false &&
    Math.abs(x - clientX) + Math.abs(y - clientY) > 3 &&
    mouseMovedCount < 3
  ) {
    mouseMovedCount += 1;
  } else if (3 <= mouseMovedCount) {
    mouseMoved = true;
  }
  return mouseMoved;
}

function checkWindowFocus() {
  return mouseMoved && document.visibilityState == "visible";
}

function addMsgListener() {
  //handle copy
  util.addMessageListener("CopyRequest", (message) => {
    TextUtil.copyTextToClipboard(message.text);
  });
  util.addMessageListener("killAutoReaderTabs", killAutoReader);
}

function checkExcludeUrl() {
  var url = util.getCurrentUrl();
  var isExcludeBan = matchUrl(url, setting["websiteExcludeList"]);
  var isWhiteListBan =
    setting["websiteWhiteList"]?.length != 0 &&
    !matchUrl(url, setting["websiteWhiteList"]);
  if (isExcludeBan || isWhiteListBan) {
    return true;
  }
}

// setting handling & container style===============================================================

async function getSetting() {
  setting = await SettingUtil.loadSetting(function settingCallbackFn() {
    resetTooltipStatus(true, false);
    applyStyleSetting();
    checkVideo();
    speech.initSpeechRecognitionLang(setting);
  });
}


// url check and element env===============================================================

async function detectPDF() {
  if (setting["detectPDF"] == "true" && util.isPDF()) {
    util.addFrameListener("pdfErrorLoadDocument", openPdfIframeBlob);
    openPdfIframe(window.location.href);
  }
}

async function openPdfIframeBlob() {
  var url = window.location.href;
  var url = await util.getBlobUrl(url);
  openPdfIframe(url);
}

function openPdfIframe(url) {
  document.querySelectorAll("embed").forEach((el) => el.remove());

  var embedEl = document.createElement("embed");
  embedEl.id = "mttPdfIframe";
  embedEl.src = util.getPDFUrl(url);
  embedEl.style.cssText = "display:block;border:none;height:100vh;width:100vw;overflow:hidden";
  document.body.appendChild(embedEl);
}

//check google docs=========================================================
function checkGoogleDocs() {
  if (!util.isGoogleDoc()) {
    return;
  }
  interceptGoogleDocKeyEvent();
}

async function interceptGoogleDocKeyEvent() {
  await util.waitUntilForever(() => document.querySelector(".docs-texteventtarget-iframe"));
  var iframe = document.querySelector(".docs-texteventtarget-iframe");

  ["keydown", "keyup"].forEach((eventName) => {
    iframe?.contentWindow.addEventListener(eventName, (e) => {
      var evt = new CustomEvent(eventName, {
        bubbles: true,
        cancelable: false,
      });
      evt.key = e?.key;
      evt.code = e?.code;
      evt.ctrlKey = e?.ctrlKey;
      window.dispatchEvent(evt);
      document.dispatchEvent(evt);
    }, { signal });
  });
}

function injectGoogleDocAnnotation() {
  if (!util.isGoogleDoc()) {
    return;
  }
  var s = document.createElement("script");
  s.src = browser.runtime.getURL("googleDocInject.js"); //chrome.runtime.getURL("js/docs-canvas.js");
  document.documentElement.appendChild(s);
}

// youtube================================
function checkVideo() {
  for (var key in subtitle) {
    subtitle[key].handleVideo(setting);
  }
}

//destruction ===================================
function loadDestructor() {
  // Unload previous content script if needed
  window.dispatchEvent(new CustomEvent(destructionEvent)); //call destructor to remove script
  addEventHandler(destructionEvent, destructor); //add destructor listener for later remove
}

function destructor() {
  resetTooltipStatus();
  removePrevElement(); //remove element
  controller.abort(); //clear all event Listener by controller signal
}

function addEventHandler(eventName, callbackFunc, capture = true) {
  //record event for later event signal kill
  return window.addEventListener(eventName, callbackFunc, {
    capture: capture,
    signal,
  });
}

function removePrevElement() {
  document.getElementById("mttstyle")?.remove();
  document.getElementById("mttstyleSubtitle")?.remove();
  tooltip?.destroy();
}

// speech recognition ====================================================

function loadSpeechRecognition() {
  speech.initSpeechRecognition(
    (speechText, isFinal) => {
      if (isFinal) {
        listenText = speechText;
        stageTooltipText(listenText, "listen");
      }
    },
    () => {
      listenText = "";
    }
  );
  speech.initSpeechRecognitionLang(setting);
}
