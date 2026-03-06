import * as util from "/src/util";
import delay from "delay";

export async function handleTTS(
    text,
    sourceLang,
    targetText,
    targetLang,
    timestamp,
    noInterrupt,
    isTtsSwap
) {
    //kill auto reader if tts is on
    util.requestKillAutoReaderTabs(true);
    await delay(50);
    //tts
    callTTS(
        text,
        sourceLang,
        targetText,
        targetLang,
        timestamp,
        noInterrupt,
        isTtsSwap
    );
}

async function callTTS(
    text,
    sourceLang,
    targetText,
    targetLang,
    timestamp,
    noInterrupt,
    isTtsSwap
) {
    if (isTtsSwap) {
        await util.requestTTS(
            targetText,
            targetLang,
            text,
            sourceLang,
            timestamp + 100,
            noInterrupt
        );
        return;
    }
    await util.requestTTS(
        text,
        sourceLang,
        targetText,
        targetLang,
        timestamp + 100,
        noInterrupt
    );
}
