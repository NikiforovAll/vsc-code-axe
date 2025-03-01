import * as vscode from "vscode";
export class SorterManager {
    outputChannel: vscode.OutputChannel;
    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    async sortDescendantMethodsUnderCursor() {
        const functionSymbol = await this.findFuncUnderCursor();
        if (!functionSymbol) {
            this.outputChannel.appendLine("No function found under cursor");
            return;
        }

        this.outputChannel.appendLine(`Found function: ${functionSymbol.name}`);

        // Get the current document
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;

        // Find all methods in the document
        const allSymbols = await vscode.commands.executeCommand<
            vscode.DocumentSymbol[]
        >("vscode.executeDocumentSymbolProvider", document.uri);

        if (!allSymbols || allSymbols.length === 0) {
            this.outputChannel.appendLine("No symbols found in the document");
            return;
        }

        // Get all methods/functions in the document
        const methods = this.getAllMethods(allSymbols);

        // Build dependency graph
        const dependencyGraph = await this.buildMethodDependencyGraph(
            document,
            methods
        );

        // Perform topological sort starting from the function under cursor
        const sortedMethods = this.topologicalSort(
            functionSymbol,
            dependencyGraph,
            methods
        );

        // Log the recommended order
        this.outputChannel.appendLine(
            "\nRecommended method order based on dependencies:"
        );
        for (const method of sortedMethods) {
            this.outputChannel.appendLine(`- ${method.name}`);
        }
        if (sortedMethods.length > 1) {
            await this.reorderMethods(document, sortedMethods);
        }
    }

    private async findFuncUnderCursor() {
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
                return functionSymbol;
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
                        symbol.kind === vscode.SymbolKind.Method) &&
                    symbol.name !== ".ctor"
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

    private getAllMethods(
        symbols: vscode.DocumentSymbol[]
    ): vscode.DocumentSymbol[] {
        const methods: vscode.DocumentSymbol[] = [];

        const traverse = (symbols: vscode.DocumentSymbol[]) => {
            for (const symbol of symbols) {
                if (
                    (symbol.kind === vscode.SymbolKind.Function ||
                        symbol.kind === vscode.SymbolKind.Method) &&
                    symbol.name !== ".ctor"
                ) {
                    methods.push(symbol);
                }

                if (symbol.children && symbol.children.length > 0) {
                    traverse(symbol.children);
                }
            }
        };

        traverse(symbols);
        return methods;
    }

    private async buildMethodDependencyGraph(
        document: vscode.TextDocument,
        methods: vscode.DocumentSymbol[]
    ): Promise<Map<string, string[]>> {
        const graph = new Map<string, string[]>();

        for (const method of methods) {
            const methodName = method.name;
            graph.set(methodName, []);

            // Get the method text
            const methodText = document.getText(method.range);

            // Find method calls in the current method
            for (const calledMethod of methods) {
                if (calledMethod.name !== methodName) {
                    // Check if this method calls the other method
                    // This is a simple check that looks for method name followed by (
                    const regex = new RegExp(
                        `\\b${this.escapeRegExp(calledMethod.name)}\\s*\\(`,
                        "g"
                    );
                    if (regex.test(methodText)) {
                        const dependencies = graph.get(methodName) || [];
                        dependencies.push(calledMethod.name);
                        graph.set(methodName, dependencies);
                    }
                }
            }
        }

        return graph;
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private topologicalSort(
        startMethod: vscode.DocumentSymbol,
        dependencyGraph: Map<string, string[]>,
        allMethods: vscode.DocumentSymbol[]
    ): vscode.DocumentSymbol[] {
        const visited = new Set<string>();
        const sortedMethods: vscode.DocumentSymbol[] = [];

        const visit = (method: vscode.DocumentSymbol) => {
            const methodName = method.name;
            if (visited.has(methodName)) {
                return;
            }

            sortedMethods.push(method);
            visited.add(methodName);

            const dependencies = dependencyGraph.get(methodName) || [];
            for (const dependencyName of dependencies) {
                const dependencyMethod = allMethods.find(
                    (m) => m.name === dependencyName
                );
                if (dependencyMethod) {
                    visit(dependencyMethod);
                }
            }
        };

        visit(startMethod);

        return sortedMethods;
    }

    private async reorderMethods(
        document: vscode.TextDocument,
        sortedMethods: vscode.DocumentSymbol[]
    ): Promise<void> {
        // Get methods in their original document order
        const methodsInDocumentOrder = [...sortedMethods].sort(
            (a, b) => a.range.start.line - b.range.start.line
        );

        // Create a map for quick lookup of method names to their sorted position
        const sortedPositionMap = new Map<string, number>();
        sortedMethods.forEach((method, index) => {
            sortedPositionMap.set(method.name, index);
        });

        // Create an editor to apply changes
        const editor = await vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // Extract the text of each method and its range
        const methodTexts: { text: string; range: vscode.Range }[] = [];
        for (const method of methodsInDocumentOrder) {
            const methodText = document.getText(method.range);
            methodTexts.push({ text: methodText, range: method.range });
        }

        // Create a sorted list of method texts based on the dependency order
        const sortedMethodTexts = [...methodTexts].sort((a, b) => {
            const aMethod = methodsInDocumentOrder.find((m) =>
                m.range.isEqual(a.range)
            );
            const bMethod = methodsInDocumentOrder.find((m) =>
                m.range.isEqual(b.range)
            );

            if (!aMethod || !bMethod) {
                return 0;
            }

            return (
                sortedPositionMap.get(aMethod.name)! -
                sortedPositionMap.get(bMethod.name)!
            );
        });

        // Apply the edits
        await editor.edit((editBuilder) => {
            // Delete all methods from bottom to top to avoid position shifting
            for (let i = methodTexts.length - 1; i >= 0; i--) {
                editBuilder.delete(methodTexts[i].range);
                // Delete any whitespace lines after the method
                const endLine = methodTexts[i].range.end.line;
                const nextLine = endLine + 1;
                if (nextLine < document.lineCount) {
                    const nextLineText = document.lineAt(nextLine).text;
                    if (nextLineText.trim() === "") {
                        const whitespaceRange = new vscode.Range(
                            new vscode.Position(nextLine, 0),
                            new vscode.Position(nextLine + 1, 0)
                        );
                        editBuilder.delete(whitespaceRange);
                    }
                }
            }

            // Insert all methods in the new order at the position of the first method
            if (methodTexts.length > 0) {
                const firstMethodPosition = methodTexts[0].range.start;
                const newText = sortedMethodTexts.map((m) => m.text).join("\n");
                editBuilder.insert(firstMethodPosition, newText);
            }
        });

        // Format the document after reordering methods
        await vscode.commands.executeCommand("editor.action.formatDocument");
    }
}
