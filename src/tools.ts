import * as vscode from 'vscode';
import * as fs from 'fs';

const { window } = require("vscode");
import path = require("path");
import { MacroDef } from './macros';
import { enquote, logError, logInfo } from './utils';
import { Mutex } from './mutex';
import { DH_NOT_SUITABLE_GENERATOR } from 'constants';

export class MacroWriterTools {
    parent: MacroDef | undefined;
    runnerMutex: Mutex;
    className: string = "";

    constructor(parent: MacroDef | undefined) {
        this.parent = parent;
        if (parent) {
            this.runnerMutex = parent.runnerMutex;
        } else {
            this.runnerMutex = new Mutex();
        }
    }

 

    matchAll(haystack: string, pattern: string): string[] {
        const regexp = RegExp(pattern, 'g');
        let matches = [];
        let match;
        while ((match = regexp.exec(haystack)) !== null) {
            matches.push(match[0]);
        }
        return matches;
    }

    /**
     * Converts CamelCase or javaCase to snake_case (all lower with underscores).
     */
    snakeCase(identifier: string) {
        let wordMatches = this.matchAll(identifier, "([a-z]+|[A-Z][a-z]*|[^A-Za-z]+)");
        let words = [];
        for (const match of wordMatches) {
            words.push(match[0].toLowerCase());
        };
        return words.join("_");
    };

    /**
     * Converts snake_case to CamelCase.
     */
    camelCase(identifier: string) {
        let words = identifier.split('_');
        let camelWords = words.map(function (w) {
            return w[0].toUpperCase() + w.slice(1,).toLowerCase();
        });
        return camelWords.join('');
    };

    /**
     * Converts snake_case to javaCase (same as CamelCase but with a leading lowercase).
     */
    javaCase(identifier: string) {
        let words = identifier.split('_');
        let camelWords = words.map(function (w) {
            return w[0].toUpperCase() + w.slice(1,).toLowerCase();
        });
        camelWords[0] = camelWords[0].toLowerCase();
        return camelWords.join('');
    };


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
     * Deletes a variable definition. (Okay if it doesn't exist already.)
     */
    unsetVariable(varName: string) {
        this.parent?.varDefs.unsetVariable(varName);
    }
    /**
     * Sets a variable to an exact string value (not an expression).
     * Equivalent of declaring `name = "string literal"` in a `vars:` action.
     */
    setLiteral(varName: string, value: string) {
        this.parent?.varDefs.setVariable(varName, enquote(value));
    }
    getVariableValue(varName: string): any {
        if (this.parent) {
            return this.parent.varDefs.evaluateVariable(varName);
        }
        return null;
    }
    findVars(symbols: vscode.DocumentSymbol[], symbolKind = vscode.SymbolKind.Variable): vscode.DocumentSymbol[] {
        var vars = symbols.filter(symbol => symbol.kind === symbolKind);
        return vars.concat(symbols.map(symbol => this.findVars(symbol.children, symbolKind))
            .reduce((a, b) => a.concat(b), []));
    }

    /**
     * Returns the name of the first class symbol found in the document.
     * TODO get it to check the range for the current position, and not settle on the first one.
     */
    getClassName(): string {
        // console.log(`getClassName called. Returning ${this.className}`);
        return this.className;
    }

    async loadClassName() {
        console.log(`loadClassName called.`);
        var editor = vscode.window.activeTextEditor;
        if (editor !== undefined) {
            let filepath = editor.document.uri;
            await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider', filepath)
                .then(symbols => {
                    if (symbols !== undefined) {
                        console.log(`symbols.length = ${symbols.length}.`);
                        let classes = this.findVars(symbols, vscode.SymbolKind.Class);
                        console.log(`classes.length = ${classes.length}.`);
                        for (const variable of classes) {
                            console.log(`loadClassName inner found: ${variable.name}`);
                            this.className = variable.name;
                            break;
                        }
                    }
                    console.log(`loadClassName reports: ${this.className}`);
                });
            }
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

    pathExists(filepath: string): boolean {
        return fs.existsSync(filepath);
    }

    findSisterPath(subFolder: string) {
        let fp = this.getFilePath();
        while (true) {
            let testPath = path.join(fp, subFolder);
            if (this.pathExists(testPath)) {
                return testPath;
            }
            fp = path.parse(fp).dir;
            if (path.parse(fp).root >= fp) {
                break;
            }
        }
        return "";
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
        const unlock = await this.runnerMutex.lock("executeCommand");
        try {
            await vscode.commands.executeCommand(command);
        }
        finally {
            unlock();
            logInfo("executeCommand unlocked.");
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
        await vscode.workspace.openTextDocument(uri)
            .then(doc => vscode.window.showTextDocument(doc))
            .then(ed => ed.revealRange(ed.visibleRanges[0]))
            .then(x => vscode.commands.executeCommand("cursorBottom"));
    }

    /**
     * Parses the Python class or function signature that's under the cursor (anywhere on the line).
     * Returns an object with the following attributes:
     *     isClass: true if the line in question is a class signture
     *     className: the class name (if a class signature, otherwise...)
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
        const classSignaturePattern = /^\s*(class\s+)(\w+)(\(\w+\))?:/g;
        const functionSignaturePattern = /^\s*(def\s+)(\w+)\(([^)]*)\)([^:]*):/g;
        const argumentPattern = /([^:=,]+)(:([^=,]+))?(=([^,]+))?(,|$)/g;
        logInfo(`Parsing: ${pythonCodeLine}`);
        const cMatches = pythonCodeLine.matchAll(classSignaturePattern);
        const fMatches = pythonCodeLine.matchAll(functionSignaturePattern);
        let result = {};
        for (const cMatch of cMatches) {
            let className = cMatch[2].trim();
            result = {
                className: className,
                isClass: true
            };
        }
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
                isClassMember: isClassMember,
                isClass: false
            };
        }
        logInfo(`${result}`);
        return result;
    }
}