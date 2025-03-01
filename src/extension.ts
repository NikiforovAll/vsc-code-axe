import * as vscode from "vscode";
import { ExpanderManager } from "./ExpandManager";
import { SorterManager } from "./SorterManager";

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("Code Axe");
    var exp = new ExpanderManager(outputChannel);
    var srt = new SorterManager(outputChannel);

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

    const sortDescendantMethodsUnderCursor = vscode.commands.registerCommand(
        "code-axe.sortDescendantMethodsUnderCursor",
        (uri: vscode.Uri) => {
            if (!exp) {
                srt = new SorterManager(outputChannel);
            }
            srt.sortDescendantMethodsUnderCursor();
        }
    );

    context.subscriptions.push(
        expandMethod,
        copyMethod,
        cutMethod,
        sortDescendantMethodsUnderCursor
    );
}

export function deactivate() {}
