// Manuel de DocGeo : en-tête, table des matières, recherche et navigation,
// ajoutés autour du <main> de chaque page, dans la langue de la page
// (<html lang>). Chaque langue a son dossier, aux mêmes noms de pages.

const PAGES = [
    [
        "index.html",
        "demarrage.html",
        "interface.html",
        "integration.html",
        "installer.html",
    ],
    [
        "gestes.html",
        "menu-outils.html",
        "selection.html",
        "saisie.html",
        "expressions.html",
        "3d.html",
        "macros.html",
        "tableur.html",
        "calcul-formel.html",
    ],
    ["objets.html", "points-dynamiques.html", "proprietes.html"],
    [
        "commandes.html",
        "formules.html",
        "raccourcis.html",
        "formats.html",
        "faq.html",
        "historique.html",
    ],
];

// Dans l'ordre du menu des langues de DocTools : le nom de la langue, les
// titres des groupes et des pages de PAGES, les textes de l'interface.
const LANGS = {
    de: {
        name: "Deutsch",
        groups: ["Erste Schritte", "Konstruieren", "Bearbeiten", "Referenz"],
        pages: [
            "Startseite",
            "Öffnen und Speichern",
            "Die Oberfläche",
            "In eine Webseite einbetten",
            "DocGeo installieren",
            "Mit Gesten",
            "Mit der Palette",
            "Per Mehrfachauswahl",
            "Mit der Tastatur",
            "Ausdrücke und Schieberegler",
            "3D",
            "Makros",
            "Die Tabellenkalkulation",
            "Computeralgebra",
            "Objekte verwalten",
            "Magnete, Reißzwecke und Feder",
            "Eigenschaften und Koordinatensystem",
            "Die Befehle",
            "Formeln und Programme",
            "Tastenkürzel und Gesten",
            "Import aus DGPad und GeoGebra",
            "Häufige Fragen",
            "Projektgeschichte",
        ],
        ui: {
            manual: "Handbuch",
            title: "DocGeo-Handbuch",
            toc: "Inhaltsverzeichnis",
            search: "Im Handbuch suchen",
            ctrl: "Strg",
            editor: "DocGeo öffnen",
            apps: "Anwendungen",
            language: "Sprache",
            onPage: "Auf dieser Seite",
            anchor: "Link zu diesem Abschnitt",
            pager: "Benachbarte Seiten",
            previous: "← Zurück",
            next: "Weiter →",
            empty: "Keine Ergebnisse für „%“.",
            server: "Die Volltextsuche setzt voraus, dass das Handbuch über einen Webserver geöffnet wird.",
            zoom: "Vergrößerter Screenshot",
            copy: "Kopieren",
            video: "Video auf Französisch, mit deutschen Untertiteln.",
        },
    },
    en: {
        name: "English",
        groups: ["Getting started", "Building", "Editing", "Reference"],
        pages: [
            "Home",
            "Opening and saving",
            "The interface",
            "Embedding in a web page",
            "Installing DocGeo",
            "By gesture",
            "From the palette",
            "By multiple selection",
            "With the keyboard",
            "Expressions and sliders",
            "3D",
            "Macros",
            "The spreadsheet",
            "Computer algebra",
            "Managing objects",
            "Magnets, pin and spring",
            "Properties and coordinate system",
            "Commands",
            "Formulas and programs",
            "Shortcuts and gestures",
            "DGPad and GeoGebra import",
            "FAQ",
            "Project history",
        ],
        ui: {
            manual: "Manual",
            title: "DocGeo manual",
            toc: "Contents",
            search: "Search the manual",
            editor: "Open DocGeo",
            apps: "Applications",
            language: "Language",
            onPage: "On this page",
            anchor: "Link to this section",
            pager: "Neighboring pages",
            previous: "← Previous",
            next: "Next →",
            empty: "No results for “%”.",
            server: "Searching the text requires the manual to be opened from a web server.",
            zoom: "Enlarged screenshot",
            copy: "Copy",
            video: "Video in French, with English subtitles.",
        },
    },
    es: {
        name: "Español",
        groups: ["Primeros pasos", "Construir", "Modificar", "Referencia"],
        pages: [
            "Inicio",
            "Abrir y guardar",
            "La interfaz",
            "Insertar en una página web",
            "Instalar DocGeo",
            "Con gestos",
            "Con la paleta",
            "Por selección múltiple",
            "Con el teclado",
            "Expresiones y deslizadores",
            "3D",
            "Las macros",
            "La hoja de cálculo",
            "El cálculo simbólico",
            "Gestionar los objetos",
            "Imanes, chincheta y resorte",
            "Propiedades y sistema de coordenadas",
            "Los comandos",
            "Fórmulas y programas",
            "Atajos y gestos",
            "Importación de DGPad y GeoGebra",
            "Preguntas frecuentes",
            "Historia del proyecto",
        ],
        ui: {
            manual: "Manual",
            title: "Manual de DocGeo",
            toc: "Índice",
            search: "Buscar en el manual",
            editor: "Abrir DocGeo",
            apps: "Aplicaciones",
            language: "Idioma",
            onPage: "En esta página",
            anchor: "Enlace a esta sección",
            pager: "Páginas contiguas",
            previous: "← Anterior",
            next: "Siguiente →",
            empty: "Ningún resultado para «%».",
            server: "La búsqueda en el texto requiere abrir el manual desde un servidor web.",
            zoom: "Captura ampliada",
            copy: "Copiar",
            video: "Vídeo en francés, con subtítulos en español.",
        },
    },
    fr: {
        name: "Français",
        groups: ["Premiers pas", "Construire", "Modifier", "Référence"],
        pages: [
            "Accueil",
            "Ouvrir et enregistrer",
            "L’interface",
            "Intégrer dans une page web",
            "Installer DocGeo",
            "Au geste",
            "À la palette",
            "Par sélection multiple",
            "Au clavier",
            "Expressions et curseurs",
            "La 3D",
            "Les macros",
            "Le tableur",
            "Le calcul formel",
            "Gérer les objets",
            "Aimants, punaise et ressort",
            "Propriétés et repère",
            "Les commandes",
            "Formules et programmes",
            "Raccourcis et gestes",
            "Import DGPad et GeoGebra",
            "Questions fréquentes",
            "Historique du projet",
        ],
        ui: {
            manual: "Manuel",
            title: "Manuel DocGeo",
            toc: "Table des matières",
            search: "Rechercher dans le manuel",
            editor: "Ouvrir DocGeo",
            apps: "Applications",
            language: "Langue",
            onPage: "Sur cette page",
            anchor: "Lien vers cette section",
            pager: "Pages voisines",
            previous: "← Précédent",
            next: "Suivant →",
            empty: "Aucun résultat pour « % ».",
            server: "La recherche dans le texte demande que le manuel soit ouvert depuis un serveur web.",
            zoom: "Capture agrandie",
            copy: "Copier",
            video: "Sous-titres en 12 langues, dans le menu du lecteur.",
        },
    },
    el: {
        name: "Ελληνικά",
        groups: ["Πρώτα βήματα", "Κατασκευή", "Τροποποίηση", "Αναφορά"],
        pages: [
            "Αρχική",
            "Άνοιγμα και αποθήκευση",
            "Το περιβάλλον εργασίας",
            "Ενσωμάτωση σε ιστοσελίδα",
            "Εγκατάσταση του DocGeo",
            "Με χειρονομίες",
            "Με την παλέτα",
            "Με πολλαπλή επιλογή",
            "Με το πληκτρολόγιο",
            "Εκφράσεις και δρομείς",
            "3D",
            "Μακροεντολές",
            "Το υπολογιστικό φύλλο",
            "Συμβολικός υπολογισμός",
            "Διαχείριση αντικειμένων",
            "Μαγνήτες, πινέζα και ελατήριο",
            "Ιδιότητες και σύστημα συντεταγμένων",
            "Οι εντολές",
            "Τύποι και προγράμματα",
            "Συντομεύσεις και χειρονομίες",
            "Εισαγωγή από DGPad και GeoGebra",
            "Συχνές ερωτήσεις",
            "Ιστορικό του έργου",
        ],
        ui: {
            manual: "Εγχειρίδιο",
            title: "Εγχειρίδιο DocGeo",
            toc: "Περιεχόμενα",
            search: "Αναζήτηση στο εγχειρίδιο",
            editor: "Άνοιγμα του DocGeo",
            apps: "Εφαρμογές",
            language: "Γλώσσα",
            onPage: "Σε αυτή τη σελίδα",
            anchor: "Σύνδεσμος σε αυτή την ενότητα",
            pager: "Γειτονικές σελίδες",
            previous: "← Προηγούμενη",
            next: "Επόμενη →",
            empty: "Κανένα αποτέλεσμα για «%».",
            server: "Η αναζήτηση στο κείμενο απαιτεί να ανοίξει το εγχειρίδιο από διακομιστή ιστού.",
            zoom: "Μεγεθυμένο στιγμιότυπο",
            copy: "Αντιγραφή",
            video: "Βίντεο στα γαλλικά, με ελληνικούς υπότιτλους.",
        },
    },
    it: {
        name: "Italiano",
        groups: ["Primi passi", "Costruire", "Modificare", "Riferimento"],
        pages: [
            "Pagina iniziale",
            "Aprire e salvare",
            "L’interfaccia",
            "Incorporare in una pagina web",
            "Installare DocGeo",
            "Con i gesti",
            "Con la tavolozza",
            "Per selezione multipla",
            "Con la tastiera",
            "Espressioni e slider",
            "Il 3D",
            "Le macro",
            "Il foglio di calcolo",
            "Il calcolo simbolico",
            "Gestire gli oggetti",
            "Calamite, puntina e molla",
            "Proprietà e sistema di riferimento",
            "I comandi",
            "Formule e programmi",
            "Scorciatoie e gesti",
            "Importazione da DGPad e GeoGebra",
            "Domande frequenti",
            "Storia del progetto",
        ],
        ui: {
            manual: "Manuale",
            title: "Manuale di DocGeo",
            toc: "Indice",
            search: "Cerca nel manuale",
            editor: "Apri DocGeo",
            apps: "Applicazioni",
            language: "Lingua",
            onPage: "In questa pagina",
            anchor: "Link a questa sezione",
            pager: "Pagine vicine",
            previous: "← Precedente",
            next: "Successiva →",
            empty: "Nessun risultato per «%».",
            server: "La ricerca nel testo richiede che il manuale sia aperto da un server web.",
            zoom: "Schermata ingrandita",
            copy: "Copia",
            video: "Video in francese, con sottotitoli in italiano.",
        },
    },
    nl: {
        name: "Nederlands",
        groups: ["Aan de slag", "Construeren", "Wijzigen", "Naslag"],
        pages: [
            "Startpagina",
            "Openen en opslaan",
            "De interface",
            "In een webpagina insluiten",
            "DocGeo installeren",
            "Met gebaren",
            "Met het palet",
            "Via meervoudige selectie",
            "Met het toetsenbord",
            "Uitdrukkingen en schuifknoppen",
            "3D",
            "Macro's",
            "Het rekenblad",
            "Computeralgebra",
            "Objecten beheren",
            "Magneten, punaise en veer",
            "Eigenschappen en assenstelsel",
            "De opdrachten",
            "Formules en programma’s",
            "Sneltoetsen en gebaren",
            "Import uit DGPad en GeoGebra",
            "Veelgestelde vragen",
            "Geschiedenis van het project",
        ],
        ui: {
            manual: "Handleiding",
            title: "DocGeo-handleiding",
            toc: "Inhoud",
            search: "Zoeken in de handleiding",
            editor: "DocGeo openen",
            apps: "Toepassingen",
            language: "Taal",
            onPage: "Op deze pagina",
            anchor: "Link naar deze sectie",
            pager: "Naburige pagina’s",
            previous: "← Vorige",
            next: "Volgende →",
            empty: "Geen resultaten voor ‘%’.",
            server: "Zoeken in de tekst vereist dat de handleiding via een webserver wordt geopend.",
            zoom: "Vergrote schermafbeelding",
            copy: "Kopiëren",
            video: "Video in het Frans, met Nederlandse ondertitels.",
        },
    },
    pt: {
        name: "Português",
        groups: ["Primeiros passos", "Construir", "Modificar", "Referência"],
        pages: [
            "Início",
            "Abrir e salvar",
            "A interface",
            "Incorporar em uma página web",
            "Instalar o DocGeo",
            "Com gestos",
            "Com a paleta",
            "Por seleção múltipla",
            "Com o teclado",
            "Expressões e controles deslizantes",
            "3D",
            "As macros",
            "A planilha",
            "O cálculo simbólico",
            "Gerenciar os objetos",
            "Ímãs, tachinha e mola",
            "Propriedades e sistema de coordenadas",
            "Os comandos",
            "Fórmulas e programas",
            "Atalhos e gestos",
            "Importação do DGPad e do GeoGebra",
            "Perguntas frequentes",
            "Histórico do projeto",
        ],
        ui: {
            manual: "Manual",
            title: "Manual do DocGeo",
            toc: "Sumário",
            search: "Pesquisar no manual",
            editor: "Abrir o DocGeo",
            apps: "Aplicativos",
            language: "Idioma",
            onPage: "Nesta página",
            anchor: "Link para esta seção",
            pager: "Páginas vizinhas",
            previous: "← Anterior",
            next: "Próxima →",
            empty: "Nenhum resultado para “%”.",
            server: "A pesquisa no texto exige que o manual seja aberto a partir de um servidor web.",
            zoom: "Captura ampliada",
            copy: "Copiar",
            video: "Vídeo em francês, com legendas em português.",
        },
    },
    ar: {
        name: "العربية",
        groups: ["الخطوات الأولى", "الإنشاء", "التعديل", "المرجع"],
        pages: [
            "الرئيسية",
            "الفتح والحفظ",
            "الواجهة",
            "التضمين في صفحة ويب",
            "تثبيت DocGeo",
            "بالإيماءات",
            "بلوحة الأدوات",
            "بالتحديد المتعدد",
            "بلوحة المفاتيح",
            "التعابير والمنزلقات",
            "الأبعاد الثلاثة",
            "وحدات الماكرو",
            "جدول البيانات",
            "الحساب الرمزي",
            "إدارة العناصر",
            "المغانط والدبوس والنابض",
            "الخصائص والمَعلم",
            "الأوامر",
            "الصيغ والبرامج",
            "الاختصارات والإيماءات",
            "الاستيراد من DGPad وGeoGebra",
            "أسئلة شائعة",
            "تاريخ المشروع",
        ],
        ui: {
            manual: "الدليل",
            title: "دليل DocGeo",
            toc: "المحتويات",
            search: "ابحث في الدليل",
            editor: "افتح DocGeo",
            apps: "التطبيقات",
            language: "اللغة",
            onPage: "في هذه الصفحة",
            anchor: "رابط إلى هذا القسم",
            pager: "الصفحات المجاورة",
            previous: "→ السابق",
            next: "التالي ←",
            empty: "لا نتائج لـ «%».",
            server: "يتطلب البحث في النص فتح الدليل من خادم ويب.",
            zoom: "لقطة شاشة مكبّرة",
            copy: "نسخ",
            video: "فيديو باللغة الفرنسية، مع ترجمة إلى العربية.",
        },
    },
    hi: {
        name: "हिन्दी",
        groups: ["शुरुआत", "रचना करना", "बदलाव करना", "संदर्भ"],
        pages: [
            "मुखपृष्ठ",
            "खोलना और सहेजना",
            "इंटरफ़ेस",
            "वेब पेज में एम्बेड करना",
            "DocGeo इंस्टॉल करना",
            "इशारों से",
            "टूल पैलेट से",
            "बहु-चयन से",
            "कीबोर्ड से",
            "व्यंजक और स्लाइडर",
            "3D",
            "मैक्रो",
            "स्प्रेडशीट",
            "प्रतीकात्मक गणना",
            "ऑब्जेक्ट प्रबंधित करना",
            "चुंबक, पिन और स्प्रिंग",
            "गुण और निर्देशांक प्रणाली",
            "कमांड",
            "सूत्र और प्रोग्राम",
            "शॉर्टकट और इशारे",
            "DGPad और GeoGebra से आयात",
            "अक्सर पूछे जाने वाले प्रश्न",
            "परियोजना का इतिहास",
        ],
        ui: {
            manual: "पुस्तिका",
            title: "DocGeo पुस्तिका",
            toc: "विषय-सूची",
            search: "पुस्तिका में खोजें",
            editor: "DocGeo खोलें",
            apps: "ऐप्लिकेशन",
            language: "भाषा",
            onPage: "इस पृष्ठ पर",
            anchor: "इस खंड का लिंक",
            pager: "आस-पास के पृष्ठ",
            previous: "← पिछला",
            next: "अगला →",
            empty: "“%” के लिए कोई परिणाम नहीं।",
            server: "पाठ में खोज के लिए पुस्तिका को किसी वेब सर्वर से खोलना आवश्यक है।",
            zoom: "बड़ा किया गया स्क्रीनशॉट",
            copy: "कॉपी करें",
            video: "वीडियो फ़्रेंच में है, हिंदी उपशीर्षकों के साथ।",
        },
    },
    zh: {
        name: "中文",
        groups: ["入门", "作图", "修改", "参考"],
        pages: [
            "首页",
            "打开与保存",
            "界面",
            "嵌入网页",
            "安装 DocGeo",
            "用手势作图",
            "用工具面板作图",
            "用多选作图",
            "用键盘作图",
            "表达式与滑动条",
            "3D",
            "宏",
            "电子表格",
            "符号计算",
            "管理对象",
            "磁铁、图钉和弹簧",
            "属性与坐标系",
            "命令",
            "公式与程序",
            "快捷键与手势",
            "导入 DGPad 和 GeoGebra 图形",
            "常见问题",
            "项目历史",
        ],
        ui: {
            manual: "手册",
            title: "DocGeo 手册",
            toc: "目录",
            search: "搜索手册",
            editor: "打开 DocGeo",
            apps: "应用",
            language: "语言",
            onPage: "本页内容",
            anchor: "链接到本节",
            pager: "相邻页面",
            previous: "← 上一页",
            next: "下一页 →",
            empty: "没有找到“%”的结果。",
            server: "全文搜索需要通过网页服务器打开手册。",
            zoom: "放大的截图",
            copy: "复制",
            video: "视频为法语，配有中文字幕。",
        },
    },
    "zh-TW": {
        name: "繁體中文",
        groups: ["入門", "作圖", "修改", "參考"],
        pages: [
            "首頁",
            "開啟與儲存",
            "介面",
            "嵌入網頁",
            "安裝 DocGeo",
            "用手勢作圖",
            "用工具面板作圖",
            "用多選作圖",
            "用鍵盤作圖",
            "運算式與滑桿",
            "3D",
            "巨集",
            "試算表",
            "符號運算",
            "管理物件",
            "磁鐵、圖釘和彈簧",
            "屬性與座標系",
            "指令",
            "公式與程式",
            "快速鍵與手勢",
            "匯入 DGPad 和 GeoGebra 圖形",
            "常見問題",
            "專案歷史",
        ],
        ui: {
            manual: "手冊",
            title: "DocGeo 手冊",
            toc: "目錄",
            search: "搜尋手冊",
            editor: "開啟 DocGeo",
            apps: "應用程式",
            language: "語言",
            onPage: "本頁內容",
            anchor: "連結到本節",
            pager: "相鄰頁面",
            previous: "← 上一頁",
            next: "下一頁 →",
            empty: "找不到「%」的結果。",
            server: "全文搜尋需要透過網頁伺服器開啟手冊。",
            zoom: "放大的截圖",
            copy: "複製",
            video: "影片為法語，附中文字幕。",
        },
    },
};

