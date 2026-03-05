import * as vscode from 'vscode';

export type LearningLevel = 'beginner' | 'intermediate' | 'pro';

export interface SessionStats {
    startTime: Date;
    keystrokeCount: number;
    errorCount: number;
    hintsUsed: number;
    blocksCompleted: number;
}

export interface LearningProfile {
    level: LearningLevel;
    typingSpeed: number; // words per minute
    errorRate: number; // percentage (0-100)
    avgCompletionTime: number; // seconds per block
    stuckEvents: number; // times stuck for >threshold
    lastActivity: Date;
    sessionStats: SessionStats;
    autoLevelEnabled: boolean;
    totalSessionTime: number; // total minutes spent
    performanceScore: number; // 0-100
}

export class LearningProfileService {
    private static instance: LearningProfileService;
    private context: vscode.ExtensionContext | undefined;
    private currentProfile: LearningProfile | undefined;
    private readonly PROFILE_KEY = 'devx.learningProfile';
    private readonly SETUP_COMPLETE_KEY = 'devx.setupComplete';

    private constructor() {}

    public static getInstance(): LearningProfileService {
        if (!LearningProfileService.instance) {
            LearningProfileService.instance = new LearningProfileService();
        }
        return LearningProfileService.instance;
    }

    public async initialize(context: vscode.ExtensionContext): Promise<boolean> {
        this.context = context;
        
        // Check if setup wizard has been completed
        const setupComplete = context.globalState.get<boolean>(this.SETUP_COMPLETE_KEY, false);
        
        if (!setupComplete) {
            // First time setup - show wizard
            const level = await this.showSetupWizard();
            if (level) {
                this.currentProfile = this.createDefaultProfile();
                this.currentProfile.level = level;
                this.saveProfile();
                await context.globalState.update(this.SETUP_COMPLETE_KEY, true);
                return true;
            }
            return false;
        }
        
        this.loadProfile();
        return true;
    }

    private async showSetupWizard(): Promise<LearningLevel | null> {
        const welcome = await vscode.window.showInformationMessage(
            '🎉 Welcome to DevX Code IDE!\n\nLet\'s set up your learning experience.',
            { modal: true },
            'Continue'
        );
        
        if (!welcome) {
            return null;
        }

        const levelDescriptions = [
            '🌱 Beginner - Full ghost code generation, step-by-step guidance, Sensei always available',
            '🌿 Intermediate - Hints & comments only, Sensei helps when stuck (5s idle)',
            '🌳 Pro - Independent coding, Block Code + Visualizer only, no Sensei'
        ];

        const choice = await vscode.window.showQuickPick(levelDescriptions, {
            placeHolder: 'Choose your programming experience level',
            title: 'DevX Setup: Learning Level',
            canPickMany: false
        });

        if (!choice) {
            return null;
        }

        if (choice.includes('Beginner')) {
            vscode.window.showInformationMessage(
                '✅ Beginner mode activated!\n\n• Ghost text will guide you line-by-line\n• Sensei provides instant feedback\n• Press Tab to accept suggestions',
                'Got it!'
            );
            return 'beginner';
        } else if (choice.includes('Intermediate')) {
            vscode.window.showInformationMessage(
                '✅ Intermediate mode activated!\n\n• You\'ll get strategic hints as comments\n• Sensei appears when you\'re stuck (5s idle)\n• Focus on logic, not syntax',
                'Got it!'
            );
            return 'intermediate';
        } else {
            vscode.window.showInformationMessage(
                '✅ Pro mode activated!\n\n• No ghost text or Sensei interruptions\n• Block Code & Visualizer tools available\n• Full independence!',
                'Got it!'
            );
            return 'pro';
        }
    }

    private loadProfile() {
        if (!this.context) return;

        const stored = this.context.globalState.get<LearningProfile>(this.PROFILE_KEY);
        
        if (stored) {
            // Restore dates from strings
            stored.lastActivity = new Date(stored.lastActivity);
            stored.sessionStats.startTime = new Date(stored.sessionStats.startTime);
            this.currentProfile = stored;
        } else {
            // Create new profile
            this.currentProfile = this.createDefaultProfile();
            this.saveProfile();
        }
    }

    private createDefaultProfile(): LearningProfile {
        return {
            level: 'beginner',
            typingSpeed: 0,
            errorRate: 0,
            avgCompletionTime: 0,
            stuckEvents: 0,
            lastActivity: new Date(),
            sessionStats: {
                startTime: new Date(),
                keystrokeCount: 0,
                errorCount: 0,
                hintsUsed: 0,
                blocksCompleted: 0
            },
            autoLevelEnabled: true,
            totalSessionTime: 0,
            performanceScore: 0
        };
    }

