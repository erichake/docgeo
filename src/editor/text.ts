import { FormulaLexer, METHOD_ARITY, type Token } from "../import/dgp_formula";

// The text of a construction, one line per object: `name = Command(args)`,
// `A = (x, y)` for a free point, `M = (x(A) + 1, y(B))` or
// `M = Point(2*B - A)` for a point computed by a formula, or
// `name = formula` for an expression, `name = left = right` for a line, a
// circle or a conic of its equation. A closed grammar, the formulas' own,
// never evaluated.

type Operand =
    { kind: "name"; name: string } | { kind: "number"; value: number };

export type ArgText = Operand | { kind: "formula"; source: string };

export type Definition =
    | { kind: "point"; coords: number[] }
    | { kind: "call"; command: string; args: ArgText[] }
    | { kind: "formula"; source: string }
    | { kind: "pointFormula"; source: string }
    | { kind: "equation"; sides: [string, string] };

export interface Line {
    name: string | null;
    // Null for `name =`, which deletes the object.
    definition: Definition | null;
}

export class TextError extends Error {
    constructor(
        readonly key: string,
        readonly detail = "",
    ) {
        super(key);
    }
}

const SPACE = /\s*/y;

// Its tokens up to where the grammar stops reading it, each with where it
// starts and ends, the last one "eof" when it reads it all; else, where it
// stops.
function lex(text: string): {
    tokens: Token[];
    starts: number[];
    ends: number[];
    stop: number | null;
} {
    const lexer = new FormulaLexer(text);
    const tokens: Token[] = [];
    const starts: number[] = [];
    const ends: number[] = [];
    while (tokens[tokens.length - 1]?.type !== "eof") {
        SPACE.lastIndex = lexer.index;
        SPACE.exec(text);
        try {
            tokens.push(lexer.next());
        } catch {
            return { tokens, starts, ends, stop: SPACE.lastIndex };
        }
        starts.push(SPACE.lastIndex);
        ends.push(lexer.index);
    }
    return { tokens, starts, ends, stop: null };
}

// `-2`, read as one number.
function signed(tokens: Token[]): number | null {
    const [first, second] = tokens;
    if (tokens.length === 1 && first.type === "number")
        return first.value as number;
    return tokens.length === 2 && first.type === "-" && second.type === "number"
        ? -second.value
        : null;
}

// The bracket opened by the token at `at`: where it closes, and the commas
// between its own items.
function group(
    tokens: Token[],
    at: number,
): { end: number; commas: number[] } | null {
    const commas: number[] = [];
    let depth = 0;
    for (let index = at; index < tokens.length; index++) {
        const { type } = tokens[index];
        if (type === "(" || type === "[" || type === "{") depth++;
        else if (type === ")" || type === "]" || type === "}") {
            if (!--depth) return { end: index, commas };
        } else if (type === "," && depth === 1) commas.push(index);
    }
    return null;
}

