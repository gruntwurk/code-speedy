/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';

import { window } from "vscode";
import { SpeedyMacros } from './macros';

let speedyConfig: vscode.WorkspaceConfiguration;
// let nonMacroAttributes = ["has", "get", "update", "inspect"];
let macros:SpeedyMacros;

export function activate(context: vscode.ExtensionContext) {
	macros = new SpeedyMacros(context);
	loadcommands();
	loadMacros();

	vscode.workspace.onDidChangeConfiguration(() => {
		macros.unloadAll();
		loadMacros();
	});

}

export function deactivate() { }

function loadcommands() {

	// create a command for running macros by name
	console.log("Registering macro.run");
	vscode.commands.registerCommand("macros.run", async () => {
		let selection = await window.showQuickPick(macros.getNames());
		if (selection) {
			macros.getMacro(selection).execute();
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


function loadMacros() {
	speedyConfig = vscode.workspace.getConfiguration("speedy.macros");
	let fileList: string[] = [];
	if (speedyConfig.has("file")) {
		fileList.push(speedyConfig.file);
	}
	if (speedyConfig.has("files")) {
		fileList.push.apply(null,speedyConfig.files);
	}

	for (const filename in fileList) {
		let issues = macros.readSpeedyFile(filename);
		for (let issue of issues) {
			console.error(issue);
		}
		macros.registerAll();
	}
}
