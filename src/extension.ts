import * as vscode from "vscode";
import { ExpanderManager } from "./ExpandManager";

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("Code Cutter");
    var exp = new ExpanderManager(outputChannel);

    const expandMethod = vscode.commands.registerCommand(
        "code-cutter.expandMethod",
        async (uri: vscode.Uri) => {
            if (!exp) {
                exp = new ExpanderManager(outputChannel);
            }
            await exp.expandToFunctionUnderCursor();
        }
    );

    const copyMethod = vscode.commands.registerCommand(
        "code-cutter.copyMethod",
        (uri: vscode.Uri) => {}
    );
    const cutMethod = vscode.commands.registerCommand(
        "code-cutter.cutMethod",
        (uri: vscode.Uri) => {}
    );

    context.subscriptions.push(expandMethod, copyMethod, cutMethod);
}

export function deactivate() {}
