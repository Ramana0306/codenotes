const vscode = require('vscode');

let sidebarView;

function activate(context) {
    const NOTES_KEY = 'codeNotesData';
    let activeFile = null;

    /* ---------------- Storage ---------------- */
    function getNotes() {
        return context.globalState.get(NOTES_KEY, {});
    }

    function saveNotes(notes) {
        context.globalState.update(NOTES_KEY, notes);
    }

    function refreshSidebar() {
        if (sidebarView) {
            sidebarView.webview.postMessage({
                command: 'render',
                notes: getNotes(),
                activeFile
            });
        }
    }

    /* -------- Track active editor -------- */
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeFile = editor?.document.uri.fsPath || null;
        refreshSidebar();
    });

    /* -------- Add Note (Alt + N) -------- */
    context.subscriptions.push(
        vscode.commands.registerCommand('codeNotes.addNote', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const file = editor.document.uri.fsPath;
            const line = editor.selection.active.line;

            const note = await vscode.window.showInputBox({
                prompt: 'Enter note for this line'
            });
            if (!note) return;

            const notes = getNotes();
            if (!notes[file]) notes[file] = [];
            notes[file].push({ line, note });

            saveNotes(notes);
            refreshSidebar();
        })
    );

    /* -------- Sidebar Webview -------- */
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'codeNotes.sidebar',
            {
                resolveWebviewView(view) {
                    sidebarView = view;

                    view.webview.options = {
                        enableScripts: true,
                        retainContextWhenHidden: true
                    };

                    view.webview.html = getHtml();
                    refreshSidebar();

                    view.onDidChangeVisibility(() => {
                        if (view.visible) refreshSidebar();
                    });

                    view.webview.onDidReceiveMessage(msg => {
                        const notes = getNotes();

                        /* 🔵 Navigate + BLUE highlight */
                        if (msg.command === 'jump') {
                            vscode.workspace.openTextDocument(msg.file).then(doc => {
                                vscode.window.showTextDocument(doc).then(editor => {
                                    const line = msg.line;
                                    const textLine = editor.document.lineAt(line);

                                    const range = new vscode.Range(
                                        new vscode.Position(line, 0),
                                        new vscode.Position(line, textLine.text.length)
                                    );

                                    // Blue selection
                                    editor.selection = new vscode.Selection(
                                        range.start,
                                        range.end
                                    );

                                    editor.revealRange(
                                        range,
                                        vscode.TextEditorRevealType.InCenter
                                    );
                                });
                            });
                        }

                        /* Delete note */
                        if (msg.command === 'delete') {
                            notes[msg.file] =
                                (notes[msg.file] || []).filter(n => n.line !== msg.line);
                            saveNotes(notes);
                            refreshSidebar();
                        }
                    });
                }
            }
        )
    );

    /* -------- Hover Provider -------- */
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('*', {
            provideHover(document, position) {
                const notes = getNotes()[document.uri.fsPath];
                if (!notes) return;

                const found = notes.find(n => n.line === position.line);
                if (!found) return;

                return new vscode.Hover(`📝 **Note:** ${found.note}`);
            }
        })
    );
}

function getHtml() {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<link href="https://cdn.jsdelivr.net/npm/@vscode/codicons/dist/codicon.css" rel="stylesheet" />
<style>
body {
  font-family: var(--vscode-font-family);
  padding: 6px;
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 4px 6px;
  margin-bottom: 8px;
  background: var(--vscode-input-background);
}
.search-box:focus-within {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}
.search-box i {
  margin-right: 6px;
  color: var(--vscode-input-placeholderForeground);
}
.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--vscode-input-foreground);
}

/* Notes */
.note-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 6px;
}
.note-row:hover {
  background: var(--vscode-list-hoverBackground);
}

.note-main {
  cursor: pointer;
  flex: 1;
}

.line-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  margin-right: 6px;
}

.note-actions i {
  cursor: pointer;
  color: var(--vscode-icon-foreground);
  opacity: 0.6;
}
.note-actions i:hover {
  opacity: 1;
  color: var(--vscode-errorForeground);
}
</style>
</head>
<body>

<h3>Code Notes</h3>

<div class="search-box">
  <i class="codicon codicon-search"></i>
  <input id="search" placeholder="Search notes..." />
</div>

<div id="notes"></div>

<script>
const vscode = acquireVsCodeApi();
let allNotes = {};
let activeFile = null;

document.getElementById('search').addEventListener('input', e => {
  render(e.target.value.toLowerCase());
});

window.addEventListener('message', e => {
  if (e.data.command === 'render') {
    allNotes = e.data.notes || {};
    activeFile = e.data.activeFile;
    render('');
  }
});

function render(filter) {
  const root = document.getElementById('notes');
  root.innerHTML = '';

  if (!activeFile || !allNotes[activeFile]) {
    root.innerHTML = '<small>No notes for this file</small>';
    return;
  }

  allNotes[activeFile]
    .filter(n => n.note.toLowerCase().includes(filter))
    .forEach(n => {
      const row = document.createElement('div');
      row.className = 'note-row';

      row.innerHTML = \`
        <div class="note-main">
          <span class="line-badge">Line \${n.line + 1}</span>
          \${n.note}
        </div>
        <div class="note-actions">
          <i class="codicon codicon-trash"></i>
        </div>
      \`;

      row.querySelector('.note-main').onclick = () => {
        vscode.postMessage({
          command: 'jump',
          file: activeFile,
          line: n.line
        });
      };

      row.querySelector('.codicon-trash').onclick = e => {
        e.stopPropagation();
        vscode.postMessage({
          command: 'delete',
          file: activeFile,
          line: n.line
        });
      };

      root.appendChild(row);
    });
}
</script>

</body>
</html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
