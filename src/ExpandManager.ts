import * as vscode from "vscode";
export class ExpanderManager {
    outputChannel: vscode.OutputChannel;
    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }
    async expandToFunctionUnderCursor() {
        var selection = await this.findFuncSelectionUnderCursor();

        if (selection) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.selection = selection;
                editor.revealRange(selection);
            }
        }
    }

    async copyFunctionUnderCursor() {
        var selection = await this.findFuncSelectionUnderCursor();

        if (selection) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = editor.document.getText(selection);
                vscode.env.clipboard.writeText(text);
            }
        }
    }

    async cutFunctionUnderCursor() {
        var selection = await this.findFuncSelectionUnderCursor();

        if (selection) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const text = editor.document.getText(selection);
                vscode.env.clipboard.writeText(text);
                editor.edit((editBuilder) => {
                    editBuilder.delete(selection!);
                });
            }
        }
    }

    private async findFuncSelectionUnderCursor() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;

        try {
            // Get document symbols
            const symbols = await vscode.commands.executeCommand<
                vscode.DocumentSymbol[]
            >("vscode.executeDocumentSymbolProvider", document.uri);

            if (!symbols || symbols.length === 0) {
                this.outputChannel.appendLine(
                    "No symbols found in the document"
                );
                return;
            }

            // Find the innermost function containing the cursor
            const functionSymbol = this.findFunctionContainingPosition(
                symbols,
                position
            );

            if (functionSymbol) {
                this.outputChannel.appendLine(
                    `Found function: ${functionSymbol.name}`
                );

                // Create a new selection for the entire function
                const selection = new vscode.Selection(
                    functionSymbol.range.start,
                    functionSymbol.range.end
                );
                return selection;
            } else {
                this.outputChannel.appendLine(
                    "No function found containing cursor position"
                );
            }
        } catch (error) {
            this.outputChannel.appendLine(
                `Error expanding to function: ${error}`
            );
        }
    }

    private findFunctionContainingPosition(
        symbols: vscode.DocumentSymbol[],
        position: vscode.Position
    ): vscode.DocumentSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                // Check if this is a function/method
                if (
                    (symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method) && symbol.name !== ".ctor"
                ) {
                    // Check if there's an inner function that contains the position
                    if (symbol.children && symbol.children.length > 0) {
                        const innerFunction =
                            this.findFunctionContainingPosition(
                                symbol.children,
                                position
                            );
                        if (innerFunction) {
                            return innerFunction;
                        }
                    }
                    return symbol;
                }

                // If not a function, check children recursively
                if (symbol.children && symbol.children.length > 0) {
                    const innerSymbol = this.findFunctionContainingPosition(
                        symbol.children,
                        position
                    );
                    if (innerSymbol) {
                        return innerSymbol;
                    }
                }
            }
        }

        return undefined;
    }
}
