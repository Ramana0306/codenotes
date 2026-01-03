const vscode = require('vscode');

function activate(context) {
  console.log('CodeNotes extension activated');

  // ADD NOTE COMMAND
  const addNoteCommand = vscode.commands.registerCommand(
    'codenotes.addNote',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const line = editor.selection.active.line;
      const filePath = editor.document.uri.fsPath;

      const note = await vscode.window.showInputBox({
        prompt: 'Enter note for this line'
      });

      if (!note) return;

      const notes = context.workspaceState.get('notes', {});
      if (!notes[filePath]) notes[filePath] = {};
      notes[filePath][line] = note;

      context.workspaceState.update('notes', notes);

      vscode.window.showInformationMessage('Note saved ✔');
    }
  );

  // HOVER PROVIDER
  const hoverProvider = vscode.languages.registerHoverProvider('*', {
    provideHover(document, position) {
      const notes = context.workspaceState.get('notes', {});
      const filePath = document.uri.fsPath;
      const line = position.line;

      if (notes[filePath] && notes[filePath][line]) {
        return new vscode.Hover(`📝 ${notes[filePath][line]}`);
      }
    }
  });

  context.subscriptions.push(addNoteCommand, hoverProvider);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
