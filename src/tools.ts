import * as vscode from 'vscode';

const { window } = require("vscode");
import path = require("path");
import { MacroDef } from './macros';

export class MacroWriterTools {
    parent: MacroDef;

    constructor(parent: MacroDef) {
        this.parent = parent;
    }

    /**
     * This tool will check each selection (if multi-select, or just the one if not).
     * If a selection is empty (just a cursor, i.e. start == end),
     * then that selection is expanded to the word under the cursor.
     */
    expandAllSelectionsToWords() {
        let editor = window.activeTextEditor;
        let sels = editor.selections;
        for (let i = sels.length - 1; i >= 0; i--) {
            let sel = sels[i];
            if (sel.isEmpty) {
                let r = editor.document.getWordRangeAtPosition(sel.start);
                sels[i] = new vscode.Selection(r.start, r.end);
            }
        }
        editor.selections = sels;
    }

    /**
     * Equivalent of declaring `name = value` in a `vars:` action, but programmaticly via your custom JavaScript.
     */
    setVariable(varName: string, value: string) {
        this.parent.varDefs.setVariableExplicit(varName, value);
    }
}