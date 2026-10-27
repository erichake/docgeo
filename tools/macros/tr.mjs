// The languages of the editor, and a text in each, in this order.

export const LANGS = [
    "fr",
    "en",
    "de",
    "es",
    "it",
    "pt",
    "nl",
    "el",
    "ar",
    "hi",
    "zh",
    "zh-TW",
];

export const tr = (...texts) => {
    if (texts.length !== LANGS.length)
        throw new Error(`${texts[0]}: ${texts.length} languages`);
    return Object.fromEntries(LANGS.map((lang, index) => [lang, texts[index]]));
};
