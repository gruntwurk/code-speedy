/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';

import { window } from "vscode";
import { SpeedyMacros } from './macros';

const MACRO_PREFIX = "speedy.";

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

	// The command for running a macro by name
	console.log(`Registering ${MACRO_PREFIX}run`);
	vscode.commands.registerCommand(`${MACRO_PREFIX}run`, async () => {
		let selection = await window.showQuickPick(macros.getNames());
		if (selection) {
			macros.getMacro(selection).execute();
		}
	});

	// The command for reloading all of the macros
	console.log(`Registering ${MACRO_PREFIX}reload`);
	vscode.commands.registerCommand(`${MACRO_PREFIX}reload`, async () => {
		macros.unloadAll();
		loadMacros();
	});



}


function loadMacros() {
	speedyConfig = vscode.workspace.getConfiguration(`${MACRO_PREFIX}macros`);
	console.log(`Config = ${speedyConfig}`);
	let fileList: string[] = [];
	if (speedyConfig.has("file")) {
		console.log(`file = ${speedyConfig.file}`);
		fileList.push(speedyConfig.file);
	}
	if (speedyConfig.has("files")) {
		for (let file of speedyConfig.files) {
			console.log(`file = ${file}`);
			fileList.push(file);
		}
	}

	for (let filename of fileList) {
		let issues = macros.readSpeedyFile(filename);
		for (let issue of issues) {
			console.error(issue);
		}
		macros.registerAll();
	}
}