// A command's line when the catalog has the name before "(".
export function parseLine(
    text: string,
    isCommand: (name: string) => boolean,
): Line {
    const { tokens, starts, ends } = lex(text);
    let position = 0;
    const peek = (offset = 0): Token | undefined => tokens[position + offset];
    let name: string | null = null;
    // `y = 2x + 1` is an equation, as in GeoGebra.
    if (
        peek()?.type === "identifier" &&
        !["x", "y"].includes(peek()!.value as string) &&
        peek(1)?.type === "="
    ) {
        name = peek()!.value as string;
        position = 2;
    }
    const source = text.slice(position && ends[1]).trim();
    if (!source) {
        if (name === null) throw new TextError("expected", "");
        return { name, definition: null };
    }
    // One "=" outside brackets, and no statement.
    let depth = 0;
    const equals = tokens.flatMap(({ type }, index) => {
        if (type === "(" || type === "[") depth++;
        else if (type === ")" || type === "]") depth--;
        return index >= position && !depth && type === "=" ? [index] : [];
    });
    if (
        equals.length === 1 &&
        !tokens.some(({ type }) => type === ";" || type === "{")
    ) {
        const sides = [
            text.slice(position && ends[1], starts[equals[0]]),
            text.slice(ends[equals[0]]),
        ].map((side) => side.trim());
        if (sides.includes("")) throw new TextError("syntax", source);
        return {
            name,
            definition: { kind: "equation", sides: sides as [string, string] },
        };
    }
    const head = peek()!;
    if (
        head.type === "identifier" &&
        peek(1)?.type === "(" &&
        isCommand(head.value as string)
    ) {
        // `Point(2*B - A)`: one argument, which no point on an object takes.
        const inner = whole(position + 1);
        if (
            /^point$/i.test(head.value as string) &&
            inner &&
            !inner.commas.length &&
            inner.end > position + 2
        )
            return {
                name,
                definition: {
                    kind: "pointFormula",
                    source: between(position + 1, inner.end),
                },
            };
        return { name, definition: call(head.value as string) };
    }
    const coords = point();
    if (coords) return { name, definition: { kind: "point", coords } };
    // Coordinates that aren't all numbers.
    const pair = head.type === "(" ? whole(position) : null;
    if (pair?.commas.length) {
        if (pair.commas.length > 2) throw new TextError("coordinates");
        return {
            name,
            definition: {
                kind: "pointFormula",
                source: `[${between(position, pair.end)}]`,
            },
        };
    }
    return { name, definition: { kind: "formula", source } };

    // The bracket opened at `at`, closed at the end of the line.
    function whole(at: number) {
        const found = group(tokens, at);
        return found && tokens[found.end + 1]?.type === "eof" ? found : null;
    }

    function between(open: number, close: number): string {
        return text.slice(ends[open], starts[close]).trim();
    }

    function next(): Token {
        const token = tokens[position++];
        if (!token)
            throw new TextError(
                "syntax",
                text.slice(ends[position - 2] ?? 0).trim(),
            );
        return token;
    }

    function expect(type: Token["type"]): void {
        const token = next();
        if (token.type !== type)
            throw new TextError(
                "expected",
                type === "eof" ? describe(token) : type,
            );
    }

    function call(command: string): Definition {
        position += 2;
        const args: ArgText[] = [];
        if (peek()?.type !== ")") {
            args.push(argument());
            while (peek()?.type === ",") {
                position++;
                args.push(argument());
            }
        }
        expect(")");
        expect("eof");
        return { kind: "call", command, args };
    }

    // Up to a comma or the call's ")".
    function argument(): ArgText {
        const start = position;
        let depth = 0;
        for (
            let type = peek()?.type;
            type && type !== "eof" && (depth || (type !== "," && type !== ")"));
            type = peek()?.type
        ) {
            if (type === "(" || type === "[" || type === "{") depth++;
            else if (type === ")" || type === "]" || type === "}") depth--;
            position++;
        }
        const arg = tokens.slice(start, position);
        if (!arg.length) throw new TextError("expected", describe(next()));
        if (arg.length === 1 && arg[0].type === "identifier")
            return { kind: "name", name: arg[0].value as string };
        const value = signed(arg);
        return value === null
            ? { kind: "formula", source: between(start - 1, position) }
            : { kind: "number", value };
    }

    // Two or three numbers between brackets, and nothing after.
    function point(): number[] | null {
        const coords: number[] = [];
        let at = position;
        if (tokens[at]?.type !== "(") return null;
        do {
            const length = tokens[at + 1]?.type === "-" ? 2 : 1;
            const value = signed(tokens.slice(at + 1, at + 1 + length));
            if (value === null) return null;
            coords.push(value);
            at += length + 1;
        } while (tokens[at]?.type === ",");
        if (
            tokens[at]?.type !== ")" ||
            tokens[at + 1]?.type !== "eof" ||
            coords.length < 2
        )
            return null;
        if (coords.length > 3) throw new TextError("coordinates");
        return coords;
    }
}

function describe(token: Token): string {
    if (token.type === "identifier") return token.value as string;
    if (token.type === "number") return String(token.value);
    return token.type === "eof" ? "" : token.type;
}

const PLAIN = /^[\p{L}_][\p{L}\p{N}_']*$/u;

export const formatName = (name: string): string =>
    PLAIN.test(name) ? name : `\`${name}\``;

// A formula point's definition: its coordinates between brackets, unless
// they are numbers only, which a free point's are.
export function pointFormulaText(source: string): string {
    const { tokens, starts, ends } = lex(source);
    const items = tokens[0]?.type === "[" ? group(tokens, 0) : null;
    if (
        items &&
        tokens[items.end + 1]?.type === "eof" &&
        items.commas.length &&
        items.commas.length <= 2 &&
        [0, ...items.commas].some(
            (comma, index) =>
                signed(
                    tokens.slice(comma + 1, items.commas[index] ?? items.end),
                ) === null,
        )
    )
        return `(${source.slice(ends[0], starts[items.end]).trim()})`;
    return `Point(${source})`;
}

// Rounded as shown, the object keeping its own value.
export function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return "NaN";
    return String(Math.round(value * 1e4) / 1e4 || 0);
}

// The text of a formula whose names are written anew, from the formula's
// own to the objects' (see Ex in DGO.md): names after "." are methods.
export function renameFormula(
    source: string,
    rename: (name: string) => string | undefined,
): string {
    const { tokens, starts, ends } = lex(source);
    let text = "";
    let end = 0;
    tokens.forEach((token, index) => {
        const renamed =
            token.type === "identifier" &&
            tokens[index - 1]?.type !== "." &&
            rename(token.value as string);
        if (!renamed) return;
        text += source.slice(end, starts[index]) + renamed;
        end = ends[index];
    });
    return text + source.slice(end);
}

const isElse = (token: Token | undefined) =>
    token?.type === "identifier" && token.value === "else";

