// The text of a construction, one line per object: `name = Command(args)`,
// or `A = (x, y)` for a free point. A closed grammar, never evaluated.

export type ArgText =
    { kind: "name"; name: string } | { kind: "number"; value: number };

export type Definition =
    | { kind: "point"; coords: number[] }
    | { kind: "call"; command: string; args: ArgText[] };

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

type Token =
    | { type: "name"; text: string }
    | { type: "number"; value: number }
    | { type: "(" | ")" | "," | "=" | "end" };

const IDENTIFIER = /^[\p{L}_][\p{L}\p{N}_']*/u;
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i;

function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let rest = text;
    while ((rest = rest.trimStart())) {
        const char = rest[0];
        if ("(),=".includes(char)) {
            tokens.push({ type: char as "(" });
            rest = rest.slice(1);
            continue;
        }
        if (char === "`") {
            const end = rest.indexOf("`", 1);
            if (end < 2) throw new TextError("syntax", rest);
            tokens.push({ type: "name", text: rest.slice(1, end) });
            rest = rest.slice(end + 1);
            continue;
        }
        const sign = char === "-" ? -1 : 1;
        const number = NUMBER.exec(sign < 0 ? rest.slice(1) : rest);
        if (number) {
            tokens.push({ type: "number", value: sign * Number(number[0]) });
            rest = rest.slice(number[0].length + (sign < 0 ? 1 : 0));
            continue;
        }
        const identifier = IDENTIFIER.exec(rest);
        if (!identifier) throw new TextError("syntax", rest);
        tokens.push({ type: "name", text: identifier[0] });
        rest = rest.slice(identifier[0].length);
    }
    tokens.push({ type: "end" });
    return tokens;
}

export function parseLine(text: string): Line {
    const tokens = tokenize(text);
    let position = 0;
    const peek = () => tokens[position];
    const next = () => tokens[position++];
    const expect = (type: Token["type"]) => {
        const token = next();
        if (token.type !== type)
            throw new TextError(
                "expected",
                type === "end" ? describe(token) : type,
            );
        return token;
    };
    let name: string | null = null;
    if (peek().type === "name" && tokens[1].type === "=") {
        name = (next() as { text: string }).text;
        next();
        if (peek().type === "end") return { name, definition: null };
    }
    const definition = parseDefinition();
    expect("end");
    return { name, definition };

    function parseDefinition(): Definition {
        const token = next();
        if (token.type === "(") {
            const coords = [number()];
            while (peek().type === ",") {
                next();
                coords.push(number());
            }
            expect(")");
            if (coords.length < 2 || coords.length > 3)
                throw new TextError("coordinates");
            return { kind: "point", coords };
        }
        if (token.type !== "name")
            throw new TextError("expected", describe(token));
        expect("(");
        const args: ArgText[] = [];
        if (peek().type !== ")") {
            args.push(argument());
            while (peek().type === ",") {
                next();
                args.push(argument());
            }
        }
        expect(")");
        return { kind: "call", command: token.text, args };
    }

    function number(): number {
        return (expect("number") as { value: number }).value;
    }

    function argument(): ArgText {
        const token = next();
        if (token.type === "number")
            return { kind: "number", value: token.value };
        if (token.type === "name") return { kind: "name", name: token.text };
        throw new TextError("expected", describe(token));
    }
}

function describe(token: Token): string {
    if (token.type === "name") return token.text;
    if (token.type === "number") return String(token.value);
    return token.type === "end" ? "" : token.type;
}

const PLAIN = /^[\p{L}_][\p{L}\p{N}_']*$/u;

export const formatName = (name: string): string =>
    PLAIN.test(name) ? name : `\`${name}\``;

// Rounded as shown, the object keeping its own value.
export function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return "NaN";
    return String(Math.round(value * 1e4) / 1e4 || 0);
}

// What is being typed at the end of `text`: a command, or an argument of
// one, the arguments before it (a hole where one isn't a name or a number),
// and the start of the word typed.
export type ArgumentCompletion = {
    kind: "argument";
    command: string;
    position: number;
    args: (ArgText | undefined)[];
    prefix: string;
};

export type Completion =
    { kind: "command"; prefix: string } | ArgumentCompletion;

export function completionAt(text: string): Completion | null {
    const prefix = /[\p{L}_][\p{L}\p{N}_']*$/u.exec(text)?.[0] ?? "";
    const before = text.slice(0, text.length - prefix.length);
    let tokens: Token[];
    try {
        tokens = tokenize(before);
    } catch {
        return null;
    }
    tokens.pop();
    const calls: Omit<ArgumentCompletion, "kind" | "prefix">[] = [];
    tokens.forEach((token, index) => {
        const previous = tokens[index - 1];
        if (token.type === "(" && previous?.type === "name")
            calls.push({ command: previous.text, position: 0, args: [] });
        else if (token.type === "," && calls.length) {
            const call = calls[calls.length - 1];
            const start = tokens[index - 2]?.type;
            if (start === "(" || start === ",")
                call.args[call.position] =
                    previous.type === "name"
                        ? { kind: "name", name: previous.text }
                        : previous.type === "number"
                          ? { kind: "number", value: previous.value }
                          : undefined;
            call.position++;
        } else if (token.type === ")") calls.pop();
    });
    const call = calls.pop();
    if (call) {
        const last = tokens[tokens.length - 1];
        return last.type === "(" || last.type === ","
            ? { kind: "argument", ...call, prefix }
            : null;
    }
    const types = tokens.map(({ type }) => type).join(" ");
    return types === "" || types === "name ="
        ? { kind: "command", prefix }
        : null;
}
