/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { homogenizeMacroDef, extractCommand, ActionCommandType, runJS, runCommand, runSnippet, runShellScript } from './actions';

import { VariableDefs } from './variables';
import { window } from "vscode";
import path = require("path");

let activeContext: vscode.ExtensionContext;
let disposables: vscode.Disposable[] = [];
let macros: vscode.WorkspaceConfiguration;
let nonMacroAttributes = ["has", "get", "update", "inspect"];

export function activate(context: vscode.ExtensionContext) {
	loadcommands();
	loadMacros(context);
	activeContext = context;

	vscode.workspace.onDidChangeConfiguration(() => {
		for (let disposable of disposables) {
			disposable.dispose();
		}
		loadMacros(activeContext);
	});

}

export function deactivate() { }

function loadcommands() {

	// create a command for running macros by name
	console.log("Registering macro.run");
	vscode.commands.registerCommand("macros.run", async () => {
		let macroNames = Object.keys(macros).filter(each => macros[each] instanceof Array);
		let selection = await window.showQuickPick(macroNames);
		if (selection) {
			executeMacro(selection);
		}
	});

	// command that helps with creating new macros
	console.log("Registering macro.list-builtin-commands");
	vscode.commands.registerCommand("macros.list-builtin-commands", async () => {
		let commands = await vscode.commands.getCommands();
		let selection = await window.showQuickPick(commands);
		if (selection) {
			await vscode.commands.executeCommand(selection);
		}
	});

	// create a dummy command that works out of the box
	console.log("Registering macro.dummy");
	vscode.commands.registerCommand("macros.dummy", async () => {
		window.showInformationMessage(`Congratulations you ran the dummy command`);
	});
}
function loadMacros(context: vscode.ExtensionContext) {
	macros = vscode.workspace.getConfiguration("macros");

	// Register each macro as a command
	for (const name in macros) {
		if (nonMacroAttributes.includes(name)) {
			continue;
		}

		let macroDef = macros[name];
		// console.log(`Macro ${name} is ${typeof macroDef}`);
		if (!((macroDef instanceof Array) || (typeof macroDef === "string"))) {
			console.error(`Macro ${name} is not defined with an array. Skipping.`);
			continue;
		}
		console.log(`Registering macros.${name}`);
		const disposable = vscode.commands.registerTextEditorCommand(`macros.${name}`, () => executeMacro(name));
		context.subscriptions.push(disposable);
		disposables.push(disposable);
	}
}


async function executeMacro(name: string) {
	let varDefs = new VariableDefs();
	let macroDef = macros[name];
	if (!homogenizeMacroDef(macroDef)) {
		console.error(`The ${name} macro is not properly defined as a list of lists of strings.`);
		return;
	}
	let actionNumber = 0;
	for (let action of macroDef) {
		actionNumber++;
		// action is a list of strings (e.g. lines of javascript)
		// The first line must begin with the action type followed by a colon
		let actionType = extractCommand(action);
		if (actionType === undefined) {
			console.error(`Action #${actionNumber} of the ${name} macro does not specify a valid action type. Skipping.`);
			continue;
		}
		let outcome: boolean;
		if (actionType === ActionCommandType.variables) {
			varDefs.addVariables(action);
		} else if (actionType === ActionCommandType.command) {
			outcome = await runCommand(action, varDefs);
		} else if (actionType === ActionCommandType.javascript) {
			outcome = await runJS(action, varDefs);
		} else if (actionType === ActionCommandType.shellscript) {
			outcome = await runShellScript(action, varDefs);
		} else if (actionType === ActionCommandType.snippet) {
			outcome = await runSnippet(action, varDefs);
		} else {
			console.error(`Unimplenented action type encountered: ${actionType}`);
		}
	}
}



