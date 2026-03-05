import * as vscode from 'vscode';
import { TeacherSlateService } from './teacherSlate';
import { LearningProfileService } from './learning/learningProfile';

export class GhostTextProvider implements vscode.InlineCompletionItemProvider {
    public async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[]> {
        try {
            // Check user level - ghost text only for beginners
            const profileService = LearningProfileService.getInstance();
            const profile = profileService.getProfile();
            
            if (profile.level !== 'beginner') {
                // Only beginners get ghost text
                return [];
            }
            
            const slateService = TeacherSlateService.getInstance();
            if (!slateService.isActive()) {
                return [];
            }

            const fullCode = slateService.getLessonCode();
            if (!fullCode) {
                return [];
            }

            // Get the entire document text and the full lesson/suggestion text
            const docText = document.getText();

        // Find where the cursor is in the absolute string
        const cursorOffset = document.offsetAt(position);

        // We want to show the remainder of the fullCode starting from where the user is
        // However, we need to handle if the user is typing "ahead" or in the middle.
        // For DevX, we assume the user is typing sequentially from the start.

        const ghostText = fullCode.substring(cursorOffset);

        if (ghostText) {
            const item = new vscode.InlineCompletionItem(ghostText);

            // The range is just where the ghost text starts (the cursor)
            item.range = new vscode.Range(position, position);

            // filterText is the "secret sauce" to keep it persistent.
            // We set it to the ALREADY typed text + the ghost text.
            // This makes VS Code think the current line is a perfect prefix match.
            const currentLine = document.lineAt(position.line).text;
            item.filterText = currentLine.substring(0, position.character) + ghostText;

            return [item];
        }

        return [];
        } catch (error) {
            // Silently handle errors like DocumentMissingInHistoryContext
            console.error('[DevX] Ghost text provider error:', error);
            return [];
        }
    }
}
