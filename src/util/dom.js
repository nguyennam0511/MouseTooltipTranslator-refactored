import * as util from "/src/util";

export function getFocusedWritingBox() {
  //check doucment input box focused
  var writingBox = util.getActiveElement();
  if (writingBox && writingBox.matches && writingBox.matches(util.writingField)) {
    return writingBox;
  }
}

export function waitDocumentReady() {
  return new Promise((resolve) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", resolve);
    }
  });
}