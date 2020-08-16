import * as vscode from 'vscode';

const { window } = require("vscode");
const path = require("path");

import { escapeRegExp, onlyUnique } from './utils';

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

interface VariableDict {
    [name: string]: string;
}


export class VariableDefs {
    variableDict: VariableDict = {};

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
    addVariables(pairs: string[]) {
        for (let varDef of pairs) {
            if (varDef.trim() === "standard") {
                this.addVariables(standardVariablesAction);
                continue;
            }
            let varExpression = "";
            let parts = varDef.split("=", 2);
            let varName = parts[0].trim();
            if (varName.startsWith("$")) {
                varName = varName.slice(1);
            }
            if (parts.length > 1) {
                varExpression = parts[1].trim();
            }
            this.setVariable(varName, varExpression);
        }
    };
    setVariable(varName: string, varExpression: string) {
        if (varExpression) {
            this.variableDict[varName] = varExpression;
        } else {
            delete this.variableDict[varName];
        }
    }
    setVariableExplicit(varName: string, value: string) {
        if (value) {
            let varExpression;
            if (value.includes('"')) {
                varExpression = `'${value}'`;
            } else {
                varExpression = `"${value}"`;
            }
            varExpression = varExpression.replace(/\\/g, "\\\\");
            this.variableDict[varName] = varExpression;
        } else {
            delete this.variableDict[varName];
        }
    }
    /**
     * Executes the expression associated with the given variable name and returns the result.
     */
    evaluateVariable(varName: string): any {
        //TODO does var exist?
        console.log(`window: ${typeof window}`);
        console.log(`vscode: ${typeof vscode}`);
        console.log(`path: ${typeof path}`);

        let expression = this.variableDict[varName];
        let value = undefined;
        try {
            value = eval(expression);
            console.log(`${varName}: ${expression} = ${value}`);
        } catch (e) {
            console.error(`ERROR in variable expression (${varName} = ${expression}): ${e.message}`);
        }
        return value;
    }

    /**
     * Applies the variable substitutions to the given array of strings.
     * Starts by searching for all $xxx placeholders (no braces).
     * For any placeholder that matches a defined variable, that
     * variable's expression is evaluated and then al occurances of the
     * placeholder is replaced by the answer.
     */
    async applySubstitutions(text: string[]): Promise<string[]> {
        let placeholdersFound = this.findAllVariablePlaceholders(text);
        console.log(`Found ${placeholdersFound.length} placeholders: ${placeholdersFound}`);
        let adjustedText: string[] = [];
        text.forEach(val => adjustedText.push(val));
        if (placeholdersFound) {
            for (let placeholder of placeholdersFound) {
                let substitution = this.evaluateVariable(placeholder.replace(/[${}]/g, ""));
                if (substitution) {
                    if (substitution instanceof Promise) {
                        substitution = await substitution;
                    }
                    substitution = `${substitution}`;
                }
                let replacer = (line: string) => {
                    return line.replace(RegExp(escapeRegExp(placeholder), "g"), substitution);
                };
                for (let i = 0; i < text.length; i++) {
                    adjustedText[i] = replacer(adjustedText[i]);
                }
            }
        }
        return adjustedText;
    }

    findAllVariablePlaceholders(actionSteps: string[]): string[] {
        const regexp = /(\$\w+|\$\{\w+\})/g;
        const matches = actionSteps.join("\n").matchAll(regexp);
        let varsFound = [];
        for (const match of matches) {
            varsFound.push(match[1]);
        }
        return varsFound.filter(onlyUnique);
    }

}