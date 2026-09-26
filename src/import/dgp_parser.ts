export type DgpValue =
    | { type: "literal"; value: string | number | boolean | null }
    | { type: "reference"; name: string }
    | { type: "array"; items: DgpValue[] };

export interface DgpCall {
    variable: string | null;
    name: string;
    arguments: DgpValue[];
    line: number;
}

type TokenType =
    | "identifier"
    | "number"
    | "string"
    | "="
    | "("
    | ")"
    | "["
    | "]"
    | ","
    | ";"
    | "eof";

interface Token {
    type: TokenType;
    value: string | number;
    line: number;
}

const NUMBER = /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
export const IDENTIFIER_START = /[$_\p{ID_Start}]/u;
export const IDENTIFIER_PART = /[$_\u200c\u200d\p{ID_Continue}]/u;

class Lexer {
    private index = 0;
    private line = 1;

    constructor(private readonly source: string) {}

    next(): Token {
        this.skipIgnored();
        if (this.index === this.source.length)
            return { type: "eof", value: "", line: this.line };

        const line = this.line;
        const character = this.source[this.index];
        if (character === '"') return this.string(line);
        if (IDENTIFIER_START.test(character)) return this.identifier(line);

        NUMBER.lastIndex = this.index;
        const number = NUMBER.exec(this.source);
        if (number) {
            this.index = NUMBER.lastIndex;
            const value = Number(number[0]);
            if (!Number.isFinite(value))
                throw new Error(`Invalid DGP number at line ${line}`);
            return { type: "number", value, line };
        }

        if ("=()[],;".includes(character)) {
            this.index++;
            return { type: character as TokenType, value: character, line };
        }

        throw new Error(`Invalid DGP syntax at line ${line}`);
    }

    // A DGPad macro definition is arbitrary JavaScript that has no effect on
    // the figure: skip it up to its terminating top-level semicolon.
    skipStatement(): void {
        let depth = 0;
        while (this.index < this.source.length) {
            const character = this.source[this.index++];
            if (character === "\n") {
                this.line++;
            } else if (
                character === '"' ||
                character === "'" ||
                character === "`"
            ) {
                while (this.index < this.source.length) {
                    const c = this.source[this.index++];
                    if (c === "\n") this.line++;
                    if (c === "\\") this.index++;
                    else if (c === character) break;
                }
            } else if (this.source.startsWith("//", this.index - 1)) {
                const newline = this.source.indexOf("\n", this.index);
                this.index = newline === -1 ? this.source.length : newline;
            } else if (this.source.startsWith("/*", this.index - 1)) {
                const end = this.source.indexOf("*/", this.index + 1);
                const comment = this.source.slice(
                    this.index,
                    end === -1 ? undefined : end,
                );
                this.line += comment.split("\n").length - 1;
                this.index = end === -1 ? this.source.length : end + 2;
            } else if ("([{".includes(character)) {
                depth++;
            } else if (")]}".includes(character)) {
                depth--;
            } else if (character === ";" && depth === 0) {
                return;
            }
        }
    }

    private skipIgnored(): void {
        while (this.index < this.source.length) {
            const character = this.source[this.index];
            if (/\s/.test(character)) {
                if (character === "\n") this.line++;
                this.index++;
            } else if (this.source.startsWith("//", this.index)) {
                const newline = this.source.indexOf("\n", this.index + 2);
                if (newline === -1) {
                    this.index = this.source.length;
                } else {
                    this.index = newline + 1;
                    this.line++;
                }
            } else {
                return;
            }
        }
    }

    private string(line: number): Token {
        const start = this.index++;
        while (this.index < this.source.length) {
            const character = this.source[this.index++];
            if (character === "\\") {
                this.index++;
            } else if (character === '"') {
                const raw = this.source.slice(start, this.index);
                return { type: "string", value: JSON.parse(raw), line };
            } else if (character === "\n") {
                throw new Error(`Invalid DGP string at line ${line}`);
            }
        }
        throw new Error(`Unterminated DGP string at line ${line}`);
    }

    private identifier(line: number): Token {
        const start = this.index++;
        while (
            this.index < this.source.length &&
            IDENTIFIER_PART.test(this.source[this.index])
        ) {
            this.index++;
        }
        return {
            type: "identifier",
            value: this.source.slice(start, this.index),
            line,
        };
    }
}

const MACROS = "$macros";

class Parser {
    private readonly lexer: Lexer;
    private current: Token;

    constructor(source: string) {
        this.lexer = new Lexer(source);
        this.current = this.lexer.next();
    }

    parse(): DgpCall[] {
        const calls: DgpCall[] = [];
        while (this.current.type !== "eof") {
            if (this.current.value === MACROS) {
                this.lexer.skipStatement();
                this.advance();
            } else {
                calls.push(this.call());
            }
        }
        return calls;
    }

    private call(): DgpCall {
        const first = this.take("identifier");
        let variable: string | null = null;
        let name = first.value as string;
        if (this.current.type === "=") {
            this.advance();
            variable = name;
            name = this.take("identifier").value as string;
        }

        this.take("(");
        const args: DgpValue[] = [];
        if ((this.current.type as TokenType) !== ")") {
            args.push(this.value());
            while ((this.current.type as TokenType) === ",") {
                this.advance();
                args.push(this.value());
            }
        }
        this.take(")");
        this.take(";");
        return { variable, name, arguments: args, line: first.line };
    }

    private value(): DgpValue {
        const token = this.current;
        if (token.type === "number" || token.type === "string") {
            this.advance();
            return { type: "literal", value: token.value };
        }
        if (token.type === "identifier") {
            this.advance();
            if (token.value === "true") return { type: "literal", value: true };
            if (token.value === "false")
                return { type: "literal", value: false };
            if (token.value === "null") return { type: "literal", value: null };
            return { type: "reference", name: token.value as string };
        }
        if (token.type === "[") {
            this.advance();
            const items: DgpValue[] = [];
            if ((this.current.type as TokenType) !== "]") {
                items.push(this.value());
                while ((this.current.type as TokenType) === ",") {
                    this.advance();
                    items.push(this.value());
                }
            }
            this.take("]");
            return { type: "array", items };
        }
        throw new Error(`Invalid DGP value at line ${token.line}`);
    }

    private take(type: TokenType): Token {
        if (this.current.type !== type)
            throw new Error(`Invalid DGP syntax at line ${this.current.line}`);
        const token = this.current;
        this.advance();
        return token;
    }

    private advance(): void {
        this.current = this.lexer.next();
    }
}

export function parseDgp(source: string): DgpCall[] {
    return new Parser(source).parse();
}
