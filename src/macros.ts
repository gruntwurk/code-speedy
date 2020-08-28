import { readFileSync }  from 'fs';
import * as vscode from 'vscode';
import { VariableDefs } from './variables';
import { ActionType, MacroAction } from './actions';
import { Mutex } from './mutex';
import { logError, logInfo, enquote } from './utils';
import { MacroWriterTools } from './tools';

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
    runnerMutex = new Mutex();
    executionQueue: Promise<any>[] = [];
    tools: MacroWriterTools;
    paused: boolean = false;

    constructor(parent: SpeedyMacros, name: string) {
        this.tools = new MacroWriterTools(this);
        this.parent = parent;
        this.name = name;
    }
    pauseMacro() {
        this.paused = true;
        logInfo(`PAUSED here.`);
    }
    register() {
        if (!this.registered) {
            logInfo(`Registering ${MACRO_PREFIX}${this.name}`);
            this.disposable = vscode.commands.registerTextEditorCommand(`${MACRO_PREFIX}${this.name}`, () => this.execute());
            this.parent.context?.subscriptions.push(this.disposable);
            this.registered = true;
        }
    }
    unload() {
        logInfo(`Unloading ${this.name}`);
        if (this.disposable) {
            this.disposable.dispose;
        } else {
            logError(`Can't unload ${this.name} -- no disposable.`);
        }
        this.registered = false;
    }


    execute() {
        for (let action of this.actions) {
            if (!this.paused) {
                action.runner();
            }
        }
    }

    resume(nextAction: number) {
        logInfo(`RESUMING with action #${nextAction}`);
        this.paused = false;
        for (let i = nextAction-1; i < this.actions.length; i++) {
         let action = this.actions[i];
            if (!this.paused) {
                action.runner();
            }
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
        logInfo(`Loading macros from ${filename}`);
        //TODO does file exist?
        let text = readFileSync(filename, 'utf8');
        return this.parseMacroDefinitions(text);
    }

    /**
     * Constructs a new MacroDef, or reuses an existing one if there already is one by that name.
     */
    newOrUsedMacroDef(macroName: string): MacroDef {
        let mdef = this.macroDefs[macroName];
        if (mdef) {
            logInfo(`Reloading ${mdef.name} macro.`);
            mdef.actions = [];
        } else {
            mdef = new MacroDef(this, macroName);
            this.macroDefs[mdef.name] = mdef;
            logInfo(`Loading ${mdef.name} macro.`);
        }
        return mdef;
    }

    parseMacroDefinitions(text: string): string[] {
        let issues: string[] = [];
        let currentMacro: MacroDef | undefined = undefined;
        let currentAction: MacroAction | undefined = undefined;
        let actionNumber = 0;
        let textLines = text.split("\n");
        logInfo(`Loading ${textLines.length} lines worth of macros.`);
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
                currentMacro = this.newOrUsedMacroDef(m[1]);
                actionNumber = 0;
                currentAction = undefined;
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