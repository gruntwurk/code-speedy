import { isListOfStrings, cloneArray } from './utils';
import { VariableDefs } from './variables';
import { execSync } from 'child_process';
// These two imports are here for the embedded javascript in the macros to reference
const { window } = require("vscode");
import path = require("path");
import * as vscode from 'vscode';


export enum ActionCommandType {
    command = "CMD",
    javascript = "JS",
    shellscript = "SHELL",
    variables = "VARS",
    snippet = "SNIP"
}

export const actionTypeSynonymns = {
    "cmd": ActionCommandType.command,
    "command": ActionCommandType.command,
    "js": ActionCommandType.javascript,
    "javascript": ActionCommandType.javascript,
    "shell": ActionCommandType.shellscript,
    "shellscript": ActionCommandType.shellscript,
    "vars": ActionCommandType.variables,
    "variables": ActionCommandType.variables,
    "snip": ActionCommandType.snippet,
    "snippet": ActionCommandType.snippet
} as {
    [key: string]: ActionCommandType
};

/**
 * Ensures that a macro definition is a list (of actions), and that each action
 * is a list of strings (e.g. lines of code).
 * If it is only one list of strings, then we infer it's a single action and
 * wrap it in an outer list.
 * Returns true if it is (now) a proper list of lists; otherwise false.
 */
export function homogenizeMacroDef(macroDef: any[]): boolean {
    let valid = true;
    if (!(macroDef instanceof Array)) {
        valid = false;
    } else if (isListOfStrings(macroDef)) {
        const newMacroDef = cloneArray(macroDef);
        for (let i=macroDef.length; i--; i>0) {
            macroDef.pop();
        }
        macroDef.push(newMacroDef);
    } else {
        for (let action of macroDef) {
            if (typeof action === "string") {
                action = [ action ];
            } else if (!isListOfStrings(action)) {
                valid = false;
                break;
            }
        }
    }
    return valid;
}



/**
 * Parses the first line of an action list to get the action type.
 * Returns undefined if no valid command type was found.
 */
export function extractCommand(action: string[]): ActionCommandType | undefined {
    let actionType: ActionCommandType = ActionCommandType.command;
    let cmdTypeName = action[0].split(":", 2)[0].trim();
    return actionTypeSynonymns[cmdTypeName];
}

export async function runCommand(commandAction: string[], varDefs: VariableDefs): Promise<boolean> {
    let commandName = commandAction[0].split(":")[1].trim();
    let commandArgs = varDefs.applySubstitutions(commandAction.slice(1));
    let editor = vscode.window.activeTextEditor;
    console.log(`Running command: ${commandName}`);
    let result: any;
    if ((await commandArgs).length >= 1) {
        result = await vscode.commands.executeCommand(commandName, commandArgs);
    } else {
        result = await vscode.commands.executeCommand(commandName);
    }
    console.log(`New Position: ${editor?.selection.start.character}`);
    console.log(`Command result: ${result}`);
    return true;
}

export async function runSnippet(snippetAction: string[], varDefs: VariableDefs): Promise<boolean> {
    if (snippetAction.length < 2) {
        console.error(`Sorry. Running a snippet by name is not implemented yet. ${snippetAction[0]}`);
        return false;
    }
    let adjustedSnippet = await varDefs.applySubstitutions(snippetAction.slice(1));
    console.log(`Running snippet: ${adjustedSnippet[0]}...`);
    let editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.insertSnippet(<vscode.SnippetString><unknown>(adjustedSnippet.join("\n")));
    }
    return true;
}

export async function runJS(jsAction: string[], varDefs: VariableDefs): Promise<boolean> {
    let adjustedJsCode = varDefs.applySubstitutions(jsAction.slice(1));
    console.log(`Running javascript: ${jsAction[1]}...`);
    eval(`${(await adjustedJsCode).join("\n")}`);
    return true;
}
export async function runShellScript(scriptAction: string[], varDefs: VariableDefs): Promise<boolean> {
    let adjustedScript = varDefs.applySubstitutions(scriptAction.slice(1));
    execSync((await adjustedScript).join("\n"));
    return true;
}
