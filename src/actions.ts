import * as vscode from 'vscode';
import { MacroDef } from './macros';
import { execSync } from 'child_process';

// These two imports are here for the embedded javascript in the macros to reference
const { window } = require("vscode");
const path = require("path");
import { MacroWriterTools } from './tools';


export enum ActionType {
    speedy = "SPEEDY",
    description = "DESC",
    command = "CMD",
    javascript = "JS",
    shellscript = "SHELL",
    variables = "VARS",
    snippet = "SNIP"
}

export const actionTypeSynonymns = {
    "speedy": ActionType.speedy,
    "desc": ActionType.description,
    "description": ActionType.description,
    "cmd": ActionType.command,
    "command": ActionType.command,
    "js": ActionType.javascript,
    "javascript": ActionType.javascript,
    "shell": ActionType.shellscript,
    "shellscript": ActionType.shellscript,
    "vars": ActionType.variables,
    "variables": ActionType.variables,
    "snip": ActionType.snippet,
    "snippet": ActionType.snippet
} as {
    [key: string]: ActionType
};

interface CommandArgs {
    [key: string]: any
}

export class MacroAction {
    parent: MacroDef;
    sequenceNumber: number;
    actionType: ActionType | undefined = undefined;
    steps: string[] = [];

    constructor(parent: MacroDef, sequenceNumber: number, actionTypeString: string) {
        this.parent = parent;
        this.sequenceNumber = sequenceNumber;
        this.actionType = actionTypeSynonymns[actionTypeString];
    }

    async execute() {
        if (this.actionType === undefined) {
            console.error(`Action #${this.sequenceNumber} of the ${this.parent.name} macro does not specify a valid action type. Skipping.`);
            return;
        }
        let outcome: boolean;
        if (this.actionType === ActionType.description) {
            this.applyDescription();
        } else if (this.actionType === ActionType.speedy) {
            this.applySpeedyOptions();
        } else if (this.actionType === ActionType.variables) {
            this.parent.varDefs.addVariables(this.steps);
        } else if (this.actionType === ActionType.command) {
            outcome = await this.runCommand();
        } else if (this.actionType === ActionType.javascript) {
            outcome = await this.runJS();
        } else if (this.actionType === ActionType.shellscript) {
            outcome = await this.runShellScript();
        } else if (this.actionType === ActionType.snippet) {
            outcome = await this.runSnippet();
        } else {
            console.error(`Unimplemented action type encountered: ${this.actionType}`);
        }
    }
    applyDescription() {
        if (this.parent.options.verbose) {
            console.log(`Macro description (${this.parent.name} action #${this.sequenceNumber}) ignored (for now)."`);
        }
    }
    applySpeedyOptions() {
        for (let step of this.steps) {
            let stepParts = step.split("=", 2);
            this.parent.options[stepParts[0].trim()] = stepParts[1].trim();
            if (this.parent.options.verbose) {
                console.log(`Setting option ${stepParts[0].trim()} to ${stepParts[1].trim()}`);
            }
        }

    }
    async runCommand(): Promise<boolean> {
        let commandName = this.steps[0];
        let commandArgs = await this.parent.varDefs.applySubstitutions(this.steps.slice(1));
        let editor = vscode.window.activeTextEditor;
        if (this.parent.options.verbose) {
            console.log(`Running command (${this.parent.name} action #${this.sequenceNumber}): ${commandName}`);
        }
        try {
            await vscode.commands.executeCommand(commandName, ...commandArgs);
        }
        catch(e) {
            console.error(`ERROR in command (${this.parent.name} action #${this.sequenceNumber}): ${commandName}: ${e.message}` );
        }
        return true;
    }

    async runSnippet(): Promise<boolean> {
        let adjustedSnippet = await this.parent.varDefs.applySubstitutions(this.steps);
        if (this.parent.options.verbose) {
            if (adjustedSnippet.length === 1) {
                console.log(`Inserting a 1 line snippet (${this.parent.name} action #${this.sequenceNumber}): "${adjustedSnippet[0]}"`);
            } else {
                console.log(`Inserting a ${adjustedSnippet.length} line snippet (${this.parent.name} action #${this.sequenceNumber}) starting with: "${adjustedSnippet[0]}..."`);
            }
        }
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            let ss = new vscode.SnippetString(adjustedSnippet.join("\n"));
            editor.insertSnippet(ss);
        }
        return true;
    }
    runJsCodeInMacroEnvironment(code: string[]) {
        console.log(code.join("\n"));
        let speedy = new MacroWriterTools(this.parent);
        try {
            eval(code.join("\n"));
            // return Function('return (' + code.join("\n") + ')')(); // ( vscode );
        }
        catch (e) {
            console.error(`ERROR in javascript (${this.parent.name} action #${this.sequenceNumber}): ${e.message}`);
        }
    }

    async runJS(): Promise<boolean> {
        let adjustedJsCode = await this.parent.varDefs.applySubstitutions(this.steps);
        if (this.parent.options.verbose) {
            if (adjustedJsCode.length === 1) {
                console.log(`Running javascript (${this.parent.name} action #${this.sequenceNumber}): "${adjustedJsCode[0]}"`);
            } else {
                console.log(`Running ${adjustedJsCode.length} lines of javascript (${this.parent.name} action #${this.sequenceNumber}) starting with: "${adjustedJsCode[0]}..."`);
            }
        }
        this.runJsCodeInMacroEnvironment(adjustedJsCode);
        return true;
    }
    async runShellScript(): Promise<boolean> {
        let adjustedScript = await this.parent.varDefs.applySubstitutions(this.steps);
        if (this.parent.options.verbose) {
            if (adjustedScript.length === 1) {
                console.log(`Running shell command (${this.parent.name} action #${this.sequenceNumber}): "${adjustedScript[0]}"`);
            } else {
                console.log(`Running ${adjustedScript.length} lines of shell script (${this.parent.name} action #${this.sequenceNumber}) starting with: "${adjustedScript[0]}..."`);
            }
        }
        execSync((adjustedScript).join("\n"));
        return true;
    }
}