// A program laid out one statement a line, indented by its braces: only
// the spaces and line breaks between its tokens change.
export function formatProgram(source: string): string {
    const { tokens, starts, ends, stop } = lex(source);
    if (stop !== null) return source;
    const lines: string[] = [];
    let line = "";
    let depth = 0;
    // A loop's header keeps its semicolons.
    let parens = 0;
    const flush = () => {
        if (line) lines.push(line);
        line = "";
    };
    tokens.slice(0, -1).forEach((token, index) => {
        const raw = source.slice(starts[index], ends[index]);
        const next = tokens[index + 1];
        if (token.type === "}") {
            flush();
            depth = Math.max(depth - 1, 0);
        }
        if (!line) line = "    ".repeat(depth) + raw;
        else
            line +=
                (starts[index] > ends[index - 1] ||
                token.type === "{" ||
                isElse(token)
                    ? " "
                    : "") + raw;
        if (token.type === "(") parens++;
        else if (token.type === ")") parens--;
        else if (token.type === "{") {
            depth++;
            flush();
        } else if (
            (token.type === ";" && parens <= 0) ||
            (token.type === "}" && next.type !== ";" && !isElse(next))
        )
            flush();
    });
    flush();
    return lines.join("\n");
}

// A method the grammar doesn't know, called on an object: `s.setColor(`.
export function unknownMethod(source: string): string | null {
    const { tokens } = lex(source);
    for (const [index, token] of tokens.entries()) {
        const [object, name] = [tokens[index - 1], tokens[index + 1]];
        if (
            token.type === "." &&
            object?.type === "identifier" &&
            object.value !== "Math" &&
            name?.type === "identifier" &&
            tokens[index + 2]?.type === "(" &&
            !/^(?:d[xyzt]|join)$/.test(name.value as string) &&
            !((name.value as string) in METHOD_ARITY)
        )
            return name.value as string;
    }
    return null;
}

const OPENING: Partial<Record<Token["type"], Token["type"]>> = {
    ")": "(",
    "]": "[",
    "}": "{",
};

// The line where the grammar stops reading the program, or where one of its
// brackets doesn't match: null when it reads them all.
export function syntaxLine(source: string): number | null {
    const { tokens, starts, stop } = lex(source);
    const open: number[] = [];
    let at = stop;
    for (const [index, { type }] of tokens.entries()) {
        if (type === "(" || type === "[" || type === "{") open.push(index);
        else if (
            OPENING[type] &&
            tokens[open.pop() ?? -1]?.type !== OPENING[type]
        ) {
            at = starts[index];
            break;
        }
    }
    if (at === null && open.length) at = starts[open.pop()!];
    return at === null ? null : source.slice(0, at).split("\n").length;
}

// What is being typed at the end of `text`: a command, or a formula's name
// or function, at the start of the line (after `name =` in a formula);
// an argument of a call, with the arguments before it (a hole where one
// isn't a name or a number); a name or a function after an operator (free);
// and the start of the word typed.
export type ArgumentCompletion = {
    kind: "argument";
    command: string;
    position: number;
    args: (Operand | undefined)[];
    prefix: string;
};

export type Completion =
    | { kind: "command"; prefix: string; formula: boolean }
    | { kind: "free"; prefix: string }
    | ArgumentCompletion;

const OPERANDS = new Set<Token["type"]>([
    "identifier",
    "number",
    "string",
    "imaginary",
    ")",
    "]",
    ".",
    "++",
    "--",
]);

export function completionAt(text: string): Completion | null {
    const prefix = /[\p{L}_$][\p{L}\p{M}\p{N}_$']*$/u.exec(text)?.[0] ?? "";
    const { tokens } = lex(text.slice(0, text.length - prefix.length));
    if (tokens.pop()?.type !== "eof") return null;
    type Call = Omit<ArgumentCompletion, "kind" | "prefix"> & {
        start: number;
    };
    // Null for a bracket that isn't a call's.
    const brackets: (Call | null)[] = [];
    tokens.forEach((token, index) => {
        const previous = tokens[index - 1];
        const call = brackets[brackets.length - 1];
        if (token.type === "(" || token.type === "[" || token.type === "{")
            brackets.push(
                token.type === "(" &&
                    previous?.type === "identifier" &&
                    tokens[index - 2]?.type !== "."
                    ? {
                          command: previous.value as string,
                          position: 0,
                          args: [],
                          start: index + 1,
                      }
                    : null,
            );
        else if (token.type === "," && call) {
            const arg = tokens.slice(call.start, index);
            const value = signed(arg);
            if (arg.length === 1 && arg[0].type === "identifier")
                call.args[call.position] = {
                    kind: "name",
                    name: arg[0].value as string,
                };
            else if (value !== null)
                call.args[call.position] = { kind: "number", value };
            call.position++;
            call.start = index + 1;
        } else if (
            token.type === ")" ||
            token.type === "]" ||
            token.type === "}"
        )
            brackets.pop();
    });
    const last = tokens[tokens.length - 1];
    const call = brackets[brackets.length - 1];
    if (call && (last.type === "(" || last.type === ",")) {
        const { command, position, args } = call;
        return { kind: "argument", command, position, args, prefix };
    }
    if (!last) return { kind: "command", prefix, formula: false };
    if (
        tokens.length === 2 &&
        tokens[0].type === "identifier" &&
        last.type === "="
    )
        return { kind: "command", prefix, formula: true };
    return OPERANDS.has(last.type) ? null : { kind: "free", prefix };
}
