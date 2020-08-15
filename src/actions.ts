import * as vscode from 'vscode';
import { MacroDef } from './macros';
import { execSync } from 'child_process';

// These two imports are here for the embedded javascript in the macros to reference
const { window } = require("vscode");
import path = require("path");


export enum ActionType {
    description = "DESC",
    command = "CMD",
    javascript = "JS",
    shellscript = "SHELL",
    variables = "VARS",
    snippet = "SNIP"
}

export const actionTypeSynonymns = {
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
            // nothing to do
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
            console.error(`Unimplenented action type encountered: ${this.actionType}`);
        }
    }
    async runCommand(): Promise<boolean> {
        let commandName = this.steps[0];
        let steps = await this.parent.varDefs.applySubstitutions(this.steps.slice(1));
        let commandArgs: CommandArgs = {};
        for (let step of steps) {
            let stepParts = step.split("=",2);
            commandArgs.set(stepParts[0].trim(), stepParts[1].trim());
        }
        let editor = vscode.window.activeTextEditor;
        console.log(`Running command(${this.parent.name} action #${this.sequenceNumber}): ${commandName}`);
        await vscode.commands.executeCommand(commandName, commandArgs);
        return true;
    }

    async runSnippet(): Promise<boolean> {
        let adjustedSnippet = await this.parent.varDefs.applySubstitutions(this.steps);
        console.log(`Running snippet (${this.parent.name} action #${this.sequenceNumber}): "${adjustedSnippet[0]}..."`);
        let editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.insertSnippet(<vscode.SnippetString><unknown>(adjustedSnippet.join("\n")));
        }
        return true;
    }

    async runJS(): Promise<boolean> {
        let adjustedJsCode = await this.parent.varDefs.applySubstitutions(this.steps);
        console.log(`Running javascript (${this.parent.name} action #${this.sequenceNumber}): "${adjustedJsCode[0]}..."`);
        eval(`${(adjustedJsCode).join("\n")}`);
        return true;
    }
    async runShellScript(): Promise<boolean> {
        let adjustedScript = await this.parent.varDefs.applySubstitutions(this.steps);
        console.log(`Running shell script (${this.parent.name} action #${this.sequenceNumber}): "${adjustedScript[0]}..."`);
        execSync((adjustedScript).join("\n"));
        return true;
    }
}
