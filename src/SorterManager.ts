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
            "Recommended method order based on dependencies:"
        );
        for (const method of sortedMethods) {
            this.outputChannel.appendLine(`- ${method.name}`);
        }
        if (sortedMethods.length > 1) {
            await this.reorderMethods(functionSymbol, document, sortedMethods);
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
            const sortedSymbols = symbols.sort(
                (a, b) => a.range.start.line - b.range.start.line
            );
            for (const symbol of sortedSymbols) {
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

            // Remove comments and strings to avoid false positives
            const cleanedMethodText = methodText
                .replace(/\/\/.*$/gm, "") // Remove single-line comments
                .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
                .replace(/"(?:\\"|[^"])*"/g, "") // Remove double-quoted strings
                .replace(/'(?:\\'|[^'])*'/g, "") // Remove single-quoted strings
                .replace(/`(?:\\`|[^`])*`/g, ""); // Remove template literals

            // Track called methods with their positions
            const calledMethodPositions: {
                method: string;
                position: number;
            }[] = [];

            // Find method calls in the current method
            for (const calledMethod of methods) {
                if (calledMethod.name !== methodName) {
                    const methodPatterns = [
                        // Direct call (not preceded by a dot or other identifier character)
                        new RegExp(
                            `(?<!\\.\\s*)\\b${this.escapeRegExp(
                                calledMethod.name
                            )}\\s*\\(`,
                            "g"
                        ),

                        // Call with this.
                        new RegExp(
                            `this\\.${this.escapeRegExp(
                                calledMethod.name
                            )}\\s*\\(`,
                            "g"
                        ),

                        // Call with super.
                        new RegExp(
                            `super\\.${this.escapeRegExp(
                                calledMethod.name
                            )}\\s*\\(`,
                            "g"
                        ),
                        new RegExp(
                            `base\\.${this.escapeRegExp(
                                calledMethod.name
                            )}\\s*\\(`,
                            "g"
                        ),
                    ];

                    // Find the earliest occurrence of the method call
                    let earliestPosition = Number.MAX_SAFE_INTEGER;
                    let isMethodCalled = false;

                    for (const pattern of methodPatterns) {
                        let match;
                        // Need to reset the RegExp before using it with exec in a loop
                        pattern.lastIndex = 0;

                        while (
                            (match = pattern.exec(cleanedMethodText)) !== null
                        ) {
                            isMethodCalled = true;
                            earliestPosition = Math.min(
                                earliestPosition,
                                match.index
                            );
                        }
                    }

                    if (isMethodCalled) {
                        calledMethodPositions.push({
                            method: calledMethod.name,
                            position: earliestPosition,
                        });
                    }
                }
            }

            // Sort called methods by their position in the text
            calledMethodPositions.sort((a, b) => a.position - b.position);

            // Add dependencies in order of appearance
            const dependencies = calledMethodPositions.map(
                (item) => item.method
            );
            graph.set(methodName, dependencies);
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
        targetMethod: vscode.DocumentSymbol,
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

        // Extract the text of each method and its range, including preceding comments
        const methodTexts: {
            text: string;
            range: vscode.Range;
            rangeWithWhitespaces: vscode.Range;
            textWithWhitespaces: string;
        }[] = [];

        for (const method of methodsInDocumentOrder) {
            const methodText = document.getText(method.range);

            // Find preceding comments for this method
            const commentStartLine = this.findPrecedingCommentStartLine(
                document,
                method.range.start.line
            );

            const rangeWithWhitespaces = new vscode.Range(
                new vscode.Position(commentStartLine, 0),
                new vscode.Position(
                    method.range.end.line,
                    document.lineAt(method.range.end.line).range.end.character
                )
            );
            const methodTextWithWhitespaces =
                document.getText(rangeWithWhitespaces);
            methodTexts.push({
                text: methodText,
                range: method.range,
                rangeWithWhitespaces: rangeWithWhitespaces,
                textWithWhitespaces: methodTextWithWhitespaces,
            });
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
                // Create a range that spans from the start of the first line to the end of the last line including line break
                const startLine =
                    methodTexts[i].rangeWithWhitespaces.start.line;
                const endLine = methodTexts[i].rangeWithWhitespaces.end.line;

                // Create a range from the start of the first line to the end of the last line (including line break)
                const rangeToDelete = new vscode.Range(
                    new vscode.Position(startLine, 0),
                    document.lineAt(endLine).rangeIncludingLineBreak.end
                );

                editBuilder.delete(rangeToDelete);

                // Delete any whitespace lines after the method
                let nextLine = endLine + 1;
                while (nextLine < document.lineCount) {
                    const nextLineText = document.lineAt(nextLine).text;
                    if (nextLineText.trim() !== "") {
                        break;
                    }
                    editBuilder.delete(
                        document.lineAt(nextLine).rangeIncludingLineBreak
                    );
                    nextLine++;
                }
            }

            // Insert all methods in the new order
            if (methodTexts.length > 0) {
                const commentStartLine = this.findPrecedingCommentStartLine(
                    document,
                    targetMethod.range.start.line
                );
                const firstMethodPosition = new vscode.Position(
                    commentStartLine,
                    0
                );
                const newText = sortedMethodTexts
                    .map((m) => m.textWithWhitespaces)
                    .join("\n\n");
                editBuilder.insert(firstMethodPosition, newText.concat("\n\n"));
            }
        });
    }

    /**
     * Find the starting line of comments that precede a method
     * @param document The text document
     * @param methodStartLine The starting line of the method
     * @returns The line where comments start or the method start line if no comments
     */
    private findPrecedingCommentStartLine(
        document: vscode.TextDocument,
        methodStartLine: number
    ): number {
        let currentLine = methodStartLine;
        let foundComment = false;

        // Go backwards from the method start line
        while (currentLine >= 0) {
            const lineText = document.lineAt(currentLine - 1).text.trim();

            // If line starts with a comment
            if (lineText.startsWith("//")) {
                foundComment = true;
                currentLine--;
                continue;
            }

            break;
        }

        return foundComment ? currentLine : methodStartLine;
    }
}
