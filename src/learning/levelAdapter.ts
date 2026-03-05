import * as vscode from 'vscode';
import { LearningProfileService, LearningLevel } from './learningProfile';

export class LevelAdapter {
    private static instance: LevelAdapter;
    private profileService: LearningProfileService;
    private lastLevelCheckTime: number = 0;
    private readonly CHECK_INTERVAL = 60000; // Check every minute

    private constructor() {
        this.profileService = LearningProfileService.getInstance();
    }

    public static getInstance(): LevelAdapter {
        if (!LevelAdapter.instance) {
            LevelAdapter.instance = new LevelAdapter();
        }
        return LevelAdapter.instance;
    }

    public checkAndAdaptLevel(): void {
        const now = Date.now();
        
        // Don't check too frequently
        if (now - this.lastLevelCheckTime < this.CHECK_INTERVAL) {
            return;
        }

        this.lastLevelCheckTime = now;
        const profile = this.profileService.getProfile();

        if (!profile.autoLevelEnabled) {
            return;
        }

        // Check for level up
        if (this.profileService.shouldLevelUp()) {
            const currentLevel = profile.level;
            const nextLevel = this.getNextLevel(currentLevel);
            
            if (nextLevel) {
                this.suggestLevelUp(currentLevel, nextLevel);
            }
        }

        // Check for level down
        if (this.profileService.shouldLevelDown()) {
            const currentLevel = profile.level;
            const prevLevel = this.getPreviousLevel(currentLevel);
            
            if (prevLevel) {
                this.suggestLevelDown(currentLevel, prevLevel);
            }
        }
    }

    private getNextLevel(current: LearningLevel): LearningLevel | null {
        switch (current) {
            case 'beginner': return 'intermediate';
            case 'intermediate': return 'pro';
            case 'pro': return null;
        }
    }

    private getPreviousLevel(current: LearningLevel): LearningLevel | null {
        switch (current) {
            case 'pro': return 'intermediate';
            case 'intermediate': return 'beginner';
            case 'beginner': return null;
        }
    }

    private async suggestLevelUp(from: LearningLevel, to: LearningLevel) {
        const profile = this.profileService.getProfile();
        const message = this.getLevelUpMessage(from, to, profile.performanceScore);

        const choice = await vscode.window.showInformationMessage(
            message,
            { modal: false },
            `Level Up to ${this.getLevelEmoji(to)} ${to.charAt(0).toUpperCase() + to.slice(1)}`,
            'Stay at Current Level',
            'Disable Auto-Leveling'
        );

        if (choice?.includes('Level Up')) {
            this.profileService.setLevel(to);
            vscode.window.showInformationMessage(
                `🎉 Congratulations! You're now at ${to.charAt(0).toUpperCase() + to.slice(1)} level!`
            );
        } else if (choice?.includes('Disable')) {
            const config = vscode.workspace.getConfiguration('devx');
            await config.update('autoLevelEnabled', false, vscode.ConfigurationTarget.Global);
        }
    }

    private async suggestLevelDown(from: LearningLevel, to: LearningLevel) {
        const message = `You're finding ${from} level challenging. Would you like to switch to ${to} level for better learning experience?`;

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: false },
            `Switch to ${this.getLevelEmoji(to)} ${to.charAt(0).toUpperCase() + to.slice(1)}`,
            'Stay at Current Level'
        );

        if (choice?.includes('Switch')) {
            this.profileService.setLevel(to);
            vscode.window.showInformationMessage(
                `Switched to ${to.charAt(0).toUpperCase() + to.slice(1)} level`
            );
        }
    }

    private getLevelUpMessage(from: LearningLevel, to: LearningLevel, score: number): string {
        const messages = {
            'beginner->intermediate': `🌟 You're making great progress! (Score: ${score}/100)\n\n` +
                `Ready for Intermediate level?\n` +
                `• Ghost text will show comments only\n` +
                `• More focus on logic than syntax\n` +
                `• Sensei becomes a guiding mentor`,
            
            'intermediate->pro': `🚀 Excellent work! (Score: ${score}/100)\n\n` +
                `Ready for Pro level?\n` +
                `• No ghost text - full independence\n` +
                `• Focus on architecture & design\n` +
                `• Sensei for high-level guidance only`
        };

        return messages[`${from}->${to}` as keyof typeof messages] || 
               `Ready to advance from ${from} to ${to}?`;
    }

    private getLevelEmoji(level: LearningLevel): string {
        switch (level) {
            case 'beginner': return '🌱';
            case 'intermediate': return '🌿';
            case 'pro': return '🌳';
        }
    }

    public getLevelDescription(level: LearningLevel): string {
        const descriptions = {
            beginner: 'Learning fundamentals with full guidance',
            intermediate: 'Building logic skills with hints',
            pro: 'Independent coding with architectural guidance'
        };
        return descriptions[level];
    }

    public getLevelIcon(level: LearningLevel): string {
        switch (level) {
            case 'beginner': return '$(mortar-board)';
            case 'intermediate': return '$(rocket)';
            case 'pro': return '$(star)';
        }
    }
}
