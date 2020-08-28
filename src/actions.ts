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
    snippet = "SNIP",
    waitfor = "WAITFOR"
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
    "snippet": ActionType.snippet,
    "waitfor": ActionType.waitfor
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

    async runner(): Promise<any> {
        if (this.actionType === undefined) {
            logError(`Action #${this.sequenceNumber} of the ${this.parent.name} macro does not specify a valid action type. Skipping.`);
        } else if (this.actionType === ActionType.description) {
            return this.applyDescription();
        } else if (this.actionType === ActionType.speedy) {
            return this.applySpeedyOptions();
        } else if (this.actionType === ActionType.variables) {
            return this.runVarsAction();
        } else if (this.actionType === ActionType.command) {
            return this.runCommand();
        } else if (this.actionType === ActionType.javascript) {
            return this.runJS();
        } else if (this.actionType === ActionType.shellscript) {
            return this.runShellScript();
        } else if (this.actionType === ActionType.snippet) {
            return this.runSnippet();
        } else if (this.actionType === ActionType.waitfor) {
            return this.runWaitFor();
        } else {
            logError(`Unimplemented action type encountered: ${this.actionType}`);
        }
        return null;
    }

    runWaitFor() {
        let cond = this.steps[0];
        logInfo(`TRACE #${this.sequenceNumber}: runWaitFor condtion: ${cond}`);
        this.parent.pauseMacro();
        var id: NodeJS.Timeout;
        var count = 0;
        let speedy = this.parent.tools;
        const upon = () => {
            let result = eval(cond);
            logInfo(`${cond} = ${result}`);
            if (count++ > 10 || result) {
                logInfo(`WaitFor count = ${count}`);
                clearInterval(id);
                this.parent.resume(this.sequenceNumber+1);
            }
        };
        id = setInterval(upon, 50);
    }


    applyDescription() {
        logInfo(`TRACE #${this.sequenceNumber}: applyDescription`);
        if (this.parent.options.verbose) {
            logInfo(`Macro description (${this.parent.name} action #${this.sequenceNumber}) ignored (for now).`);
        }
    }
    async runVarsAction() {
        logInfo(`TRACE #${this.sequenceNumber}: runVarsAction`);
        this.parent.varDefs.addVariables(this.steps);
    }
    async applySpeedyOptions() {
        logInfo(`TRACE #${this.sequenceNumber}: applySpeedyOptions`);
        for (let step of this.steps) {
            let stepParts = step.split("=", 2);
            this.parent.options[stepParts[0].trim()] = stepParts[1].trim();
            logVerbose(this.parent.options.verbose);
            logInfo(`Setting option ${stepParts[0].trim()} to ${stepParts[1].trim()}`);
        }
    }
    async runCommand() {
        logInfo(`TRACE #${this.sequenceNumber}: runCommand`);
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
        logInfo(`TRACE #${this.sequenceNumber}: runSnippet`);
        let first = 0;
        if (this.steps[0].startsWith("IFDEF ")) {
            let varname = this.steps[0].slice(6).trim();
            let exists = this.parent.varDefs.variableExists(varname);
            logInfo(`${this.steps[0]} ${exists ? 'exists' : 'does no exist'}`);
            if (!exists) {
                logInfo(`skipping`);
                return;
            }
            first = 1;
        } else if (this.steps[0].startsWith("IFNDEF ")) {
            let varname = this.steps[0].slice(7).trim();
            let exists = this.parent.varDefs.variableExists(varname);
            logInfo(`${this.steps[0]} ${exists ? 'exists' : 'does no exist'}`);
            if (exists) {
                logInfo(`skipping`);
                return;
            }
            first = 1;
        }
        let adjustedSnippet = await this.parent.varDefs.applySubstitutions(this.steps.slice(first));
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
        let speedy = this.parent.tools;
        try {
            eval(code.join("\n"));
            // return Function('return (' + code.join("\n") + ')')(); // ( vscode );
        }
        catch (e) {
            logError(`ERROR in javascript (${this.parent.name} action #${this.sequenceNumber}): ${e.message}`);
        }
    }

    async runJS() {
        logInfo(`TRACE #${this.sequenceNumber}: runJS`);
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
        logInfo(`TRACE #${this.sequenceNumber}: runShellScrip`);
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
