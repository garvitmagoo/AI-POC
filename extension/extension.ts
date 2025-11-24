import * as vscode from "vscode";
import { analyzeCode } from "./shared/analyzer";
import type { Issue } from "./shared/analyzer/types";
import { A11yPanelProvider } from "./panel";

export function activate(context: vscode.ExtensionContext) {
  console.log("A11y extension activate() called - PID:", process.pid);

  context.subscriptions.push(
    vscode.commands.registerCommand("a11y.activate", () => {
      vscode.window.showInformationMessage("A11y Extension Activated!");
    })
  );

  const diagnosticCollection = vscode.languages.createDiagnosticCollection("a11y");
  context.subscriptions.push(diagnosticCollection);

  try {
    if (vscode.window.activeTextEditor) {
      runAnalysis(vscode.window.activeTextEditor.document, diagnosticCollection);
    }
  } catch (err) {
    console.error("runAnalysis initial call failed:", err);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => runAnalysis(doc, diagnosticCollection))
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(evt => runAnalysis(evt.document, diagnosticCollection))
  );

  const selector: vscode.DocumentSelector = [
    { scheme: "file", language: "javascriptreact" },
    { scheme: "file", language: "typescriptreact" }
  ];

  try {
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(selector, new A11yQuickFixProvider(), {
        providedCodeActionKinds: A11yQuickFixProvider.providedCodeActionKinds
      })
    );
    console.log("CodeActionsProvider registered");
  } catch (err) {
    console.error("Failed to register CodeActionsProvider:", err);
  }

  // inside activate() (near other context.subscriptions.push(...) for commands)
context.subscriptions.push(
  vscode.commands.registerCommand("a11y.fixAll", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Open a file to apply A11y fixes.");
      return;
    }

    const doc = editor.document;
    if (!["javascriptreact", "typescriptreact"].includes(doc.languageId)) {
      vscode.window.showInformationMessage("A11y Fix All works only on JSX/TSX files.");
      return;
    }

    try {
      const issues = analyzeCode(doc.getText());
      const fileIssues = issues.filter(i => Array.isArray(i.fix?.edits) && i.fix.edits.length > 0);

      if (fileIssues.length === 0) {
        vscode.window.showInformationMessage("No auto-fixable accessibility issues found.");
        return;
      }

      // Confirmation (list up to first 5 rules)
      const sample = Array.from(new Set(fileIssues.map(i => i.id))).slice(0, 5).join(", ");
      const confirm = await vscode.window.showWarningMessage(
        `Apply ${fileIssues.length} accessibility fixes in this file? Rules: ${sample}${fileIssues.length > 5 ? ", ..." : ""}`,
        { modal: true },
        "Apply"
      );
      if (confirm !== "Apply") return;

      const edit = buildWorkspaceEditForIssues(doc, fileIssues);
      const ok = await vscode.workspace.applyEdit(edit);
      if (ok) {
        // optionally save the file
        // await doc.save();
        vscode.window.showInformationMessage(`Applied ${fileIssues.length} accessibility fixes.`);
        // refresh diagnostics after edits
        // if you have a diagnosticCollection in scope you can re-run runAnalysis here.
      } else {
        vscode.window.showErrorMessage("Failed to apply some or all edits.");
      }
    } catch (err) {
      console.error("Fix All failed:", err);
      vscode.window.showErrorMessage("A11y Fix All failed. See console for details.");
    }
  })
);


  let panelProvider: A11yPanelProvider | undefined;
  try {
    panelProvider = new A11yPanelProvider(context);
    console.log("Created panelProvider instance");
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(A11yPanelProvider.viewType, panelProvider)
    );
    console.log("registerWebviewViewProvider called for viewType:", A11yPanelProvider.viewType);
  } catch (err) {
    console.error("Failed to register WebviewViewProvider:", err);
  }

  

  context.subscriptions.push(
    vscode.commands.registerCommand("a11y.showPanel", async () => {
      try {
        console.log("a11y.showPanel invoked - trying to open A11y container");
        await vscode.commands.executeCommand("workbench.view.extension.a11yView");
        try {
          await vscode.commands.executeCommand("workbench.action.openView", "a11yPanel");
          console.log("workbench.action.openView called for view id: a11yPanel");
        } catch (errOpen) {
          console.warn("workbench.action.openView failed:", errOpen);
        }
        await new Promise(r => setTimeout(r, 150));
        try {
          if (typeof (panelProvider as any)?.refresh === "function") {
            (panelProvider as any).refresh();
            console.log("panelProvider.refresh() called");
          } else {
            console.log("panelProvider.refresh() not available at showPanel time");
          }
        } catch (errRefresh) {
          console.error("panelProvider.refresh() threw:", errRefresh);
        }
      } catch (err) {
        console.error("a11y.showPanel command failed:", err);
      }
    })
  );

  setTimeout(() => {
    try {
      (panelProvider as any)?.refresh?.();
      console.log("Proactive panelProvider.refresh() attempted");
    } catch (err) {
      console.warn("Proactive refresh failed:", err);
    }
  }, 600);
}