const lang = document.documentElement.lang;
const { groups, pages, ui } = LANGS[lang];
let rank = 0;
const FLAT = PAGES.flatMap((files, k) =>
    files.map((file) => ({ file, title: pages[rank++], group: groups[k] })),
);
const here = location.pathname.split("/").pop() || "index.html";
const current = FLAT.find((page) => page.file === here) ?? FLAT[0];
const main = document.querySelector("main");

const html = (strings, ...values) =>
    strings.reduce((out, string, k) => out + values[k - 1] + string);
const escape = (text) =>
    text.replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
const element = (source) => {
    const template = document.createElement("template");
    template.innerHTML = source.trim();
    return template.content.firstElementChild;
};

// Sans casse ni accents, caractère pour caractère : une position dans le
// texte replié est aussi une position dans le texte d'origine.
const fold = (text) =>
    Array.from(text, (c) => {
        const folded = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
        return folded.length === 1 ? folded : c;
    }).join("");

const slug = (text) =>
    fold(text)
        .replace(/[’']/g, "-")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");

// Les titres d'une page, chacun avec un identifiant.
function headings(root) {
    const taken = new Set();
    return [...root.querySelectorAll("h2, h3")].map((heading) => {
        if (!heading.id) {
            const base = slug(heading.textContent) || "section";
            let id = base;
            for (
                let n = 2;
                taken.has(id) || root.querySelector(`[id="${id}"]`);
                n++
            )
                id = `${base}-${n}`;
            heading.id = id;
        }
        taken.add(heading.id);
        return heading;
    });
}

// ------------------------------------------------------------ icônes

function icons() {
    const { actions, tools } = window.DG_ICONS ?? {};
    if (!actions) return;
    document.querySelectorAll("i[data-i]").forEach((i) => {
        i.classList.add("ai");
        i.setAttribute("aria-hidden", "true");
        i.innerHTML = `<svg viewBox="0 0 24 24">${actions[i.dataset.i] ?? ""}</svg>`;
    });
    document.querySelectorAll("i[data-t]").forEach((i) => {
        const [hue, tone, icon] = tools[i.dataset.t] ?? [210, 0, ""];
        i.classList.add("ti");
        i.setAttribute("aria-hidden", "true");
        i.style.setProperty("--h", hue);
        i.style.setProperty("--t", tone);
        i.innerHTML = `<svg viewBox="0 0 24 24">${icon}</svg>`;
    });
}

// ---------------------------------------------------------- squelette

const SEARCH_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const COPY_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`;
const COPIED_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>`;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

function frame() {
    const header = element(html`
        <header class="m-header">
            <button
                class="m-burger"
                aria-label="${ui.toc}"
                aria-expanded="false"
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <a class="m-brand" href="index.html"
                ><img src="../../favicon.svg" alt="" />DocGeo
                <span>${ui.manual}</span></a
            >
            <div class="m-search" role="search">
                <input
                    type="search"
                    placeholder="${ui.search}"
                    aria-label="${ui.search}"
                    autocomplete="off"
                    spellcheck="false"
                />
                ${SEARCH_ICON}
                <kbd>${isMac ? "⌘" : (ui.ctrl ?? "Ctrl")} K</kbd>
                <div class="m-results" role="listbox" hidden></div>
            </div>
            <select class="m-lang" aria-label="${ui.language}">
                ${Object.entries(LANGS)
                    .map(
                        ([code, { name }]) =>
                            `<option value="${code}" lang="${code}"${code === lang ? " selected" : ""}>${name}</option>`,
                    )
                    .join("")}
            </select>
            <nav class="m-apps" aria-label="${ui.apps}">
                <a href="../../editor.html?lang=${lang}">${ui.editor}</a>
            </nav>
        </header>
    `);

    const side = element(`<nav class="m-side" aria-label="${ui.toc}"></nav>`);
    for (const group of groups) {
        side.append(element(`<h2>${group}</h2>`));
        const list = element("<ul></ul>");
        for (const { file, title } of FLAT.filter((p) => p.group === group)) {
            const item = element(
                `<li><a href="${file}"${file === current.file ? ' class="current" aria-current="page"' : ""}>${title}</a></li>`,
            );
            if (file === current.file) {
                const sections = headings(main).filter(
                    (h) => h.tagName === "H2",
                );
                if (sections.length) {
                    const sub = element("<ul></ul>");
                    for (const h of sections)
                        sub.append(
                            element(
                                `<li><a href="#${h.id}">${escape(h.textContent)}</a></li>`,
                            ),
                        );
                    item.append(sub);
                }
            }
            list.append(item);
        }
        side.append(list);
    }

    const layout = element(`<div class="m-layout"></div>`);
    main.id = "contenu";
    main.before(layout);
    layout.append(main);
    document.body.prepend(header, side, element(`<div class="m-veil"></div>`));

    const all = headings(main);
    if (all.length > 2) {
        const toc = element(
            `<aside class="m-toc"><p>${ui.onPage}</p><ul></ul></aside>`,
        );
        for (const h of all)
            toc.querySelector("ul").append(
                element(
                    `<li><a href="#${h.id}"${h.tagName === "H3" ? ' class="sub"' : ""}>${escape(h.textContent)}</a></li>`,
                ),
            );
        layout.append(toc);
        spy(all, [toc, side]);
    }

    for (const h of main.querySelectorAll("h2, h3, h4")) {
        if (!h.id) continue;
        const anchor = element(
            `<a class="anchor" href="#${h.id}" aria-label="${ui.anchor}">#</a>`,
        );
        h.prepend(anchor);
    }

    const index = FLAT.indexOf(current);
    const pager = element(
        `<nav class="m-pager" aria-label="${ui.pager}"></nav>`,
    );
    if (index > 0)
        pager.append(
            element(
                `<a href="${FLAT[index - 1].file}"><small>${ui.previous}</small>${FLAT[index - 1].title}</a>`,
            ),
        );
    if (index < FLAT.length - 1)
        pager.append(
            element(
                `<a class="next" href="${FLAT[index + 1].file}"><small>${ui.next}</small>${FLAT[index + 1].title}</a>`,
            ),
        );
    main.append(pager);

    if (current.file !== "index.html")
        document.title = `${current.title} — ${ui.title}`;

    const burger = header.querySelector(".m-burger");
    const toggle = (open) => {
        document.body.classList.toggle("m-open", open);
        burger.setAttribute("aria-expanded", String(open));
    };
    burger.addEventListener("click", () =>
        toggle(!document.body.classList.contains("m-open")),
    );
    document
        .querySelector(".m-veil")
        .addEventListener("click", () => toggle(false));
    side.addEventListener("click", (event) => {
        if (event.target.closest("a")) toggle(false);
    });
    side.querySelector(".current")?.scrollIntoView({ block: "center" });

    header.querySelector(".m-lang").addEventListener("change", (event) => {
        location.href = `../${event.target.value}/${current.file}${location.hash}`;
    });
    search(header.querySelector(".m-search"));
}

// La section lue, marquée dans les deux tables des matières.
function spy(sections, tables) {
    const links = tables.flatMap((table) => [
        ...table.querySelectorAll('a[href^="#"]'),
    ]);
    let active = null;
    const update = () => {
        let at = sections[0];
        for (const h of sections) {
            if (h.getBoundingClientRect().top < 140) at = h;
            else break;
        }
        if (at === active) return;
        active = at;
        const h2 =
            at.tagName === "H2"
                ? at
                : sections
                      .filter(
                          (h) =>
                              h.tagName === "H2" &&
                              h.compareDocumentPosition(at) &
                                  Node.DOCUMENT_POSITION_FOLLOWING,
                      )
                      .pop();
        for (const link of links) {
            const id = link.getAttribute("href").slice(1);
            link.classList.toggle(
                "active",
                id === at.id || (link.closest(".m-side") && id === h2?.id),
            );
        }
    };
    addEventListener("scroll", update, { passive: true });
    update();
}

// ---------------------------------------------------------- recherche

let indexPromise = null;

// Le texte d'un élément, ses blocs séparés par des espaces.
const SPACED = new Set([
    "P",
    "LI",
    "TD",
    "TH",
    "TR",
    "DIV",
    "SPAN",
    "STRONG",
    "H3",
    "H4",
    "PRE",
    "FIGCAPTION",
    "DT",
    "DD",
    "BR",
]);
const textOf = (node) =>
    node.nodeType === Node.TEXT_NODE
        ? node.data
        : node.nodeType !== Node.ELEMENT_NODE
          ? ""
          : SPACED.has(node.tagName)
            ? ` ${[...node.childNodes].map(textOf).join("")} `
            : [...node.childNodes].map(textOf).join("");

// Une entrée par section : la page, le titre, le texte jusqu'au titre
// suivant.
async function buildIndex() {
    const entries = [];
    await Promise.all(
        FLAT.map(async (page, order) => {
            let doc;
            try {
                const response = await fetch(page.file);
                if (!response.ok) throw new Error();
                doc = new DOMParser().parseFromString(
                    await response.text(),
                    "text/html",
                );
            } catch {
                entries.push({
                    page,
                    order,
                    id: "",
                    title: page.title,
                    text: "",
                });
                return;
            }
            const root = doc.querySelector("main");
            if (!root) return;
            headings(root);
            let section = { page, order, id: "", title: page.title, text: "" };
            const sections = [section];
            for (const node of root.children) {
                if (/^H[23]$/.test(node.tagName)) {
                    section = {
                        page,
                        order,
                        id: node.id,
                        title: node.textContent.trim(),
                        text: "",
                    };
                    sections.push(section);
                } else if (node.tagName !== "H1")
                    section.text += " " + textOf(node);
            }
            for (const s of sections) {
                s.text = s.text.replace(/\s+/g, " ").trim();
                s.foldedTitle = fold(s.title);
                s.foldedText = fold(s.text);
                s.foldedPage = fold(page.title);
                entries.push(s);
            }
        }),
    );
    return entries.sort((a, b) => a.order - b.order);
}

function count(text, word) {
    let n = 0;
    for (
        let at = text.indexOf(word);
        at !== -1 && n < 6;
        at = text.indexOf(word, at + word.length)
    )
        n++;
    return n;
}

function highlight(text, words) {
    const folded = fold(text);
    const marks = [];
    for (const word of words)
        for (
            let at = folded.indexOf(word);
            at !== -1;
            at = folded.indexOf(word, at + word.length)
        )
            marks.push([at, at + word.length]);
    marks.sort((a, b) => a[0] - b[0]);
    let out = "";
    let last = 0;
    for (const [start, end] of marks) {
        if (start < last) continue;
        out +=
            escape(text.slice(last, start)) +
            "<mark>" +
            escape(text.slice(start, end)) +
            "</mark>";
        last = end;
    }
    return out + escape(text.slice(last));
}

function snippet(entry, words) {
    const { text, foldedText } = entry;
    const at = Math.min(
        ...words.map((w) => foldedText.indexOf(w)).filter((i) => i >= 0),
    );
    if (!isFinite(at))
        return text.slice(0, 140) + (text.length > 140 ? "…" : "");
    const start = Math.max(0, at - 60);
    const end = Math.min(text.length, at + 110);
    return (
        (start ? "…" : "") +
        text.slice(start, end) +
        (end < text.length ? "…" : "")
    );
}

function search(box) {
    const input = box.querySelector("input");
    const results = box.querySelector(".m-results");
    let selected = -1;
    let words = [];

    const links = () => [...results.querySelectorAll("a")];
    const select = (k) => {
        const all = links();
        selected = all.length ? (k + all.length) % all.length : -1;
        all.forEach((a, i) => a.classList.toggle("on", i === selected));
        all[selected]?.scrollIntoView({ block: "nearest" });
    };

    const run = async () => {
        const query = input.value.trim();
        words = fold(query).split(/\s+/).filter(Boolean);
        if (!words.length) {
            results.hidden = true;
            return;
        }
        indexPromise ??= buildIndex();
        const entries = await indexPromise;
        if (query !== input.value.trim()) return;
        const found = [];
        for (const entry of entries) {
            const haystack =
                entry.foldedPage +
                " " +
                entry.foldedTitle +
                " " +
                entry.foldedText;
            if (!words.every((w) => haystack.includes(w))) continue;
            let score = 0;
            for (const w of words) {
                if (entry.foldedTitle.includes(w)) score += entry.id ? 12 : 16;
                if (entry.foldedPage.includes(w)) score += 3;
                score += count(entry.foldedText, w);
            }
            found.push({ entry, score });
        }
        found.sort(
            (a, b) => b.score - a.score || a.entry.order - b.entry.order,
        );
        const q = encodeURIComponent(query);
        results.innerHTML = found.length
            ? found
                  .slice(0, 30)
                  .map(({ entry }) => {
                      const href = `${entry.page.file}?q=${q}${entry.id ? "#" + entry.id : ""}`;
                      const path = entry.id
                          ? `${escape(entry.page.group)} › ${escape(entry.page.title)}`
                          : escape(entry.page.group);
                      return `<a href="${href}" role="option"><span class="r-path">${path}</span><span class="r-title">${highlight(entry.title, words)}</span><span class="r-text">${highlight(snippet(entry, words), words)}</span></a>`;
                  })
                  .join("")
            : `<div class="r-empty">${ui.empty.replace("%", escape(query))}${
                  entries.every((e) => !e.text) ? `<br />${ui.server}` : ""
              }</div>`;
        results.hidden = false;
        select(0);
    };

    input.addEventListener("input", run);
    input.addEventListener("focus", () => {
        indexPromise ??= buildIndex();
        if (input.value.trim()) run();
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            select(selected + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Enter") {
            const link = links()[selected];
            if (link) location.href = link.href;
        } else if (event.key === "Escape") {
            if (input.value) input.value = "";
            results.hidden = true;
            input.blur();
        }
    });
    document.addEventListener("pointerdown", (event) => {
        if (!box.contains(event.target)) results.hidden = true;
    });
    document.addEventListener("keydown", (event) => {
        const typing = event.target.closest?.("input, textarea, select");
        if (
            ((event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "k") ||
            (event.key === "/" && !typing)
        ) {
            event.preventDefault();
            input.focus();
            input.select();
        }
    });
}

// Les mots cherchés, surlignés dans la page ouverte depuis un résultat.
function markQuery() {
    const query = new URLSearchParams(location.search).get("q");
    if (!query) return;
    const words = fold(query)
        .split(/\s+/)
        .filter((w) => w.length > 1);
    if (!words.length) return;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
            node.parentElement.closest("script, style, .m-pager, .anchor, svg")
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
        const folded = fold(node.data);
        const ranges = [];
        for (const word of words)
            for (
                let at = folded.indexOf(word);
                at !== -1;
                at = folded.indexOf(word, at + word.length)
            )
                ranges.push([at, at + word.length]);
        if (!ranges.length) continue;
        ranges.sort((a, b) => b[0] - a[0]);
        let last = Infinity;
        for (const [start, end] of ranges) {
            if (end > last) continue;
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end);
            const mark = document.createElement("mark");
            mark.className = "hit";
            range.surroundContents(mark);
            last = start;
        }
    }
    const target =
        location.hash &&
        document.getElementById(decodeURIComponent(location.hash.slice(1)));
    (target ?? main.querySelector("mark.hit"))?.scrollIntoView({
        block: "start",
    });
}

function flashTarget() {
    const target =
        location.hash &&
        document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    target.classList.remove("m-flash");
    void target.offsetWidth;
    target.classList.add("m-flash");
}

function zoomImages() {
    main.addEventListener("click", (event) => {
        const img = event.target.closest("figure img");
        if (!img) return;
        const overlay = element(
            `<div class="m-zoom" role="dialog" aria-label="${ui.zoom}"><img src="${img.src}" alt="${escape(img.alt)}" /></div>`,
        );
        const close = () => {
            overlay.remove();
            removeEventListener("keydown", onKey);
        };
        const onKey = (e) => e.key === "Escape" && close();
        overlay.addEventListener("click", close);
        addEventListener("keydown", onKey);
        document.body.append(overlay);
    });
}

function copyButtons() {
    for (const pre of main.querySelectorAll("pre")) {
        const box = element(
            `<div class="m-code"><button class="m-copy" type="button" title="${ui.copy}" aria-label="${ui.copy}">${COPY_ICON}</button></div>`,
        );
        pre.before(box);
        box.prepend(pre);
        const button = box.querySelector("button");
        button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(pre.textContent);
            button.innerHTML = COPIED_ICON;
            setTimeout(() => (button.innerHTML = COPY_ICON), 1500);
        });
    }
}

