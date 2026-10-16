// Manuel de DocGeo : en-tête, table des matières, recherche et navigation,
// ajoutés autour du <main> de chaque page.

const PAGES = [
    [
        "Premiers pas",
        [
            ["index.html", "Accueil"],
            ["demarrage.html", "Ouvrir et enregistrer"],
            ["editeur.html", "L’interface"],
        ],
    ],
    [
        "Construire",
        [
            ["gestes.html", "Au geste"],
            ["menu-outils.html", "Le menu des outils"],
            ["saisie.html", "Au clavier"],
            ["expressions.html", "Expressions et curseurs"],
            ["3d.html", "La 3D"],
        ],
    ],
    [
        "Modifier",
        [
            ["objets.html", "Gérer les objets"],
            ["points-dynamiques.html", "Aimants, punaise et ressort"],
            ["proprietes.html", "Propriétés et repère"],
        ],
    ],
    [
        "Référence",
        [
            ["commandes.html", "Les commandes"],
            ["formules.html", "Formules et programmes"],
            ["raccourcis.html", "Raccourcis et gestes"],
            ["formats.html", "Import DGPad et GeoGebra"],
            ["faq.html", "Questions fréquentes"],
            ["historique.html", "Historique du projet"],
        ],
    ],
];

const FLAT = PAGES.flatMap(([group, pages]) =>
    pages.map(([file, title]) => ({ file, title, group })),
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
        .replace(/[^a-z0-9]+/g, "-")
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
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

function frame() {
    const header = element(html`
        <header class="m-header">
            <button
                class="m-burger"
                aria-label="Table des matières"
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
                <span>Manuel</span></a
            >
            <div class="m-search" role="search">
                <input
                    type="search"
                    placeholder="Rechercher dans le manuel"
                    aria-label="Rechercher dans le manuel"
                    autocomplete="off"
                    spellcheck="false"
                />
                ${SEARCH_ICON}
                <kbd>${isMac ? "⌘" : "Ctrl"} K</kbd>
                <div class="m-results" role="listbox" hidden></div>
            </div>
            <nav class="m-apps" aria-label="Applications">
                <a href="../../editor.html">Ouvrir l’éditeur</a>
            </nav>
        </header>
    `);

    const side = element(
        `<nav class="m-side" aria-label="Table des matières"></nav>`,
    );
    for (const [group, pages] of PAGES) {
        side.append(element(`<h2>${group}</h2>`));
        const list = element("<ul></ul>");
        for (const [file, title] of pages) {
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
            `<aside class="m-toc"><p>Sur cette page</p><ul></ul></aside>`,
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
            `<a class="anchor" href="#${h.id}" aria-label="Lien vers cette section">#</a>`,
        );
        h.prepend(anchor);
    }

    const index = FLAT.indexOf(current);
    const pager = element(
        `<nav class="m-pager" aria-label="Pages voisines"></nav>`,
    );
    if (index > 0)
        pager.append(
            element(
                `<a href="${FLAT[index - 1].file}"><small>← Précédent</small>${FLAT[index - 1].title}</a>`,
            ),
        );
    if (index < FLAT.length - 1)
        pager.append(
            element(
                `<a class="next" href="${FLAT[index + 1].file}"><small>Suivant →</small>${FLAT[index + 1].title}</a>`,
            ),
        );
    main.append(pager);

    if (current.file !== "index.html")
        document.title = `${current.title} — Manuel DocGeo`;

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
            : `<div class="r-empty">Aucun résultat pour « ${escape(query)} ».${
                  entries.every((e) => !e.text)
                      ? "<br />La recherche dans le texte demande que le manuel soit ouvert depuis un serveur web."
                      : ""
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
            `<div class="m-zoom" role="dialog" aria-label="Capture agrandie"><img src="${img.src}" alt="${escape(img.alt)}" /></div>`,
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

icons();
frame();
markQuery();
zoomImages();
addEventListener("hashchange", flashTarget);
