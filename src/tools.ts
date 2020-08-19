import * as vscode from 'vscode';
import * as fs from 'fs';

const { window } = require("vscode");
import path = require("path");
import { MacroDef } from './macros';
import { enquote, logError, logInfo } from './utils';
import { Mutex } from './mutex';

export class MacroWriterTools {
    parent: MacroDef | undefined;
    mutexUnlock: (() => void) | undefined = undefined;

    constructor(parent: MacroDef | undefined) {
        this.parent = parent;
    }

    /**
     * Obtain a mutex lock.
     * (There is probably no need to call this directly from your macro.
     * This is here for the other tools to use.)
     */
    async lock() {
        if (this.parent) {
            logInfo("speedy.lock() called.");
            this.mutexUnlock = await this.parent.runnerMutex.lock();
            logInfo("speedy.lock() has the lock.");
        }
    }

    /**
     * Release the mutex lock
     */
    unlock() {
        logInfo("speedy.unlock() called.");
        if (this.mutexUnlock) {
            this.mutexUnlock();
            logInfo("speedy.unlock() released the lock.");
            this.mutexUnlock = undefined;
        }
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
     * Equivalent of declaring `name = expression` in a `vars:` action, but programmaticly via your custom JavaScript.
     */
    setVariable(varName: string, expression: string) {
        this.parent?.varDefs.setVariable(varName, expression);
    }
    /**
     * Sets a variable to an exact string value (not an expression).
     * Equivalent of declaring `name = "string literal"` in a `vars:` action.
     */
    setLiteral(varName: string, value: string) {
        this.parent?.varDefs.setVariable(varName, enquote(value));
    }

    /**
     * Just a shortcut for: window.activeTextEditor.document.uri.fsPath
     *
     * TIP: use path.parse to break it up:
     *     let fp = speedy.getFilePath();
     *     path.parse(fp).root
     *     path.parse(fp).dir (includes root)
     *     path.parse(fp).name
     *     path.parse(fp).ext (includes dot)
     *     path.parse(fp).base (name + .ext)
     *
     */
    getFilePath(): string {
        return window.activeTextEditor.document.uri.fsPath;
    }

    // /**
    //  * Opens the named file (for append) and then immediately closes it.
    //  * This creates the file if it doesn't exist, or touches the modified date if it does.
    //  */
    // touchFile(filepath: string) {
    //     logInfo(`Touching: ${filepath}`);
    //     fs.closeSync(fs.openSync(filepath, "a"));
    // }

    /**
     * Same as vscode.commands.executeCommand(command) -- except that this
     * uses a mutex lock to make sure the command finishes executing before
     * your javascript resumes.
     */
    async executeCommand(command: string) {
        logInfo(`speedy.executeCommand: ${command}`);
        this.lock();
        try {
            await vscode.commands.executeCommand(command);
        }
        finally {
            this.unlock();
        }
    }

    /**
     * Opens the named file in a new editor window and positions the cursor at the bottom.
     * For example, open a corresponding unit-test script in order to add a new test case at the end.
     * If the file does not already exist, it will be created.
     */
    async editFileToAppend(filepath: string) {
        logInfo(`Opening editor for: ${filepath}`);
        let uri = vscode.Uri.file(filepath);
        this.lock();
        try {
            await vscode.workspace.openTextDocument(uri)
                .then(doc => vscode.window.showTextDocument(doc))
                .then(ed => ed.revealRange(ed.visibleRanges[0]))
                .then(x => vscode.commands.executeCommand("cursorBottom"));
        }
        finally {
            this.unlock();
        }
    }

    /**
     * Parses the Python function signature that's under the cursor (anywhere on the line).
     * Returns an object with the following attributes:
     *     functionName: the function name,
     *     argumentCount: the number of argument definitions
     *     argumentNames: a list of the argument names, in order
     *     argumentTypes: a list of the argument types (hints), in order
     *     argumentDefaults: a list of the argument defaults, in order
     *     isClassMember: if the first argument is "self", then this flag is set and that argument is skipped.
     * If an argument has no type hint, then it will be an empty string.
     * Likewise, if no default value.
     */
    parsePythonSignature(pythonCodeLine: string): any {
        const signaturePattern = /^\s*(def\s+)+(\w+)\(([^)]*)\)([^:]*):/g;
        const argumentPattern = /([^:=,]+)(:([^=,]+))?(=([^,]+))?(,|$)/g;
        logInfo(`Parsing: ${pythonCodeLine}`);
        const fMatches = pythonCodeLine.matchAll(signaturePattern);
        let result = {};
        for (const fMatch of fMatches) {
            let functionName = fMatch[2].trim();
            let argNames = [];
            let argTypes = [];
            let argDefaults = [];
            let isClassMember = false;
            const aMatches = fMatch[3].matchAll(argumentPattern);
            for (const aMatch of aMatches) {
                let argName = aMatch[1].trim();
                let argType = "";
                if (aMatch[3]) {
                    argType = aMatch[3].trim();
                }
                let argDefault = "";
                if (aMatch[5]) {
                    argDefault = aMatch[5].trim();
                }
                // FIXME For some strange reason, if the val is enclosed in single-quotes, then it comes back undefined, but if it's in double-quotes, it's fine.
                if (argName === 'self') {
                    isClassMember = true;
                } else {
                    argNames.push(argName);
                    argTypes.push(argType);
                    argDefaults.push(argDefault);
                }
            }
            result = {
                functionName: functionName,
                argumentCount: argNames.length,
                argumentNames: argNames,
                argumentTypes: argTypes,
                argumentDefaults: argDefaults,
                isClassMember: isClassMember
            };

        }
        logInfo(`${result}`);
        return result;
    }
}