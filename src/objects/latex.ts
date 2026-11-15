import katex from "katex/dist/katex.min.js";
import "katex/dist/katex.min.css";

// GeoGebra writes its texts for JLaTeXMath, more lenient than KaTeX: a text
// KaTeX refuses is rewritten as JLaTeXMath reads it, then by KaTeX's own
// errors. A text KaTeX accepts is left as is (DGPad's are written for it).

// The end of the token at i: a group, a command with its arguments, or a
// character.
const tokenEnd = (s: string, i: number): number => {
    while (s[i] === " ") i++;
    if (s[i] === "{" || s[i] === "[") {
        const [open, close] = s[i] === "{" ? "{}" : "[]";
        for (let depth = 0; i < s.length; i++) {
            if (s[i] === "\\") i++;
            else if (s[i] === open) depth++;
            else if (s[i] === close && --depth === 0) return i + 1;
        }
        return i;
    }
    if (s[i] !== "\\") return Math.min(i + 1, s.length);
    const name = /^\\(?:[a-zA-Z]+|.)/.exec(s.slice(i))![0];
    i += name.length;
    if (name === "\\left") {
        const right = s.indexOf("\\right", i);
        return right < 0 ? s.length : right + 7;
    }
    if (name === "\\begin") {
        const env = /^\{([^}]*)\}/.exec(s.slice(i));
        const end = env ? s.indexOf(`\\end{${env[1]}}`, i) : -1;
        return end < 0 ? s.length : end + env![1].length + 6;
    }
    // Its arguments, a modifier (\bold) taking the next token.
    let end = i;
    while (/^ *[{[]/.test(s.slice(end))) end = tokenEnd(s, end);
    return end;
};

const SIZES: [number, string][] = [
    [0.5, "tiny"],
    [0.7, "scriptsize"],
    [0.8, "footnotesize"],
    [0.9, "small"],
    [1, "normalsize"],
    [1.2, "large"],
    [1.44, "Large"],
    [1.728, "LARGE"],
    [2.074, "huge"],
    [2.488, "Huge"],
];

// JLaTeXMath's colors: "r,g,b" (0 to 1, or to 255) and hexadecimal numbers
// whose leading zeros are left out ("#8800" is #008800).
const color = (c: string): string => {
    const rgb = c.split(",").map(Number);
    if (rgb.length === 3) {
        const scale = c.includes(".") || rgb.every((v) => v <= 1) ? 255 : 1;
        return (
            "#" +
            rgb
                .map((v) =>
                    Math.round(v * scale)
                        .toString(16)
                        .padStart(2, "0"),
                )
                .join("")
        );
    }
    return /^#[\da-f]{1,6}$|^[\da-f]*\d[\da-f]*$/i.test(c) && c.length < 8
        ? "#" + c.replace("#", "").padStart(6, "0")
        : c;
};

// The commands whose first arguments are lengths, scales or colors, and
// whether a last argument follows, which JLaTeXMath takes unbraced.
const ARGUMENTS: Record<string, [number, boolean]> = {
    hspace: [1, false],
    scalebox: [1, false],
    color: [1, false],
    textcolor: [1, true],
    colorbox: [1, true],
    fcolorbox: [2, true],
    fbox: [0, true],
};

const rewrite = (s: string): string => {
    s = s
        .replace(/\\(?:mbox|hbox)\b/g, "\\text")
        .replace(/\\cr\b/g, "\\\\")
        .replace(/\\L\b/g, "Ł")
        // Unknown to KaTeX, which spaces its lines itself.
        .replace(/\\vspace\*? *\{[^{}]*(?:\{,\}[^{}]*)*\}/g, "")
        .replace(/\\shadowbox\b/g, "\\fbox")
        .replace(/\\\[/g, "\\(")
        .replace(/\\\]/g, "\\)")
        .replace(/\\begin\{array\}(?! *\{)/g, "\\begin{array}{c}");
    // Backwards, an argument rewritten before its command.
    for (const match of [...s.matchAll(/\\([a-z]+)\*?/g)].reverse()) {
        const name = match[1];
        const command = ARGUMENTS[name];
        if (!command) continue;
        let i = match.index + match[0].length;
        const values: string[] = [];
        for (let k = 0; k < command[0]; k++) {
            const end = tokenEnd(s, i);
            // Their numbers written in decimal comma by the text's
            // rounding.
            const arg = s.slice(i, end).trim().replace(/\{,\}/g, ".");
            values.push(arg.slice(1, -1).trim());
            const value = name.includes("color")
                ? `{${color(values[k])}}`
                : arg;
            s = s.slice(0, i) + value + s.slice(end);
            i += value.length;
        }
        if (name === "scalebox" && /^ *\[/.test(s.slice(i)))
            s = s.slice(0, i) + s.slice(tokenEnd(s, i));
        const end = command[1] || name === "scalebox" ? tokenEnd(s, i) : i;
        const last = s.slice(i, end).trim();
        // KaTeX has only its fixed sizes.
        if (name === "scalebox") {
            const scale = Number(values[0]);
            const [, size] = SIZES.reduce((a, b) =>
                Math.abs(Math.log(b[0] / scale)) <
                Math.abs(Math.log(a[0] / scale))
                    ? b
                    : a,
            );
            s = `${s.slice(0, match.index)}{\\${size} ${last}}${s.slice(end)}`;
        } else if (command[1] && last[0] !== "{")
            s = `${s.slice(0, i)}{${last}}${s.slice(end)}`;
    }
    return s;
};

const TEXT_FONTS: Record<string, string> = {
    "\\bold": "\\textbf",
    "\\boldsymbol": "\\textbf",
    "\\mathbf": "\\textbf",
    "\\mathit": "\\textit",
    "\\mathsf": "\\textsf",
    "\\mathrm": "\\textrm",
};

const repair = (s: string): string => {
    for (let attempt = 0; attempt < 200; attempt++) {
        try {
            katex.renderToString(s, { throwOnError: true });
            return s;
        } catch (e) {
            const { rawMessage, position: i = 0 } = e as katex.ParseError;
            if (rawMessage === undefined) return s;
            const name =
                /'(\\[a-zA-Z]+)' in text mode|sequence: (\\[a-zA-Z]+)/.exec(
                    rawMessage,
                );
            const got = /got '(.)'/.exec(rawMessage)?.[1];
            if (rawMessage.startsWith("Unexpected end of input")) s += "}";
            else if (got === "}") s = s.slice(0, i) + s.slice(i + 1);
            // A math script in a text: with the token before it.
            else if (got === "^" || got === "_") {
                const start = s[i - 1] === "}" ? s.lastIndexOf("{", i) : i - 1;
                let end = tokenEnd(s, i + 1);
                while (s[end] === "^" || s[end] === "_")
                    end = tokenEnd(s, end + 1);
                s = `${s.slice(0, start)}\\(${s.slice(start, end)}\\)${s.slice(end)}`;
            } else if (rawMessage.includes("'\\(' in math mode"))
                s = s.slice(0, i) + s.slice(i + 2).replace("\\)", "");
            // A math font in a text, taking the next token as JLaTeXMath
            // does (\bold\textcolor{red}{x}).
            else if (name?.[1] && TEXT_FONTS[name[1]]) {
                const from = i + name[1].length;
                const end = tokenEnd(s, from);
                const arg = s.slice(from, end).trim();
                s = `${s.slice(0, i)}${TEXT_FONTS[name[1]]}${arg[0] === "{" ? arg : `{${arg}}`}${s.slice(end)}`;
            }
            // A math command in a text, unknown there or refused.
            else if (name && !s.startsWith("\\(", i - 2)) {
                const end = name[1] ? tokenEnd(s, i) : i + name[2].length;
                s = `${s.slice(0, i)}\\(${s.slice(i, end)}\\)${s.slice(end)}`;
            } else return s;
        }
    }
    return s;
};

// The HTML of a text, and the angle in degrees of GeoGebra's RotateText.
export const renderTeX = (tex: string): [string, number] => {
    const rotated = /^(.*?)\\rotatebox\{([^{}]*)\}\{(.*)\}(.*)$/s.exec(tex);
    const source = rotated ? rotated[1] + rotated[3] + rotated[4] : tex;
    let html: string;
    try {
        html = katex.renderToString(source, { throwOnError: true });
    } catch {
        const repaired = repair(rewrite(source));
        try {
            html = katex.renderToString(repaired, { throwOnError: false });
        } catch {
            // KaTeX's own failures (an array of no column) aren't errors.
            html = `<span class="katex-error" style="color:#c00">${repaired.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
        }
    }
    return [html, rotated ? Number(rotated[2].replace("{,}", ".")) : 0];
};
