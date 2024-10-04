import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Functie om de extensie te activeren
export function activate(context: vscode.ExtensionContext) {
    console.log('AutoVenv extensie is geactiveerd');

    // Registreer de commando's
    let createVenvDisposable = vscode.commands.registerCommand('autovenv.createVenv', createVirtualEnvironment);
    let activateVenvDisposable = vscode.commands.registerCommand('autovenv.activateVenv', activateVirtualEnvironment);
    let checkImportsDisposable = vscode.commands.registerCommand('autovenv.checkImports', () => {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
            checkAndInstallImports(workspaceFolder);
        }
    });

    context.subscriptions.push(createVenvDisposable, activateVenvDisposable, checkImportsDisposable);

    // Automatisch aanmaken en activeren van de virtuele omgeving bij het openen van een project
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        createVirtualEnvironment(workspaceFolder);
        activateVirtualEnvironment(workspaceFolder);
        checkAndInstallImports(workspaceFolder);
    }
}

// Functie om een virtuele omgeving aan te maken
function createVirtualEnvironment(workspaceFolder: string) {
    const venvPath = path.join(workspaceFolder, '.venv');
    
    if (!fs.existsSync(venvPath)) {
        try {
            child_process.execSync(`python -m venv ${venvPath}`, { cwd: workspaceFolder });
            vscode.window.showInformationMessage('Virtuele omgeving aangemaakt in .venv');
        } catch (error) {
            vscode.window.showErrorMessage('Fout bij het aanmaken van de virtuele omgeving');
        }
    }
}

// Functie om de virtuele omgeving te activeren
function activateVirtualEnvironment(workspaceFolder: string) {
    const venvPath = path.join(workspaceFolder, '.venv');
    const activateScript = process.platform === 'win32' 
        ? path.join(venvPath, 'Scripts', 'activate.bat')
        : path.join(venvPath, 'bin', 'activate');

    if (fs.existsSync(activateScript)) {
        // Voeg de virtuele omgeving toe aan het Python pad
        const pythonPath = process.platform === 'win32'
            ? path.join(venvPath, 'Scripts', 'python.exe')
            : path.join(venvPath, 'bin', 'python');

        vscode.workspace.getConfiguration('python').update('pythonPath', pythonPath, vscode.ConfigurationTarget.Workspace);

        // Activeer de virtuele omgeving in de geïntegreerde terminal
        const terminal = vscode.window.createTerminal('AutoVenv');
        terminal.sendText(process.platform === 'win32' ? activateScript : `source ${activateScript}`);
        terminal.show();

        vscode.window.showInformationMessage('Virtuele omgeving geactiveerd');
    } else {
        vscode.window.showErrorMessage('Virtuele omgeving niet gevonden');
    }
}

// Functie om de extensie te deactiveren
export function deactivate() {}

// Nieuwe functie om imports te controleren en installeren
async function checkAndInstallImports(workspaceFolder: string) {
    const pythonFiles = await vscode.workspace.findFiles('**/*.py');
    const imports = new Set<string>();

    for (const file of pythonFiles) {
        const content = await vscode.workspace.fs.readFile(file);
        const lines = content.toString().split('\n');
        for (const line of lines) {
            if (line.startsWith('import ') || line.startsWith('from ')) {
                const match = line.match(/^(?:from|import)\s+(\S+)/);
                if (match) {
                    imports.add(match[1].split('.')[0]);
                }
            }
        }
    }

    const venvPath = path.join(workspaceFolder, '.venv');
    const pipPath = process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'pip.exe')
        : path.join(venvPath, 'bin', 'pip');

    for (const importName of Array.from(imports)) {
        try {
            child_process.execSync(`${pipPath} show ${importName}`, { stdio: 'ignore' });
        } catch (error) {
            try {
                child_process.execSync(`${pipPath} install ${importName}`, { cwd: workspaceFolder });
                vscode.window.showInformationMessage(`Geïnstalleerd: ${importName}`);
            } catch (installError) {
                vscode.window.showErrorMessage(`Fout bij installeren van ${importName}`);
            }
        }
    }
}
