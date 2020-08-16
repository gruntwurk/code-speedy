import { readFileSync }  from 'fs';
import * as vscode from 'vscode';
import { VariableDefs } from './variables';
import { ActionType, MacroAction } from './actions';

const MACRO_PREFIX = "speedy.";
const MACRO_NAME_PATTERN = /^\[(\w+)\]\s*/;
const ACTION_TYPE_PATTERN = /^(\w+):\s*/;

interface MacroDict {
    [name: string]: MacroDef;
}
interface OptionsDict {
    [name: string]: any;
}

export class MacroDef {
    parent: SpeedyMacros;
    name: string;
    actions: MacroAction[] = [];
    disposable: vscode.Disposable | null = null;
    varDefs = new VariableDefs();
    registered: boolean = false;
    options: OptionsDict = {"verbose": false};

    constructor(parent: SpeedyMacros, name: string) {
        this.parent = parent;
        this.name = name;
    }
    register() {
        if (!this.registered) {
            console.log(`Registering ${MACRO_PREFIX}${this.name}`);
            this.disposable = vscode.commands.registerTextEditorCommand(`${MACRO_PREFIX}${this.name}`, () => this.execute());
            this.parent.context?.subscriptions.push(this.disposable);
            this.registered = true;
        }
    }
    unload() {
        this.disposable?.dispose;
        this.registered = false;
    }
    async execute() {
        for (let action of this.actions) {
            await action.execute();
        }
    }
    addAction(action: MacroAction){
        this.actions.push(action);
    }
}

export class SpeedyMacros  {
    disposables: vscode.Disposable[] = [];
    context: vscode.ExtensionContext | undefined;
    macroDefs: MacroDict = {};

    constructor(context: vscode.ExtensionContext | undefined) {
        this.context = context;
    }

    readSpeedyFile(filename: string): string[] {
        console.log(`Loading macros from ${filename}`);
        //TODO does file exist?
        let text = readFileSync(filename, 'utf8');
        return this.parseMacroDefinitions(text);
    }
    parseMacroDefinitions(text: string): string[] {
        let issues: string[] = [];
        let currentMacro: MacroDef | undefined = undefined;
        let currentAction: MacroAction | undefined = undefined;
        let actionNumber = 0;
        let textLines = text.split("\n");
        console.log(`Loading ${textLines.length} lines worth of macros.`);
        for (let line of textLines) {
            // We need to preserve the formatting of snippet steps.
            // For everything else, we can drop blank lines and comments
            // (But we can't unindent yet.)
            if (!(currentAction?.actionType === ActionType.snippet)) {
                let previewLine = line.trim();
                if (previewLine.length === 0 || previewLine.startsWith("//")) {
                    continue;
                }
            }

            let m = line.match(MACRO_NAME_PATTERN);
            if (m) {
                currentMacro = new MacroDef(this,m[1]);
                console.log(`Loading ${currentMacro.name} macro.`);
                currentAction = undefined;
                this.macroDefs[currentMacro.name] = currentMacro;
                continue;
            }

            if (currentMacro === undefined) {
                issues.push(`Warning: Skipping invalid text above first macro definition.`);
                continue;
            }

            m = line.match(ACTION_TYPE_PATTERN);
            if (m) {
                let newAction = new MacroAction(currentMacro, ++actionNumber, m[1]);
                if (newAction.actionType === undefined) {
                    issues.push(`Error: Invalid action type: "${line}"`);
                    currentAction = undefined;
                } else {
                    currentAction = newAction;
                    currentMacro.addAction(currentAction);
                }
                continue;
            }

            if (currentAction === undefined) {
                issues.push(`Warning: Skipping invalid text between macro name and first action definition.`);
                continue;
            }
            if (!(currentAction?.actionType === ActionType.snippet)) {
                line = line.trim();
            }
            currentAction.steps.push(line);
        }
        return issues;
    }

    registerAll() {
        for (let macroName in this.macroDefs) {
            this.macroDefs[macroName].register();
        }
    }
    unloadAll() {
        for (let macroName in this.macroDefs) {
            this.macroDefs[macroName].unload();
        }
    }
    getNames(): string[] {
        return Object.keys(this.macroDefs);
    }
    getMacro(macroName: string): MacroDef {
        return this.macroDefs[macroName];
    }
}