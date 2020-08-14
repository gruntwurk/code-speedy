import { escapeRegExp, onlyUnique } from './utils';

let variableNames: string[] = [];
let variableExpressions: string[] = [];

const standardVariablesAction = [
    "vars:",
    "CLIPBOARD = vscode.env.clipboard.readText()",
    "CURRENT_FILE_DIR = path.dirname(window.activeTextEditor.document.uri.fsPath)",
    "CURSOR_CHAR_NUMBER = window.activeTextEditor.selection.start.character",
    "DOC_CURRENT_LINE = doc.lineAt(window.activeTextEditor.selection.start)",
    "DOC_ENTIRE_TEXT = doc.getText()",
    "EOL_STYLE = (doc.eol == 1 ? 'LF' : 'CRLF')",
    "LINE_COUNT = window.activeTextEditor.document.lineCount",
    "MACHINE_ID = vscode.env.machineId (The name of computer you are running on)",
    "MULTI_SELECT_COUNT = window.activeTextEditor.selections.length",
    "PREFERED_LANGUAGE = vscode.env.language('en-US')",
    "SESSION_ID = vscode.env.sessionId (A unique string that changes when VS Code restarts)",
    "SHELL_NAME = vscode.env.shell (The name of the default terminal shell)",
    "TM_CURRENT_LINE = window.activeTextEditor.document.lineAt(window.activeTextEditor.selection.start)",
    "TM_CURRENT_WORD = window.activeTextEditor.document.getText(window.activeTextEditor.document.getWordRangeAtPosition(window.activeTextEditor.selection.start))",
    "TM_DIRECTORY = vscode.workspace.rootPath",
    "TM_FILENAME = path.basename(window.activeTextEditor.document.uri.fsPath)",
    "TM_FILENAME_BASE = path.basename(window.activeTextEditor.document.uri.fsPath).replace(/\\.[^/.]+$/, '')",
    "TM_FILEPATH = window.activeTextEditor.document.uri.fsPath",
    "TM_LINE_INDEX = window.activeTextEditor.selection.start.line",
    "TM_LINE_NUMBER = window.activeTextEditor.selection.start.line + 1",
    "TM_SELECTED_TEXT = window.activeTextEditor.document.getText(window.activeTextEditor.selection)",
    "TODAY = new Date().toDateString();",
    "WORKSPACE_NAME = vscode.workspace.name"
];



export class VariableDefs {
    variableNames: string[] = [];
    variableExpressions: string[] = [];

    /**
     * Appends the contents of the given "action" (a list of variable definitions)
     * to the running list. The first line of the action must begin with the
     * command type ("vars:", or * "variables:").
     * The colon may optionally be followed by the word "standard", in which case
     * a dozen standard definitions will be appended.
     * The following lines, if any, add custom definitions.
     * If a custom definition has a variable name, followed by an equal sign, but
     * nothing after that, then if there is an existing definiution for that
     * variable, it will be removed.
     */
    addVariables(action: string[]) {
        let cmdLineArg = action[0].split(":", 2)[1].trim();
        if (cmdLineArg === "standard") {
            this.addVariables(standardVariablesAction);
        }
        for (let varDef of action.slice(1)) {
            let varExpresion = "";
            let parts = varDef.split("=", 2);
            let varName = parts[0].trim();
            if (varName.startsWith("$")) {
                varName = varName.slice(1);
            }
            if (parts.length > 1) {
                let varExpresion = parts[1].trim();
            }
            if (varExpresion) {
                this.addVariable(varName, varExpresion);
            } else {
                this.removeVariable(varName);
            }
        }
    };

    addVariable(varName: string, varExpresion: string) {
        let i = variableNames.indexOf(varName);
        if (i === -1) {
            variableNames.push(varName);
            variableExpressions.push(varExpresion);
        } else {
            variableExpressions[i] = varExpresion;
        }
    }

    removeVariable(varName: string) {
        let i = variableNames.indexOf(varName);
        if (i > -1) {
            variableNames.splice(i, 1);
            variableExpressions.splice(i, 1);
        }
    }

    /**
     * Executes the expression associated with the given variable name and returns the result.
     * Returns null if no such variable is defined.
     */
    evaluateVariable(varName: string): any {
        let i = variableNames.indexOf(varName);
        if (i > -1) {
            return eval(variableExpressions[i]);
        }
        return null;
    }

    /**
     * Applies the variable substitutions to the given array of strings.
     * Starts by searching for all $xxx placeholders (no braces).
     * For any placeholder that matches a defined variable, that
     * variable's expression is evaluated and then al occurances of the
     * placeholder is replaced by the answer.
     */
    async applySubstitutions(text: string[]): Promise<string[]> {
        let varsFound = this.findAllVariablePlaceholders(text);
        console.log(`Found ${varsFound.length} variables: ${varsFound}`);
        let adjustedText: string[] = [];
        text.forEach(val => adjustedText.push(val));
        if (varsFound) {
            for (let varName of varsFound) {
                let substitution = this.evaluateVariable(varName);
                if (substitution) {
                    if (substitution instanceof Promise) {
                        substitution = await substitution;
                    }
                    substitution = `${substitution}`;
                }
                let replacer = (line: string) => {
                    return line.replace(RegExp(escapeRegExp(varName), "g"), substitution);
                };
                for (let i = 0; i < text.length; i++) {
                    adjustedText[i] = replacer(adjustedText[i]);
                }
            }
        }
        return adjustedText;
    }

    findAllVariablePlaceholders(action: string[]): string[] {
        const regexp = /(\$\w+|\$\{\w+\})/g;
        const matches = action.join("\n").matchAll(regexp);
        let varsFound = [];
        for (const match of matches) {
            varsFound.push(match[1]);
        }
        return varsFound.filter(onlyUnique);
    }

}