    public getProfile(): LearningProfile {
        if (!this.currentProfile) {
            this.currentProfile = this.createDefaultProfile();
        }
        return this.currentProfile;
    }

    public setLevel(level: LearningLevel) {
        if (this.currentProfile) {
            this.currentProfile.level = level;
            this.saveProfile();
        }
    }

    public updateTypingSpeed(wpm: number) {
        if (this.currentProfile) {
            // Exponential moving average for smooth updates
            this.currentProfile.typingSpeed = 
                this.currentProfile.typingSpeed === 0 
                    ? wpm 
                    : this.currentProfile.typingSpeed * 0.7 + wpm * 0.3;
            this.saveProfile();
        }
    }

    public recordError() {
        if (this.currentProfile) {
            this.currentProfile.sessionStats.errorCount++;
            this.updateErrorRate();
            this.saveProfile();
        }
    }

    public recordKeystroke() {
        if (this.currentProfile) {
            this.currentProfile.sessionStats.keystrokeCount++;
            this.currentProfile.lastActivity = new Date();
        }
    }

    public recordStuckEvent() {
        if (this.currentProfile) {
            this.currentProfile.stuckEvents++;
            this.saveProfile();
        }
    }

    public recordHintUsed() {
        if (this.currentProfile) {
            this.currentProfile.sessionStats.hintsUsed++;
            this.saveProfile();
        }
    }

    public recordBlockCompleted(timeInSeconds: number) {
        if (this.currentProfile) {
            this.currentProfile.sessionStats.blocksCompleted++;
            
            // Update average completion time
            const total = this.currentProfile.avgCompletionTime * 
                (this.currentProfile.sessionStats.blocksCompleted - 1);
            this.currentProfile.avgCompletionTime = 
                (total + timeInSeconds) / this.currentProfile.sessionStats.blocksCompleted;
            
            this.updatePerformanceScore();
            this.saveProfile();
        }
    }

    private updateErrorRate() {
        if (this.currentProfile && this.currentProfile.sessionStats.keystrokeCount > 0) {
            this.currentProfile.errorRate = 
                (this.currentProfile.sessionStats.errorCount / 
                 this.currentProfile.sessionStats.keystrokeCount) * 100;
        }
    }

    private updatePerformanceScore() {
        if (!this.currentProfile) return;

        // Calculate score (0-100) based on multiple factors
        const speedScore = Math.min((this.currentProfile.typingSpeed / 50) * 30, 30);
        const accuracyScore = Math.max(0, (100 - this.currentProfile.errorRate) * 0.4);
        const completionScore = this.currentProfile.avgCompletionTime < 60 ? 30 : 
                               this.currentProfile.avgCompletionTime < 120 ? 20 : 10;

        this.currentProfile.performanceScore = Math.round(
            speedScore + accuracyScore + completionScore
        );
    }

    public shouldLevelUp(): boolean {
        if (!this.currentProfile || !this.currentProfile.autoLevelEnabled) {
            return false;
        }

        const score = this.currentProfile.performanceScore;
        const level = this.currentProfile.level;

        return (
            (level === 'beginner' && score > 80 && this.currentProfile.sessionStats.blocksCompleted >= 3) ||
            (level === 'intermediate' && score > 85 && this.currentProfile.sessionStats.blocksCompleted >= 5)
        );
    }

    public shouldLevelDown(): boolean {
        if (!this.currentProfile || !this.currentProfile.autoLevelEnabled) {
            return false;
        }

        const score = this.currentProfile.performanceScore;
        const level = this.currentProfile.level;

        return (
            (level === 'pro' && score < 40) ||
            (level === 'intermediate' && score < 35)
        );
    }

    public resetSession() {
        if (this.currentProfile) {
            this.currentProfile.sessionStats = {
                startTime: new Date(),
                keystrokeCount: 0,
                errorCount: 0,
                hintsUsed: 0,
                blocksCompleted: 0
            };
            this.saveProfile();
        }
    }

    public resetProfile() {
        this.currentProfile = this.createDefaultProfile();
        this.saveProfile();
    }

    private saveProfile() {
        if (this.context && this.currentProfile) {
            this.context.globalState.update(this.PROFILE_KEY, this.currentProfile);
        }
    }

    public exportProfile(): string {
        return JSON.stringify(this.currentProfile, null, 2);
    }
}