// ------------------------------------------------------------- vidéo

// La vidéo de présentation, hébergée à part, en français ; ses sous-titres,
// un fichier par langue, sont à côté du manuel, ceux de la page affichés
// d'office. Un épisode se lit seul : fragment #t=début,fin de la vidéo.
const VIDEO = "https://files.dgpad.net/docgeo/docgeo_S01.mp4";
const EPISODES = [0, 54, 301, 368, 467, 555];

const clock = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function videos() {
    for (const figure of main.querySelectorAll("figure.m-video")) {
        const episode = figure.dataset.episode;
        const [start, end] = EPISODES.slice(episode, +episode + 2);
        const video = element(
            `<video controls preload="none" poster="../video/${episode ?? "docgeo"}.jpg" src="${VIDEO}${episode ? `#t=${start}${end ? `,${end}` : ""}` : ""}"></video>`,
        );
        for (const [code, { name }] of Object.entries(LANGS))
            video.append(
                element(
                    `<track kind="subtitles" srclang="${code}" label="${name}" src="../video/${code}.vtt"${code === lang && lang !== "fr" ? " default" : ""} />`,
                ),
            );
        if (!figure.querySelector("figcaption"))
            figure.append(element("<figcaption></figcaption>"));
        figure
            .querySelector("figcaption")
            .append(element(`<span>${ui.video}</span>`));
        figure.prepend(video);
    }
    for (const button of main.querySelectorAll("button[data-episode]"))
        button.prepend(
            element(`<time>${clock(EPISODES[button.dataset.episode])}</time>`),
        );
    main.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-episode]");
        if (!button) return;
        const video = main.querySelector("figure.m-video video");
        const seek = () =>
            (video.currentTime = EPISODES[button.dataset.episode]);
        if (video.readyState) seek();
        else video.addEventListener("loadedmetadata", seek, { once: true });
        video.play();
        video.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
}

icons();
frame();
videos();
copyButtons();
markQuery();
zoomImages();
addEventListener("hashchange", flashTarget);
