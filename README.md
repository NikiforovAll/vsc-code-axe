# code-cutter

This extension provides right-click context menu commands to sync and check namespaces of C# files based on their folder structure. The functionality is similar to Visual Studio's "Sync Namespace" command.

## Features

- **Sync Namespaces**: Automatically updates namespaces in C# files to match the folder structure.
- **Check Namespaces**: Verifies if namespaces in C# files match the folder structure without making changes.

## Usage

1. Right-click on a folder in the VS Code Explorer.
2. Choose either "Sync Namespaces: Sync" or "Sync Namespaces: Check" from the context menu.

The extension will process all C# files in the selected folder and its subfolders.

## Configuration

You can configure the extension using the following setting:

- `code-cutter.solutionOrProjectRelativePath`: Specify the relative path to your solution or project file. Supports both './folder' and 'folder' formats.

## How it works

The extension uses the `dotnet format` tool with the IDE0130 diagnostic to analyze and update namespaces. It runs a command similar to:


```bash
dotnet format --diagnostics IDE0130 ---severity info --include "./path-to-folder"
```

## Known issues

> [!WARNING]
> Current implementation is limited due to well-known issue in `dotnet format` tool. It simplify replaces the namespace, so your code might not compile after running the command. You should review the changes and fix the issues manually.

The "Sync Namespaces: Sync" command doesn't work because of https://github.com/dotnet/format/issues/1623.

## References

* <https://github.com/dotnet/sdk/tree/main/src/BuiltInTools/dotnet-format>
* <https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/style-rules/ide0130>
* <https://github.com/MicrosoftDocs/visualstudio-docs/blob/main/docs/ide/reference/sync-namespace-and-folder-name.md>
* <https://www.stevefenton.co.uk/blog/2022/01/automatically-fix-your-namespaces/>