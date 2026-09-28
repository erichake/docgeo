// The languages of DocTools.
const translations = {
    ar: {
        open_figure: "فتح شكل هندسي",
        figure_formats: "DocGeo (.dgo)، DGPad (.dgp) أو GeoGebra (.ggb)",
        open_failed: "تعذّر فتح الشكل",
        unsupported_title: "استيراد غير مكتمل",
        unsupported_text:
            "هذه العناصر غير مدعومة: تم تجاهلها مع العناصر التي تعتمد عليها.",
        close: "إغلاق",
        pause: "إيقاف مؤقت",
        play: "تشغيل",
    },
    de: {
        open_figure: "Figur öffnen",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) oder GeoGebra (.ggb)",
        open_failed: "Die Figur konnte nicht geöffnet werden",
        unsupported_title: "Unvollständiger Import",
        unsupported_text:
            "Diese Elemente werden nicht unterstützt: Sie wurden zusammen mit den von ihnen abhängigen Elementen ignoriert.",
        close: "Schließen",
        pause: "Pause",
        play: "Abspielen",
    },
    el: {
        open_figure: "Άνοιγμα σχήματος",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) ή GeoGebra (.ggb)",
        open_failed: "Δεν ήταν δυνατό το άνοιγμα του σχήματος",
        unsupported_title: "Ελλιπής εισαγωγή",
        unsupported_text:
            "Αυτά τα στοιχεία δεν υποστηρίζονται: αγνοήθηκαν, μαζί με όσα εξαρτώνται από αυτά.",
        close: "Κλείσιμο",
        pause: "Παύση",
        play: "Αναπαραγωγή",
    },
    en: {
        open_figure: "Open a figure",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) or GeoGebra (.ggb)",
        open_failed: "The figure could not be opened",
        unsupported_title: "Incomplete import",
        unsupported_text:
            "These elements are not supported: they were ignored, along with those that depend on them.",
        close: "Close",
        pause: "Pause",
        play: "Play",
    },
    es: {
        open_figure: "Abrir una figura",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) o GeoGebra (.ggb)",
        open_failed: "No se pudo abrir la figura",
        unsupported_title: "Importación incompleta",
        unsupported_text:
            "Estos elementos no son compatibles: se han ignorado, junto con los que dependen de ellos.",
        close: "Cerrar",
        pause: "Pausa",
        play: "Reproducir",
    },
    fr: {
        open_figure: "Ouvrir une figure",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) ou GeoGebra (.ggb)",
        open_failed: "Impossible d'ouvrir la figure",
        unsupported_title: "Import incomplet",
        unsupported_text:
            "Ces éléments ne sont pas pris en charge : ils ont été ignorés, ainsi que ceux qui en dépendent.",
        close: "Fermer",
        pause: "Pause",
        play: "Lecture",
    },
    hi: {
        open_figure: "आकृति खोलें",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) या GeoGebra (.ggb)",
        open_failed: "आकृति नहीं खोली जा सकी",
        unsupported_title: "अधूरा आयात",
        unsupported_text:
            "ये तत्व समर्थित नहीं हैं: इन्हें और इन पर निर्भर तत्वों को अनदेखा कर दिया गया।",
        close: "बंद करें",
        pause: "रोकें",
        play: "चलाएँ",
    },
    it: {
        open_figure: "Apri una figura",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) o GeoGebra (.ggb)",
        open_failed: "Impossibile aprire la figura",
        unsupported_title: "Importazione incompleta",
        unsupported_text:
            "Questi elementi non sono supportati: sono stati ignorati, insieme a quelli che ne dipendono.",
        close: "Chiudi",
        pause: "Pausa",
        play: "Riproduci",
    },
    nl: {
        open_figure: "Figuur openen",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) of GeoGebra (.ggb)",
        open_failed: "De figuur kon niet worden geopend",
        unsupported_title: "Onvolledige import",
        unsupported_text:
            "Deze elementen worden niet ondersteund: ze zijn genegeerd, samen met de elementen die ervan afhangen.",
        close: "Sluiten",
        pause: "Pauzeren",
        play: "Afspelen",
    },
    pt: {
        open_figure: "Abrir uma figura",
        figure_formats: "DocGeo (.dgo), DGPad (.dgp) ou GeoGebra (.ggb)",
        open_failed: "Não foi possível abrir a figura",
        unsupported_title: "Importação incompleta",
        unsupported_text:
            "Estes elementos não são suportados: foram ignorados, juntamente com os que dependem deles.",
        close: "Fechar",
        pause: "Pausar",
        play: "Reproduzir",
    },
    zh: {
        open_figure: "打开图形",
        figure_formats: "DocGeo (.dgo)、DGPad (.dgp) 或 GeoGebra (.ggb)",
        open_failed: "无法打开图形",
        unsupported_title: "导入不完整",
        unsupported_text:
            "以下元素不受支持：它们以及依赖于它们的元素已被忽略。",
        close: "关闭",
        pause: "暂停",
        play: "播放",
    },
    "zh-TW": {
        open_figure: "開啟圖形",
        figure_formats: "DocGeo (.dgo)、DGPad (.dgp) 或 GeoGebra (.ggb)",
        open_failed: "無法開啟圖形",
        unsupported_title: "匯入不完整",
        unsupported_text: "以下元素不受支援：它們以及依賴它們的元素已被忽略。",
        close: "關閉",
        pause: "暫停",
        play: "播放",
    },
};

type Lang = keyof typeof translations;

// A `lang` URL parameter, set by the host application, prevails over the
// browser's languages.
export const LANG = resolveLang([
    new URLSearchParams(window.location.search).get("lang"),
    ...navigator.languages,
]);

export const DIR = LANG === "ar" ? "rtl" : "ltr";

export function t(key: keyof (typeof translations)["en"]): string {
    return translations[LANG][key];
}

function resolveLang(tags: (string | null)[]): Lang {
    const langs = Object.keys(translations) as Lang[];
    for (const tag of tags) {
        if (!tag) continue;
        const lower = tag.toLowerCase();
        const found =
            langs.find((lang) => lang.toLowerCase() === lower) ??
            langs.find((lang) => lang === lower.split("-")[0]);
        if (found) return found;
    }
    return "en";
}
