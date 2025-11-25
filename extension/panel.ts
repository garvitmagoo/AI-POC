import * as vscode from "vscode";
import { analyzeCode } from "./shared/analyzer";

export class A11yPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "a11yPanel";
  private view?: vscode.WebviewView;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    vscode.window.showInformationMessage(
      "A11y panel resolved (Extension Host)"
    );
    console.log("A11yPanelProvider.resolveWebviewView called (Extension Host)");
    this.view = webviewView;
    this.view.webview.options = { enableScripts: true };

    this.view.webview.onDidReceiveMessage(
      (msg) => {
        if (msg.command === "jump" && typeof msg.line === "number") {
          this.jumpToLine(msg.line);
        }
      },
      null,
      this.disposables
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (
          vscode.window.activeTextEditor &&
          e.document === vscode.window.activeTextEditor.document
        ) {
          this.refresh();
        }
      })
    );

    this.updateHTML([]);
    this.refresh();
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  public async refresh() {
    if (!this.view) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.updateHTML([]);
      return;
    }

    const code = editor.document.getText();
    const issues = analyzeCode(code);
    const formatted = issues.map((i) => ({
      rule: i.id,
      message: i.message,
      line: i.start.line + 1,
    }));

    this.updateHTML(formatted);
  }

  private jumpToLine(line: number) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const pos = new vscode.Position(Math.max(0, line - 1), 0);
    editor.revealRange(
      new vscode.Range(pos, pos),
      vscode.TextEditorRevealType.InCenter
    );
    editor.selection = new vscode.Selection(pos, pos);
  }

  private updateHTML(items: { rule: string; message: string; line: number }[]) {
    if (!this.view) return;
    const rows =
      items.length === 0
        ? `<div class="empty">No accessibility issues found 🎉</div>`
        : items
            .map(
              (it) => `<div class="issue" data-line="${it.line}">
                      <b>${escapeHtml(it.rule)}</b>: ${escapeHtml(it.message)}
                      <span class="line">[Line ${it.line}]</span>
                    </div>`
            )
            .join("");

    this.view.webview.html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline';" />
    <style>
      body { font-family: sans-serif; padding: 8px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      .issue { padding: 8px 6px; border-bottom: 1px solid rgba(128,128,128,0.12); cursor: pointer; }
      .issue:hover { background: rgba(128,128,128,0.06); }
      .line { color: var(--vscode-editorLineNumber-foreground); float: right; }
      .empty { color: var(--vscode-descriptionForeground); padding: 1rem; text-align:center; }
    </style>
  </head>
  <body>
    ${rows}
    <script>
      const vscode = acquireVsCodeApi();
      document.querySelectorAll('.issue').forEach(el=>{
        el.addEventListener('click', ()=> {
          const line = parseInt(el.getAttribute('data-line'), 10);
          vscode.postMessage({ command: 'jump', line });
        });
      });
    </script>
  </body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (ch) => map[ch] ?? "");
}
