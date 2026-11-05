export const ACTION_ICONS = {
    open: '<path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2M3 8h16a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h9V3M7 21v-8h10v8M13 5v2"/>',
    undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" transform="translate(0 -2)"/>',
    redo: '<path d="m16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14" transform="translate(0 -2)"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .2c0 1.8-2.5 2-2.5 3.8M12 16.5h.01"/>',
    eraser: '<path d="m15 3 6 6a2 2 0 0 1 0 3l-9 9H7l-5-5a2 2 0 0 1 0-3L12 3a2 2 0 0 1 3 0ZM7 8l9 9M12 21h10"/>',
    axes: '<path d="M4 20V3m-3 3 3-3 3 3M4 20h17m-3-3 3 3-3 3M10 17v3m6-3v3M4 9h3m-3 6h3"/>',
    // A cube.
    space: '<path d="M12 3 4 7.5v9l8 4.5 8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9"/>',
    properties:
        '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--dge-icon-bg, #f8fafc)"/><circle cx="15" cy="17" r="3" fill="var(--dge-icon-bg, #f8fafc)"/>',
    // A set square and a pencil.
    palette:
        '<path d="M3 3v18h18ZM7 12.5V17h4.5Z"/><path d="m12.5 9.5 6-6a1.4 1.4 0 0 1 2 2l-6 6-3 1ZM17 5l2 2" fill="var(--dge-icon-bg, #f8fafc)"/>',
    history:
        '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m4-13h4m-4 4h4m-4 4h4"/>',
    close_history: '<path d="m6 6 12 12M6 18 18 6"/>',
    delete: '<path d="M5 7h14M9 7V4.5h6V7M7 7l.8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7M10 10.5v6M14 10.5v6"/>',
    // The teeth, dashes of a thick circle.
    settings:
        '<circle cx="12" cy="12" r="8" stroke-width="3" stroke-dasharray="3 3.283" stroke-linecap="butt"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.5"/>',
    // A horseshoe, its poles towards the top right.
    magnet: '<g transform="rotate(45 12 12)"><path d="M6 4h4v8a2 2 0 0 0 4 0V4h4v8a6 6 0 0 1-12 0ZM6 8h4m4 0h4"/></g>',
    // A spring pulled towards the top right by its ball.
    spring: '<path d="M2.5 21.5l2-2 3 1.2-2.5-5.9 6 2.4-2.5-5.9 6 2.4-2.5-5.9 3 1.2 1.2-1.2"/><circle cx="18.2" cy="5.8" r="2.6"/>',
    // A turtle seen from above, heading right.
    turtle: '<ellipse cx="11" cy="12" rx="6" ry="4.5"/><path d="M7.5 8.3 6 5.5M14.5 8.3 16 5.5M7.5 15.7 6 18.5M14.5 15.7 16 18.5M5 12H2.5"/><g class="dge-accent"><circle cx="19.5" cy="12" r="2"/><path d="M8 12h6"/></g>',
    // Angle brackets and a slash: code.
    macro_program: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    // A box, its lid open.
    open_box: '<path d="M4 10h16v10H4ZM4 10 2.5 4h16L20 10"/>',
    // Braces.
    new_program:
        '<path d="M9 4H8a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1"/>',
    // A point and its coordinates.
    formula_point:
        '<path d="M3 3v18h18"/><path d="M3 9h11v12" stroke-dasharray="2 2.5"/><circle cx="14" cy="9" r="2.4"/>',
    // A calculator, DGPad's way to an expression.
    as_expression:
        '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    // Points, then the same joined.
    points_list:
        '<circle cx="5" cy="17" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="14" cy="15" r="1.6"/><circle cx="19" cy="6" r="1.6"/>',
    segments_list:
        '<path d="M5 17l5-8 4 6 5-9"/><circle cx="5" cy="17" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="14" cy="15" r="1.6"/><circle cx="19" cy="6" r="1.6"/>',
    // An eye, crossed out.
    hide_name:
        '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20 20 4"/>',
    // A point and its name.
    show_name:
        '<path d="M3.5 17 8 5h1l4.5 12M5.2 12.8h6.6"/><circle cx="18" cy="16.5" r="2.3"/>',
    // Chevrons: the finals of an application, folded or not.
    unfold_finals: '<path d="m9 6 6 6-6 6"/>',
    fold_finals: '<path d="m6 9 6 6 6-6"/>',
    // A pencil.
    edit_definition:
        '<path d="M4 20h4L19.5 8.5a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m14 6 4 4"/>',
    // A staircase.
    steps: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
    // "= 1".
    // A funnel.
    filter: '<path d="M3.5 4.5h17l-6.5 8v6l-4 2v-8Z"/>',
    show_values: '<path d="M3 9.5h7M3 14.5h7M14.5 7.5 17.5 5v14"/>',
    first_step: '<path d="M6.5 6v12M17 6l-7 6 7 6"/>',
    previous_step: '<path d="m15 6-6 6 6 6"/>',
    next_step: '<path d="m9 6 6 6-6 6"/>',
    last_step: '<path d="M17.5 6v12M7 6l7 6-7 6"/>',
    play_steps: '<path d="M8 5.5v13l10-6.5Z" fill="currentColor"/>',
    pause_steps: '<path d="M9 6v12M15 6v12" stroke-width="2.6"/>',
    // A pushpin, its needle towards the bottom left.
    pin: '<g transform="rotate(45 12 12)"><path d="M8 2.5h8M9.5 2.5v6L6 12.5h12l-3.5-4v-6M12 12.5v9"/></g>',
};
