import tippy, { sticky } from "tippy.js";
import { getRtlDir } from "/src/util/lang.js";

export function addElementEnv() {
    var tooltipContainerEle = document.createElement("div");
    tooltipContainerEle.id = "mttContainer";
    tooltipContainerEle.className = "notranslate";
    var tooltipContainer = tooltipContainerEle;

    var style = document.createElement("style");
    style.id = "mttstyle";
    document.head.appendChild(style);

    var styleSubtitle = document.createElement("style");
    styleSubtitle.id = "mttstyleSubtitle";
    document.head.appendChild(styleSubtitle);

    var tooltip = tippy(tooltipContainerEle, {
        content: "",
        trigger: "manual",
        allowHTML: true,
        theme: "custom",
        zIndex: 100000200,
        hideOnClick: false,
        role: "mtttooltip",
        interactive: true,
        plugins: [sticky],
    });

    return { tooltipContainerEle, tooltipContainer, style, styleSubtitle, tooltip };
}

export function applyStyleSetting(setting, tooltip, tooltipContainerEle, style, styleSubtitle) {
    var isSticky = setting["tooltipPosition"] == "follow";
    tooltip.setProps({
        offset: [0, setting["tooltipDistance"]],
        sticky: isSticky ? "reference" : "popper",
        appendTo: isSticky ? tooltipContainerEle : document.body,
        animation: setting["tooltipAnimation"],
    });
    var rtlDirection = getRtlDir(setting["translateTarget"]);

    style.textContent = `
    #mttContainer {
      left: 0 !important;
      top: 0 !important;
      width: 1000px !important;
      margin: 0px !important;
      margin-left: -500px !important;
      position: fixed !important;
      z-index: 2147483647 !important; /* Maximum z-index to overcome overlays */
      background: none !important;
      pointer-events: none !important;
      display: inline-block !important;
      visibility: visible  !important;
      white-space: pre-line;
    }
    .tippy-box[data-theme~="custom"], .tippy-box[data-theme~="ocr"], .tippy-content *{
      font-size: ${setting["tooltipFontSize"]}px  !important;
      text-align: ${setting["tooltipTextAlign"]} !important;
      overflow-wrap: break-word !important;
      color: ${setting["tooltipFontColor"]} !important;
      font-family: 
        -apple-system, BlinkMacSystemFont,
        "Segoe UI", "Roboto", "Oxygen",
        "Ubuntu", "Cantarell", "Fira Sans",
        "Droid Sans", "Helvetica Neue", sans-serif  !important;
      white-space: pre-line;
    }
    .tippy-box[data-theme~="custom"]{
      max-width: ${setting["tooltipWidth"]}px  !important;
      backdrop-filter: blur(${setting["tooltipBackgroundBlur"]}px) !important;
      background-color: ${setting["tooltipBackgroundColor"]} !important;
      border: 1px solid ${setting["tooltipBorderColor"]}; 
      box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;
      opacity: 1.0; /* Adjusted opacity for transparency */
    }
    .tippy-box[data-theme~="ocr"]{
      max-width: $1000px  !important;
      backdrop-filter: blur(${setting["tooltipBackgroundBlur"]}px) !important;
      background-color: ${setting["tooltipBackgroundColor"]} !important;
      border: 1px solid ${setting["tooltipBorderColor"]}; 
      box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;
      opacity: 1.0; /* Adjusted opacity for transparency */
    }
    .tippy-box[data-theme~="transparent"] {
      max-width: $1000px  !important;
      backdrop-filter: blur(${setting["tooltipBackgroundBlur"]}px) !important;
      background-color: ${setting["tooltipBackgroundColor"]} !important;
      border: 1px solid ${setting["tooltipBorderColor"]}; 
      box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;
      opacity: 0.0; /* Adjusted opacity for transparency */
      transition: opacity 0.3s ease-in-out; /* Added transition for opacity */
    }
    [data-tippy-root] {
      display: inline-block !important;
      visibility: visible  !important;
    }
    .tippy-box[data-theme~='custom'][data-placement^='top'] > .tippy-arrow::before, .tippy-box[data-theme~='ocr'][data-placement^='top'] > .tippy-arrow::before { 
      border-top-color: ${setting["tooltipBackgroundColor"]} !important;
    }
    .tippy-box[data-theme~='custom'][data-placement^='bottom'] > .tippy-arrow::before, .tippy-box[data-theme~='ocr'][data-placement^='bottom'] > .tippy-arrow::before {
      border-bottom-color: ${setting["tooltipBackgroundColor"]} !important;
    }
    .tippy-box[data-theme~='custom'][data-placement^='left'] > .tippy-arrow::before, .tippy-box[data-theme~='ocr'][data-placement^='left'] > .tippy-arrow::before {
      border-left-color: ${setting["tooltipBackgroundColor"]} !important;
    }
    .tippy-box[data-theme~='custom'][data-placement^='right'] > .tippy-arrow::before, .tippy-box[data-theme~='ocr'][data-placement^='right'] > .tippy-arrow::before {
      border-right-color: ${setting["tooltipBackgroundColor"]} !important;
    }

    .mtt-highlight{
      background-color: ${setting["mouseoverTextHighlightColor"]}  !important;
      position: absolute !important;   
      z-index: 2147483646 !important; /* Slightly lower than tooltip */
      pointer-events: none !important;
      display: inline !important;
      border-radius: 3px !important;
    }
    .mtt-image{
      width: ${Number(setting["tooltipWidth"]) - 20}px  !important;
      border-radius: 3px !important;
    }
    .ocr_text_div{
      position: absolute;
      opacity: 0.4;
      color: transparent !important;
      border: 2px solid CornflowerBlue;
      background: none !important;
      border-radius: 3px !important;
    }`;

    styleSubtitle.textContent = `
    #ytp-caption-window-container .ytp-caption-segment {
      cursor: text !important;
      user-select: text !important;
      font-family: 
      -apple-system, BlinkMacSystemFont,
      "Segoe UI", "Roboto", "Oxygen",
      "Ubuntu", "Cantarell", "Fira Sans",
      "Droid Sans", "Helvetica Neue", sans-serif  !important;
    }
    .caption-visual-line{
      display: flex  !important;
      align-items: stretch  !important;
      direction: ${rtlDirection}
    }
    .captions-text .caption-visual-line:first-of-type:after {
      content: '⣿⣿';
      border-radius: 3px !important;
      color: white !important;
      background: transparent !important;
      box-shadow: rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset;
      display: inline-block;
      vertical-align: top;
      opacity:0;
      transition: opacity 0.7s ease-in-out;
    }
    .ytp-caption-segment{
      color: white !important;
      text-shadow: 1px 1px 2px black !important;
      backdrop-filter: blur(3px) !important;
      background: rgba(8, 8, 8, 0.1)  !important;
    }
    .captions-text:hover .caption-visual-line:first-of-type:after {
      opacity:1;
    }
    .ytp-pause-overlay {
      display: none !important;
    }
    .ytp-expand-pause-overlay .caption-window {
      display: block !important;
    }
  `;
    styleSubtitle.disabled = (setting["detectSubtitle"] === "null");
}
