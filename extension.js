const vscode = require('vscode');

const NOTES_KEY = 'codenotes.notes';

/**
 * Safely get notes from workspace storage
 */
function getNotes(context) {
  try {
    return context.workspaceState.get(NOTES_KEY, {});
  } catch (err) {
    console.error('Failed to read notes:', err);
    return {};
  }
}

/**
 * Safely save notes to workspace storage
 */
function saveNotes(context, notes) {
  try {
    return context.workspaceState.update(NOTES_KEY, notes);
  } catch (err) {
    console.error('Failed to save notes:', err);
    vscode.window.showErrorMessage('Failed to save note');
  }
}

/**
 * Extension activation
 */
function activate(context) {
  console.log('✅ CodeNotes activated');

  /**
   * ADD / UPDATE NOTE
   */
  const addNoteCommand = vscode.commands.registerCommand(
    'codenotes.addNote',
    async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor found');
          return;
        }

        const document = editor.document;
        const filePath = document.uri.fsPath;
        const line = editor.selection.active.line;

        const note = await vscode.window.showInputBox({
          prompt: 'Enter note for this line',
          placeHolder: 'Example: Refactor later'
        });

        if (!note || !note.trim()) {
          vscode.window.showInformationMessage('Note not saved (empty)');
          return;
        }

        const notes = getNotes(context);

        if (!notes[filePath]) {
          notes[filePath] = {};
        }

        notes[filePath][line] = note.trim();
        await saveNotes(context, notes);

        vscode.window.showInformationMessage(
          `📝 Note saved for line ${line + 1}`
        );
      } catch (err) {
        console.error('Add note error:', err);
        vscode.window.showErrorMessage('Unexpected error while adding note');
      }
    }
  );

  /**
   * VIEW NOTE (KEYBOARD)
   */
  const viewNoteCommand = vscode.commands.registerCommand(
    'codenotes.viewNote',
    () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('No active editor found');
          return;
        }

        const filePath = editor.document.uri.fsPath;
        const line = editor.selection.active.line;

        const notes = getNotes(context);

        const note =
          notes[filePath] && notes[filePath][line];

        if (note) {
          vscode.window.showInformationMessage(`📝 ${note}`);
        } else {
          vscode.window.showInformationMessage(
            'No note for this line'
          );
        }
      } catch (err) {
        console.error('View note error:', err);
        vscode.window.showErrorMessage('Failed to view note');
      }
    }
  );

  /**
   * HOVER PROVIDER
   */
  const hoverProvider = vscode.languages.registerHoverProvider('*', {
    provideHover(document, position) {
      try {
        const filePath = document.uri.fsPath;
        const line = position.line;
        const notes = getNotes(context);

        if (notes[filePath] && notes[filePath][line]) {
          return new vscode.Hover(`📝 ${notes[filePath][line]}`);
        }
      } catch (err) {
        console.error('Hover error:', err);
      }
      return null;
    }
  });

  context.subscriptions.push(
    addNoteCommand,
    viewNoteCommand,
    hoverProvider
  );
}

/**
 * Extension deactivation
 */
function deactivate() {
  console.log('❌ CodeNotes deactivated');
}

module.exports = {
  activate,
  deactivate
};