export function deactivate() {}

function buildWorkspaceEditForIssues(doc: vscode.TextDocument, issues: Issue[]): vscode.WorkspaceEdit {
  const ws = new vscode.WorkspaceEdit();

  // Flatten to edits with absolute start positions and sort descending by start (line, col)
  const flattened: Array<{ startLine: number; startCol: number; endLine: number; endCol: number; newText: string }> = [];

  for (const issue of issues) {
    for (const e of (issue.fix?.edits || [])) {
      const sLine = Math.max(0, Math.min(e.start.line, doc.lineCount - 1));
      const eLine = Math.max(0, Math.min(e.end.line, doc.lineCount - 1));
      const sCol = Math.max(0, e.start.column);
      const eCol = Math.max(0, e.end.column);
      flattened.push({ startLine: sLine, startCol: sCol, endLine: eLine, endCol: eCol, newText: e.newText });
    }
  }

  // Sort by start position descending (line desc, col desc)
  flattened.sort((a, b) => {
    if (a.startLine !== b.startLine) return b.startLine - a.startLine;
    return b.startCol - a.startCol;
  });

  // Apply each edit
  for (const e of flattened) {
    const start = new vscode.Position(e.startLine, e.startCol);
    const end = new vscode.Position(e.endLine, e.endCol);
    const range = new vscode.Range(start, end);
    ws.replace(doc.uri, range, e.newText);
  }

  return ws;
}


function runAnalysis(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
  try {
    if (!["javascriptreact", "typescriptreact"].includes(doc.languageId)) return;

    const code = doc.getText();
    const issues: Issue[] = analyzeCode(code);

    const diagnostics: vscode.Diagnostic[] = issues.map(issue => {
      const maxLine = Math.max(0, Math.min(issue.end.line, doc.lineCount - 1));
      const startPos = new vscode.Position(Math.max(0, issue.start.line), Math.max(0, issue.start.column));
      const endPos = new vscode.Position(maxLine, Math.max(0, issue.end.column));
      const range = new vscode.Range(startPos, endPos);

      const diag = new vscode.Diagnostic(range, issue.message, vscode.DiagnosticSeverity.Warning);
      diag.code = issue.id;
      diag.source = "a11y-poc";
      return diag;
    });

    collection.set(doc.uri, diagnostics);
  } catch (err) {
    console.error("A11y analysis failed:", err);
    collection.set(doc.uri, []);
  }
}

class A11yQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] | undefined {
    try {
      const issues = analyzeCode(document.getText());
      const actions: vscode.CodeAction[] = [];

      for (const diagnostic of context.diagnostics) {
        const issueId = String(diagnostic.code);
        const issue = issues.find(i => i.id === issueId);
        if (!issue || !issue.fix || !Array.isArray(issue.fix.edits) || issue.fix.edits.length === 0) continue;

        const action = this.buildCodeActionForIssue(issue, diagnostic, document);
        if (action) actions.push(action);
      }

      return actions.length ? actions : undefined;
    } catch (err) {
      console.error("provideCodeActions failed:", err);
      return undefined;
    }
  }

  private buildCodeActionForIssue(issue: Issue, diagnostic: vscode.Diagnostic, document: vscode.TextDocument): vscode.CodeAction | undefined {
    try {
      const action = new vscode.CodeAction(issue.fix!.title || `Fix: ${issue.id}`, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diagnostic];
      const wsEdit = new vscode.WorkspaceEdit();

      for (const e of issue.fix!.edits) {
        const startLine = Math.max(0, Math.min(e.start.line, document.lineCount - 1));
        const endLine = Math.max(0, Math.min(e.end.line, document.lineCount - 1));
        const startChar = Math.max(0, e.start.column);
        const endChar = Math.max(0, e.end.column);

        const start = new vscode.Position(startLine, startChar);
        const end = new vscode.Position(endLine, endChar);
        const range = new vscode.Range(start, end);

        wsEdit.replace(document.uri, range, e.newText);
      }

      action.edit = wsEdit;
      action.isPreferred = true;
      return action;
    } catch (err) {
      console.error("Failed to build quick-fix for issue", issue.id, err);
      return undefined;
    }
  }
}
