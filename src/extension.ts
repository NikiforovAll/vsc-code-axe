import * as vscode from "vscode";
import { ExpanderManager } from "./ExpandManager";

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("Code Axe");
    var exp = new ExpanderManager(outputChannel);

    const expandMethod = vscode.commands.registerCommand(
        "code-axe.expandMethod",
        async (uri: vscode.Uri) => {
            if (!exp) {
                exp = new ExpanderManager(outputChannel);
            }
            await exp.expandToFunctionUnderCursor();
        }
    );

    const copyMethod = vscode.commands.registerCommand(
        "code-axe.copyMethod",
        (uri: vscode.Uri) => {
            if (!exp) {
                exp = new ExpanderManager(outputChannel);
            }
            exp.copyFunctionUnderCursor();
        }
    );
    const cutMethod = vscode.commands.registerCommand(
        "code-axe.cutMethod",
        (uri: vscode.Uri) => {
            if (!exp) {
                exp = new ExpanderManager(outputChannel);
            }
            exp.cutFunctionUnderCursor();
        }
    );

    context.subscriptions.push(expandMethod, copyMethod, cutMethod);
}

export function deactivate() {}
