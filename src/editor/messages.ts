/// <reference types="vite/client" />
import { LANG } from "../i18n";
import en from "./lang/en";

// The editor speaks the languages of DocTools: see EDITOR.md.

export type MessageKey = keyof typeof en;

export interface Texts {
    messages: Partial<Record<MessageKey, string>>;
    // By English name, the usual words of geometry in this language.
    commands?: Partial<Record<string, string>>;
}

// One chunk per language, loaded alone.
const LANGUAGES = import.meta.glob<Texts>(["./lang/*.ts", "!./lang/en.ts"], {
    import: "default",
});

export const TEXTS: Texts = (await LANGUAGES[`./lang/${LANG}.ts`]?.()) ?? {
    messages: {},
};

export const message = (key: MessageKey, detail = ""): string =>
    (TEXTS.messages[key] ?? en[key]).replace("%", detail);
