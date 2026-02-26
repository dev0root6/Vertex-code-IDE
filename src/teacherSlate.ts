import * as vscode from 'vscode';

export class TeacherSlateService {
    private static instance: TeacherSlateService;
    private ghostDecorationType: vscode.TextEditorDecorationType;
    private errorDecorationType: vscode.TextEditorDecorationType;
    private feedbackDecorationType: vscode.TextEditorDecorationType;
    private currentLesson: string = '';
    private suggestedCode: string = '';
    private hoverTip: string = '';
    private active: boolean = false;

    private constructor() {
        this.ghostDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'rgba(128, 128, 128, 0.4)',
                margin: '0 0 0 0',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.errorDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid red',
            borderRadius: '2px'
        });

        this.feedbackDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'rgba(128, 128, 128, 0.6)',
                fontStyle: 'italic',
                margin: '0 0 0 2em'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    public static getInstance(): TeacherSlateService {
        if (!TeacherSlateService.instance) {
            TeacherSlateService.instance = new TeacherSlateService();
        }
        return TeacherSlateService.instance;
    }

    public setLesson(code: string) {
        this.currentLesson = code;
        this.active = true;
        this.updateDecorations();
    }

    public deactivate() {
        this.active = false;
        this.currentLesson = '';
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.ghostDecorationType, []);
            editor.setDecorations(this.errorDecorationType, []);
            editor.setDecorations(this.feedbackDecorationType, []);
        }
    }

    public showFeedback(message: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line);

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(position.line, line.text.length, position.line, line.text.length),
            renderOptions: {
                after: {
                    contentText: ` 🧙‍♂️ Sensei: ${message}`
                }
            }
        };

        editor.setDecorations(this.feedbackDecorationType, [decoration]);

        // Auto-clear after 8 seconds
        setTimeout(() => {
            this.clearFeedback();
        }, 8000);
    }

    public clearFeedback() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.feedbackDecorationType, []);
        }
    }

    public updateDecorations() {
        const editor = vscode.window.activeTextEditor;
        const lessonCode = this.getLessonCode();
        if (!editor || !this.isActive() || !lessonCode) {
            return;
        }

        const document = editor.document;
        const text = document.getText();
        const lessonLines = lessonCode.split('\n');
        const docLines = text.split('\n');

        const ghostDecorations: vscode.DecorationOptions[] = [];
        const errorDecorations: vscode.DecorationOptions[] = [];

        lessonLines.forEach((lessonLine, i) => {
            const docLine = docLines[i] || '';

            // 1. Find the match length (correct prefix)
            let matchLength = 0;
            const maxMatch = Math.min(docLine.length, lessonLine.length);
            for (let j = 0; j < maxMatch; j++) {
                if (docLine[j].toLowerCase() === lessonLine[j].toLowerCase()) {
                    matchLength++;
                } else {
                    break;
                }
            }

            // 2. HighLight Errors: from the first mismatch to the end of user's line
            if (matchLength < docLine.length) {
                errorDecorations.push({
                    range: new vscode.Range(i, matchLength, i, docLine.length),
                    hoverMessage: `Expected: "${lessonLine.substring(matchLength, Math.min(matchLength + 5, lessonLine.length))}..."`
                });
            } else if (docLine.length > lessonLine.length) {
                errorDecorations.push({
                    range: new vscode.Range(i, lessonLine.length, i, docLine.length),
                    hoverMessage: "Extra characters detected!"
                });
            }

            // 3. Ghost text is now handled by GhostTextProvider (InlineCompletionItemProvider)
        });

        editor.setDecorations(this.errorDecorationType, errorDecorations);
    }

    public getLessonCode(): string {
        // AI suggestions take priority for ghost text rendering
        return this.suggestedCode || this.currentLesson;
    }

    public setSuggestedCode(code: string) {
        this.suggestedCode = code;
        this.updateDecorations();
    }

    public clearSuggestedCode() {
        this.suggestedCode = '';
        this.updateDecorations();
    }

    public getSuggestedCode(): string {
        return this.suggestedCode;
    }

    public setHoverTip(tip: string) {
        this.hoverTip = tip;
    }

    public getHoverTip(): string {
        return this.hoverTip;
    }

    public isActive(): boolean {
        return this.active || this.suggestedCode.length > 0;
    }
}
