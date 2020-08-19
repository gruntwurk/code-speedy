import * as vscode from 'vscode';
import { MacroDef } from './macros';
import { execSync } from 'child_process';

// These two imports are here for the embedded javascript in the macros to reference
const { window } = require("vscode");
const path = require("path");
import { MacroWriterTools } from './tools';
import { logError, logInfo, logVerbose } from './utils';


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
            logError(`Action #${this.sequenceNumber} of the ${this.parent.name} macro does not specify a valid action type. Skipping.`);
            return;
        }
        const unlock = await this.parent.runnerMutex.lock();
        logInfo(`Action #${this.sequenceNumber} of the ${this.parent.name} macro has the lock.`);
        try {
            if (this.actionType === ActionType.description) {
                this.applyDescription();
            } else if (this.actionType === ActionType.speedy) {
                this.applySpeedyOptions();
            } else if (this.actionType === ActionType.variables) {
                this.runVarsAction();
            } else if (this.actionType === ActionType.command) {
                this.runCommand();
            } else if (this.actionType === ActionType.javascript) {
                this.runJS();
            } else if (this.actionType === ActionType.shellscript) {
                this.runShellScript();
            } else if (this.actionType === ActionType.snippet) {
                this.runSnippet();
            } else {
                logError(`Unimplemented action type encountered: ${this.actionType}`);
            }
        } finally {
            unlock();
            logInfo(`Action #${this.sequenceNumber} of the ${this.parent.name} macro has released the lock.`);
        }
    }


    applyDescription() {
        if (this.parent.options.verbose) {
            logInfo(`Macro description (${this.parent.name} action #${this.sequenceNumber}) ignored (for now).`);
        }
    }
    async runVarsAction() {
        this.parent.varDefs.addVariables(this.steps);
    }
    async applySpeedyOptions() {
        for (let step of this.steps) {
            let stepParts = step.split("=", 2);
            this.parent.options[stepParts[0].trim()] = stepParts[1].trim();
            logVerbose(this.parent.options.verbose);
            logInfo(`Setting option ${stepParts[0].trim()} to ${stepParts[1].trim()}`);
        }
    }
    async runCommand() {
        let commandName = this.steps[0];
        let commandArgs: string[] = [];
        if (this.steps.length > 1) {
            commandArgs = await this.parent.varDefs.applySubstitutions(this.steps.slice(1));
        }
        logInfo(`Running command (${this.parent.name} action #${this.sequenceNumber}): ${commandName}`);
        try {
            if (commandArgs) {
                await vscode.commands.executeCommand(commandName, ...commandArgs);
            } else {
                await vscode.commands.executeCommand(commandName);
            }

        }
        catch (e) {
            logError(`ERROR in command (${this.parent.name} action #${this.sequenceNumber}): ${commandName}: ${e.message}`);
        }
    }

    async runSnippet() {
        let adjustedSnippet = await this.parent.varDefs.applySubstitutions(this.steps);
        if (adjustedSnippet.length === 1) {
            logInfo(`Inserting a 1 line snippet (${this.parent.name} action #${this.sequenceNumber}): "${adjustedSnippet[0]}"`);
        } else {
            logInfo(`Inserting a ${adjustedSnippet.length} line snippet (${this.parent.name} action #${this.sequenceNumber}) starting with: "${adjustedSnippet[0]}..."`);
        }
        let ss = new vscode.SnippetString(adjustedSnippet.join("\n"));
        await vscode.window.activeTextEditor?.insertSnippet(ss);
    }

    runJsCodeInMacroEnvironment(code: string[]) {
        // logInfo(code.join("\n"));
        let speedy = new MacroWriterTools(this.parent);
        try {
            eval(code.join("\n"));
            // return Function('return (' + code.join("\n") + ')')(); // ( vscode );
        }
        catch (e) {
            logError(`ERROR in javascript (${this.parent.name} action #${this.sequenceNumber}): ${e.message}`);
        }
    }

    async runJS() {
        // NOTE: We cann do applySubstitutions(this.steps) here, because the ${} placeholders conflict with code that uses `` format strings
        let adjustedJsCode = this.steps;
        if (this.parent.options.verbose) {
            if (adjustedJsCode.length === 1) {
                logInfo(`Running javascript (${this.parent.name} action #${this.sequenceNumber}): "${adjustedJsCode[0]}"`);
            } else {
                logInfo(`Running ${adjustedJsCode.length} lines of javascript (${this.parent.name} action #${this.sequenceNumber}) starting with: "${adjustedJsCode[0]}..."`);
            }
        }
        this.runJsCodeInMacroEnvironment(adjustedJsCode);
    }
    async runShellScript() {
        let adjustedScript = await this.parent.varDefs.applySubstitutions(this.steps);
        if (this.parent.options.verbose) {
            if (adjustedScript.length === 1) {
                logInfo(`Running shell command (${this.parent.name} action #${this.sequenceNumber}): "${adjustedScript[0]}"`);
            } else {
                logInfo(`Running ${adjustedScript.length} lines of shell script (${this.parent.name} action #${this.sequenceNumber}) starting with: "${adjustedScript[0]}..."`);
            }
        }
        execSync((adjustedScript).join("\n"));
    }
}
