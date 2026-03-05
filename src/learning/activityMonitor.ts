import * as vscode from 'vscode';
import { LearningProfileService, LearningLevel } from './learningProfile';

interface KeystrokeData {
    timestamp: number;
    character: string;
    lineNumber: number;
}

interface IdleState {
    isIdle: boolean;
    idleStartTime: number;
    currentIdleTime: number;
}

export class ActivityMonitor {
    private static instance: ActivityMonitor;
    private profileService: LearningProfileService;
    private keystrokes: KeystrokeData[] = [];
    private idleState: IdleState;
    private lastActivity: number;
    private idleCheckInterval: NodeJS.Timeout | undefined;
    private readonly KEYSTROKE_BUFFER_SIZE = 100;
    private onIdleCallbacks: Array<(idleTime: number) => void> = [];
    private onStuckCallbacks: Array<(line: number, duration: number) => void> = [];
    private lineStuckTime: Map<number, number> = new Map();
    private idleNotifiedThisPause: boolean = false;
    private stuckNotifiedLines: Set<number> = new Set();

    private constructor() {
        this.profileService = LearningProfileService.getInstance();
        this.lastActivity = Date.now();
        this.idleState = {
            isIdle: false,
            idleStartTime: Date.now(),
            currentIdleTime: 0
        };
    }

    public static getInstance(): ActivityMonitor {
        if (!ActivityMonitor.instance) {
            ActivityMonitor.instance = new ActivityMonitor();
        }
        return ActivityMonitor.instance;
    }

    public start() {
        // Start monitoring idle time every second
        this.idleCheckInterval = setInterval(() => {
            this.checkIdleState();
        }, 1000);
    }

    public stop() {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval);
        }
    }

    public recordKeystroke(char: string, line: number) {
        const now = Date.now();
        
        // Add to buffer
        this.keystrokes.push({
            timestamp: now,
            character: char,
            lineNumber: line
        });

        // Trim buffer if too large
        if (this.keystrokes.length > this.KEYSTROKE_BUFFER_SIZE) {
            this.keystrokes.shift();
        }

        // Update activity time
        this.lastActivity = now;
        this.idleState.isIdle = false;
        this.idleNotifiedThisPause = false;

        // Record in profile
        this.profileService.recordKeystroke();

        // Update typing speed
        this.updateTypingSpeed();

        // Reset line stuck time and clear stuck notification for this line
        this.lineStuckTime.set(line, now);
        this.stuckNotifiedLines.delete(line);
    }

    private updateTypingSpeed() {
        if (this.keystrokes.length < 10) return;

        // Calculate WPM from last 10 keystrokes
        const recent = this.keystrokes.slice(-10);
        const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
        
        if (timeSpan > 0) {
            // Average word length is 5 characters
            const words = recent.length / 5;
            const minutes = timeSpan / 60000;
            const wpm = words / minutes;
            
            this.profileService.updateTypingSpeed(wpm);
        }
    }

    private checkIdleState() {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivity;
        const profile = this.profileService.getProfile();
        // 5 second threshold for more realistic, touchy experience
        const threshold = 5;

        // Check if entered idle state
        if (!this.idleState.isIdle && timeSinceLastActivity > threshold * 1000) {
            this.idleState.isIdle = true;
            this.idleState.idleStartTime = this.lastActivity;
            this.idleState.currentIdleTime = timeSinceLastActivity;
            
            // Notify callbacks ONCE per pause (no spam)
            if (!this.idleNotifiedThisPause) {
                this.idleNotifiedThisPause = true;
                this.notifyIdleCallbacks(timeSinceLastActivity / 1000);
            }
        } else if (this.idleState.isIdle) {
            this.idleState.currentIdleTime = timeSinceLastActivity;
        }

        // Check for stuck on specific line
        this.checkStuckOnLine();
    }

    private checkStuckOnLine() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const currentLine = editor.selection.active.line;
        const lastActiveTime = this.lineStuckTime.get(currentLine);
        
        if (lastActiveTime) {
            const stuckTime = Date.now() - lastActiveTime;
            const stuckThreshold = 30000; // 30 seconds - let student think first

            if (stuckTime > stuckThreshold && !this.stuckNotifiedLines.has(currentLine)) {
                // Student stuck on this line - notify ONCE until they move
                this.stuckNotifiedLines.add(currentLine);
                this.profileService.recordStuckEvent();
                this.notifyStuckCallbacks(currentLine, stuckTime / 1000);
            }
        } else {
            this.lineStuckTime.set(currentLine, Date.now());
        }
    }

    private getIdleThreshold(level: LearningLevel): number {
        // Always 5 seconds for realistic, touchy experience
        return 5;
    }

    public getIdleTime(): number {
        return this.idleState.currentIdleTime / 1000; // in seconds
    }

    public isCurrentlyIdle(): boolean {
        return this.idleState.isIdle;
    }

    public onIdle(callback: (idleTimeInSeconds: number) => void) {
        this.onIdleCallbacks.push(callback);
    }

    public onStuck(callback: (line: number, durationInSeconds: number) => void) {
        this.onStuckCallbacks.push(callback);
    }

    private notifyIdleCallbacks(idleTime: number) {
        this.onIdleCallbacks.forEach(cb => {
            try {
                cb(idleTime);
            } catch (error) {
                console.error('[DevX] Error in idle callback:', error);
            }
        });
    }

    private notifyStuckCallbacks(line: number, duration: number) {
        this.onStuckCallbacks.forEach(cb => {
            try {
                cb(line, duration);
            } catch (error) {
                console.error('[DevX] Error in stuck callback:', error);
            }
        });
    }

    public detectErrorPattern(line: number): boolean {
        // Check if student keeps making errors on the same line
        const recentOnLine = this.keystrokes
            .slice(-20)
            .filter(k => k.lineNumber === line);

        // If more than 10 keystrokes on same line in recent activity,
        // likely struggling
        return recentOnLine.length > 10;
    }

    public getTypingActivity(): string {
        const profile = this.profileService.getProfile();
        return `Speed: ${Math.round(profile.typingSpeed)} WPM | Accuracy: ${(100 - profile.errorRate).toFixed(1)}%`;
    }

    public reset() {
        this.keystrokes = [];
        this.lineStuckTime.clear();
        this.stuckNotifiedLines.clear();
        this.idleNotifiedThisPause = false;
        this.lastActivity = Date.now();
        this.idleState = {
            isIdle: false,
            idleStartTime: Date.now(),
            currentIdleTime: 0
        };
        // Clear callback arrays to prevent duplicates when re-registering
        this.onIdleCallbacks = [];
        this.onStuckCallbacks = [];
    }
}
