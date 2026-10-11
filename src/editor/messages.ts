import { FRENCH } from "./catalog";

// The editor speaks French or English, as its command names.
const MESSAGES = {
    syntax: ["Écriture incomprise : %", "Can't read: %"],
    expected: ["Attendu : %", "Expected: %"],
    coordinates: [
        "Un point a deux ou trois coordonnées",
        "A point has two or three coordinates",
    ],
    unknown_command: ["Commande inconnue : %", "Unknown command: %"],
    unknown_object: ["Objet inconnu : %", "Unknown object: %"],
    arguments: ["Arguments incorrects pour %", "Wrong arguments for %"],
    instead: ["Avec ces arguments : %", "With these arguments: %"],
    branch: [
        "Le numéro d'intersection va de 1 à 4",
        "The intersection number goes from 1 to 4",
    ],
    name_taken: ["Le nom % est déjà pris", "The name % is taken"],
    cycle: [
        "Un objet ne peut dépendre de lui-même",
        "An object can't depend on itself",
    ],
    read_only: [
        "Cet objet ne s'écrit pas encore en texte",
        "This object has no text form yet",
    ],
    input: ["Saisie…", "Input…"],
    open: ["Ouvrir", "Open"],
    save: ["Enregistrer", "Save"],
    undo: ["Annuler", "Undo"],
    redo: ["Refaire", "Redo"],
    delete: ["Supprimer", "Delete"],
    cancel: ["Abandonner l'outil (Échap)", "Drop the tool (Escape)"],
    designate: ["Désignez %", "Designate %"],
    polygon_end: [
        "Désignez un sommet, ou le premier pour finir",
        "Designate a vertex, or the first one to finish",
    ],
    unsupported: ["Non importé : %", "Not imported: %"],
    point: ["un point", "a point"],
    pointOn: ["un point sur objet", "a point on an object"],
    line: ["une droite", "a line"],
    segment: ["un segment", "a segment"],
    circle: ["un cercle", "a circle"],
    intersectable: [
        "une droite, un cercle, une conique ou une courbe",
        "a line, a circle, a conic or a curve",
    ],
    curved: [
        "un cercle, une conique ou une courbe",
        "a circle, a conic or a curve",
    ],
    support: ["un objet", "an object"],
    path: [
        "une droite, un cercle ou une courbe",
        "a line, a circle or a curve",
    ],
    outline: ["un polygone ou une conique", "a polygon or a conic"],
    real: ["un nombre", "a number"],
};

export type MessageKey = keyof typeof MESSAGES;

export const message = (key: MessageKey, detail = ""): string =>
    MESSAGES[key][FRENCH ? 0 : 1].replace("%", detail);
