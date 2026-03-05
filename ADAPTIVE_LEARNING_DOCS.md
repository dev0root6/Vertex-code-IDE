# 📚 Adaptive Learning System - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Learning Levels](#learning-levels)
3. [Core Services API](#core-services-api)
4. [User Commands](#user-commands)
5. [UI Elements](#ui-elements)
6. [Integration Guide](#integration-guide)
7. [Configuration](#configuration)
8. [Usage Examples](#usage-examples)

---

## Overview

DevX Code IDE's Adaptive Learning System personalizes the coding experience based on student behavior, performance, and skill level. The system tracks real-time metrics, automatically adapts difficulty, and provides contextual guidance without overwhelming the learner.

### Key Features

- **3 Learning Levels**: Beginner, Intermediate, Pro
- **Real-time Performance Tracking**: WPM, error rate, completion time, composite scoring
- **Behavioral Analysis**: Idle detection, stuck detection, keystroke patterns
- **Auto-Adaptation**: Suggests level transitions based on performance
- **Persistent Profiles**: Saved to VS Code workspace state
- **Non-intrusive**: Guidance appears only when needed

### Architecture

```
┌─────────────────────────────────────────┐
│         Extension Activation            │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┬────────────────┐
       │                │                │
   ┌───▼────────┐  ┌───▼──────────┐ ┌──▼─────────┐
   │ Learning   │  │  Activity    │ │   Level    │
   │  Profile   │◄─┤  Monitor     │ │  Adapter   │
   │  Service   │  └──────────────┘ └─────┬──────┘
   └─────┬──────┘                         │
         │                                 │
         ▼                                 ▼
  [GlobalState]                   [Auto Suggestions]
```

---

## Learning Levels

### 🌱 Beginner

**Target Audience**: New programmers learning syntax and basic concepts

**Features**:
- **Full Ghost Text**: Complete code suggestions appear as you type
- **Enhanced Guidance**: Step-by-step instructions, syntax help
- **Frequent Check-ins**: Idle detection after 15 seconds
- **Detailed Feedback**: Comprehensive error explanations

**Behavior**:
- Ghost text shows exactly what to type next
- Errors highlighted immediately with correction hints
- Sensei provides motivational feedback frequently
- Visual Intelligence shows code structure in detail

**Ideal For**:
- First-time programmers
- Learning new programming languages
- Understanding basic syntax and structure

---

### 🌿 Intermediate

**Target Audience**: Students comfortable with syntax, building problem-solving skills

**Features**:
- **Comment Hints**: Strategic comments guide implementation without revealing code
- **Logic Guidance**: Focus on algorithmic approaches and problem-solving
- **Balanced Autonomy**: Idle detection after 30 seconds
- **Conceptual Feedback**: Explanations focus on "why" not "what"

**Behavior**:
- No ghost text; instead, comments appear as hints
- Example: `// TODO: Loop through array and find maximum value`
- Sensei provides logic-focused guidance, not syntax correction
- Visual Intelligence emphasizes relationships and flow

**Ideal For**:
- Students past the beginner phase
- Developing algorithmic thinking
- Learning design patterns and best practices

---

### 🌳 Pro

**Target Audience**: Advanced students ready for real-world development

**Features**:
- **Independent Coding**: Minimal interference, architecture-level guidance only
- **Sensei Insights**: High-level design patterns, optimization tips
- **Maximum Thinking Time**: Idle detection after 120 seconds (2 minutes)
- **Professional Environment**: Simulates real development experience

**Behavior**:
- No ghost text or comment hints
- Sensei only provides architectural/design guidance when requested
- Visual Intelligence shows complex relationships and dependencies
- Focus on code quality, maintainability, scalability

**Ideal For**:
- Advanced students preparing for industry
- Working on complex projects
- Learning software architecture and design

---

## Core Services API

### 1. LearningProfileService

**Location**: `src/learning/learningProfile.ts`

**Purpose**: Manages student profiles, tracks performance metrics, persists data

#### Singleton Access

```typescript
import { LearningProfileService } from './learning/learningProfile';

const profileService = LearningProfileService.getInstance();
profileService.initialize(context);
```

#### Profile Structure

```typescript
interface LearningProfile {
  level: 'beginner' | 'intermediate' | 'pro';
  typingSpeed: number;           // Words per minute (WPM)
  errorRate: number;             // Percentage 0-100
  performanceScore: number;      // Composite score 0-100
  avgCompletionTime: number;     // Average seconds per block
  sessionStats: {
    blocksCompleted: number;     // Total code blocks completed
    hintsUsed: number;           // Number of hints requested
    totalErrors: number;         // Total errors encountered
    totalKeystrokes: number;     // Total keystrokes recorded
  };
}
```

#### Key Methods

**Profile Management**

```typescript
getProfile(): LearningProfile
// Returns current profile data
// Example:
const profile = profileService.getProfile();
console.log(`Level: ${profile.level}, Score: ${profile.performanceScore}`);
```

```typescript
setLevel(level: 'beginner' | 'intermediate' | 'pro'): void
// Manually changes learning level
// Side effect: Saves to globalState
profileService.setLevel('intermediate');
```

```typescript
resetProfile(): void
// Resets all data to defaults
// Sets level to 'beginner', clears all stats
profileService.resetProfile();
```

**Performance Tracking**

```typescript
updateTypingSpeed(wpm: number): void
// Updates typing speed with exponential moving average
// Formula: speed = (speed * 0.7) + (wpm * 0.3)
profileService.updateTypingSpeed(45); // 45 WPM
```

```typescript
recordError(errorType: string): void
// Records a coding error and updates error rate
// Updates performance score automatically
profileService.recordError('SyntaxError');
```

```typescript
recordKeystroke(char: string, timeSinceLastKeystroke: number): void
// Records a single keystroke with timing data
// Updates total keystroke count
profileService.recordKeystroke('a', 150); // 'a' typed 150ms after last keystroke
```

```typescript
recordBlockCompleted(timeTaken: number): void
// Records completion of a code block
// Updates stats and recalculates performance score
profileService.recordBlockCompleted(120); // Took 2 minutes
```

**Level Transitions**

```typescript
shouldLevelUp(): boolean
// Returns true if performance score ≥ 85
// Used by LevelAdapter for auto-suggestions
if (profileService.shouldLevelUp()) {
  console.log('Student ready to level up!');
}
```

```typescript
shouldLevelDown(): boolean
// Returns true if performance score ≤ 40
// Indicates student is struggling
if (profileService.shouldLevelDown()) {
  console.log('Student may need more support');
}
```

#### Performance Scoring Algorithm

The composite performance score (0-100) is calculated from three weighted components:

```typescript
// Component scores
const speedScore = Math.min(typingSpeed / 60 * 100, 100);  // Max 100 at 60+ WPM
const accuracyScore = 100 - errorRate;                      // Higher accuracy = higher score
const timeScore = Math.max(0, 100 - (avgCompletionTime / 3)); // Faster = better

// Weighted composite (Typing: 40%, Accuracy: 40%, Time: 20%)
performanceScore = (speedScore * 0.4) + (accuracyScore * 0.4) + (timeScore * 0.2);
```

**Example: Calculating a student's score**

- Typing Speed: 40 WPM → `speedScore = 40/60 * 100 = 66.7`
- Error Rate: 10% → `accuracyScore = 100 - 10 = 90`
- Avg Completion: 90 seconds → `timeScore = 100 - (90/3) = 70`
- **Final Score**: `(66.7 * 0.4) + (90 * 0.4) + (70 * 0.2) = 26.68 + 36 + 14 = 76.68`

#### Storage

Profile data is persisted to VS Code's globalState:

```typescript
// Automatic save on every update
context.globalState.update('devxLearningProfile', profile);

// Automatic load on initialization
const savedProfile = context.globalState.get('devxLearningProfile');
```

---

### 2. ActivityMonitor

**Location**: `src/learning/activityMonitor.ts`

**Purpose**: Monitors real-time coding behavior, detects idle/stuck states, triggers interventions

#### Singleton Access

```typescript
import { ActivityMonitor } from './learning/activityMonitor';

const activityMonitor = ActivityMonitor.getInstance();
activityMonitor.initialize(profileService);
```

#### Key Methods

**Keystroke Tracking**

```typescript
recordKeystroke(char: string, location: string): void
// Records keystroke with timing and editor location
// Parameters:
//   - char: Character typed (or string for multi-char pastes)
//   - location: Editor location in format "file:line:column"
// Side effects:
//   - Updates internal keystroke buffer (last 100 keystrokes)
//   - Resets idle timer
//   - Updates profile service
//   - Checks for stuck state

activityMonitor.recordKeystroke('a', 'main.ts:10:5');
```

**Behavior Detection**

```typescript
checkIdleState(): void
// Checks if user is idle and triggers callbacks
// Called automatically every 1 second
// Thresholds by level:
//   - Beginner: 15 seconds
//   - Intermediate: 30 seconds
//   - Pro: 120 seconds

// Runs automatically - no manual call needed
```

**Callback Registration**

```typescript
onIdle(callback: (idleTime: number) => void): void
// Registers a function to be called when user is idle
// Callback receives idle time in milliseconds

activityMonitor.onIdle((idleTime) => {
  const seconds = Math.round(idleTime / 1000);
  vscode.window.showInformationMessage(
    `⏰ You've been idle for ${seconds}s. Need help?`,
    'Get Hint',
    'I\'m thinking'
  ).then(response => {
    if (response === 'Get Hint') {
      // Trigger guidance system
    }
  });
});
```

```typescript
onStuck(callback: (location: string) => void): void
// Registers a function to be called when user is stuck
// Stuck = 30 seconds on same line with errors
// Callback receives location string

activityMonitor.onStuck((location) => {
  vscode.window.showWarningMessage(
    `🤔 Stuck at ${location}? Let's review the logic together.`,
    'Get Logic Guidance',
    'Keep trying'
  ).then(response => {
    if (response === 'Get Logic Guidance') {
      // Show architectural guidance (NOT syntax help)
    }
  });
});
```

**Metrics**

```typescript
getTypingSpeed(): number
// Calculates current WPM from last 100 keystrokes
// Uses actual timing data for accuracy
// Returns: Words per minute (assumes 5 chars = 1 word)

const wpm = activityMonitor.getTypingSpeed();
console.log(`Current typing speed: ${wpm} WPM`);
```

```typescript
getIdleTime(): number
// Returns milliseconds since last keystroke
// Useful for custom idle detection logic

const idle = activityMonitor.getIdleTime();
if (idle > 60000) {
  console.log('Idle for over 1 minute');
}
```

**State Management**

```typescript
reset(): void
// Resets all tracking data
// Clears keystroke buffer, idle timer, stuck detection
// Use when starting new lesson or resetting profile

activityMonitor.reset();
```

#### Implementation Details

**Keystroke Buffer**

The monitor maintains a circular buffer of the last 100 keystrokes:

```typescript
interface KeystrokeData {
  char: string;
  timestamp: number;
  location: string;
}

// Buffer structure (internal)
private keystrokeBuffer: KeystrokeData[] = [];
```

**Idle Detection Algorithm**

```typescript
// Check every 1 second
setInterval(() => {
  const timeSinceLastKeystroke = Date.now() - lastKeystrokeTime;
  const threshold = getIdleThresholdForLevel(currentLevel);
  
  if (timeSinceLastKeystroke >= threshold && !isIdle) {
    isIdle = true;
    idleCallbacks.forEach(cb => cb(timeSinceLastKeystroke));
  }
}, 1000);
```

**Stuck Detection Algorithm**

```typescript
// On each keystroke
if (currentLocation === previousLocation) {
  const timeDiff = Date.now() - locationStartTime;
  if (timeDiff >= 30000 && hasErrors) {
    stuckCallbacks.forEach(cb => cb(currentLocation));
  }
}
```

---

### 3. LevelAdapter

**Location**: `src/learning/levelAdapter.ts`

**Purpose**: Automatically suggests level changes based on performance patterns

#### Singleton Access

```typescript
import { LevelAdapter } from './learning/levelAdapter';

const levelAdapter = LevelAdapter.getInstance();
levelAdapter.initialize(profileService);
```

#### Key Methods

**Auto-Adaptation**

```typescript
async checkAndAdaptLevel(): Promise<void>
// Checks performance and suggests level changes if appropriate
// Thresholds:
//   - Level up: Performance score ≥ 85
//   - Level down: Performance score ≤ 40
// Shows non-intrusive VS Code notification with options

// Call periodically (e.g., every 5 minutes or after milestones)
setInterval(() => {
  levelAdapter.checkAndAdaptLevel();
}, 5 * 60 * 1000);
```

**Level Utilities**

```typescript
getLevelIcon(level: string): string
// Returns emoji icon for level
// Returns:
//   - 'beginner' → '🌱'
//   - 'intermediate' → '🌿'
//   - 'pro' → '🌳'
//   - default → '📚'

const icon = levelAdapter.getLevelIcon('intermediate'); // '🌿'
```

```typescript
getLevelDescription(level: string): string
// Returns short description of level features
// Returns:
//   - 'beginner' → 'Full guidance with ghost text'
//   - 'intermediate' → 'Comment hints and logic guidance'
//   - 'pro' → 'Independent coding with architecture guidance'
//   - default → 'Learning mode'

const desc = levelAdapter.getLevelDescription('pro');
// 'Independent coding with architecture guidance'
```

#### Suggestion Dialogs

**Level Up Suggestion**

When performance score ≥ 85:

```
🌟 Great progress! Ready to level up to Intermediate?

[Yes, level up!] [Not yet]
```

If user accepts:
- Profile level is updated
- Status bar refreshes
- Confirmation message shown

**Level Down Suggestion**

When performance score ≤ 40:

```
💡 Having trouble? Consider Beginner level for more support?

[Yes, get help] [Keep trying]
```

Presented as supportive, not punitive. User maintains control.

---

## User Commands

All commands are accessible via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)

### Learning System Commands

#### `DevX: Change Learning Level`

**Command ID**: `devx.changeLevel`

**Function**: Manually select learning level

**UI**: Quick pick menu with 3 options:
- 🌱 Beginner - Full guidance with ghost text
- 🌿 Intermediate - Comment hints and logic guidance
- 🌳 Pro - Independent coding with architecture guidance

**Example**:
```
1. Open Command Palette
2. Type "DevX: Change"
3. Select "DevX: Change Learning Level"
4. Choose desired level
5. Status bar updates immediately
```

---

#### `DevX: Reset Learning Profile`

**Command ID**: `devx.resetProfile`

**Function**: Clear all learning data and start fresh

**UI**: Modal confirmation dialog

```
⚠️ Reset your learning profile? This will clear all progress.

[Yes, Reset] [Cancel]
```

**Effect**:
- Sets level to Beginner
- Clears all statistics (WPM, errors, completions, etc.)
- Resets performance score to 0
- Clears activity monitor data
- Saves empty profile to globalState

**Use Cases**:
- Starting over after long break
- Testing the extension
- Switching between different students (on same workspace)

---

#### `DevX: View Learning Statistics`

**Command ID**: `devx.viewStats`

**Function**: Display comprehensive learning analytics

**UI**: Modal dialog with formatted statistics

```
📊 Learning Statistics

Level: INTERMEDIATE
Performance Score: 78/100

⌨️ Typing Speed: 42 WPM
✅ Accuracy: 91.5%
⏱️ Avg Completion Time: 95s
📚 Blocks Completed: 12
💡 Hints Used: 5

[OK]
```

**Statistics Explained**:
- **Level**: Current learning level (Beginner/Intermediate/Pro)
- **Performance Score**: Composite 0-100 score
- **Typing Speed**: Words per minute (5 chars = 1 word)
- **Accuracy**: 100% - error rate
- **Avg Completion Time**: Mean seconds to complete code blocks
- **Blocks Completed**: Total code blocks finished
- **Hints Used**: Number of times guidance was requested

---

## UI Elements

### Level Status Bar Item

**Location**: Left side of status bar (bottom of VS Code window)

**Display**: `🌱 Beginner` / `🌿 Intermediate` / `🌳 Pro`

**Behavior**:
- Always visible when extension is active
- Click to open level selection menu (same as Change Level command)
- Updates immediately when level changes
- Persists across VS Code sessions

**Implementation**:
```typescript
const levelStatusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  100
);
levelStatusBarItem.command = 'devx.changeLevel';
levelStatusBarItem.text = `🌱 Beginner`;
levelStatusBarItem.tooltip = 'Click to change learning level';
levelStatusBarItem.show();
```

---

### Idle Notifications

**Trigger**: User stops typing for threshold duration

**Thresholds by Level**:
- Beginner: 15 seconds
- Intermediate: 30 seconds
- Pro: 120 seconds (2 minutes)

**UI**: Information message with actions

```
⏰ Sensei: You've been idle for 30s. Need help?

[Get Hint] [I'm thinking]
```

**Behavior**:
- Non-blocking (doesn't interrupt typing)
- Dismisses automatically after 10 seconds
- "Get Hint" triggers guidance system
- "I'm thinking" dismisses without action

---

### Stuck Notifications

**Trigger**: 30 seconds on same line with errors (all levels)

**UI**: Warning message with actions

```
🤔 Sensei: Stuck at main.ts:15? Let's review the logic together.

[Get Logic Guidance] [Keep trying]
```

**Important**: Stuck guidance focuses on LOGIC and ARCHITECTURE, NOT syntax correction

**Behavior**:
- Only triggers once per "stuck event"
- Resets if user moves to different line
- "Get Logic Guidance" shows high-level conceptual help
- "Keep trying" dismisses and resets timer

---

## Integration Guide

### Setting Up the Learning System

**Step 1: Initialize Services in Extension Activation**

```typescript
// src/extension.ts
import { LearningProfileService } from './learning/learningProfile';
import { ActivityMonitor } from './learning/activityMonitor';
import { LevelAdapter } from './learning/levelAdapter';

export function activate(context: vscode.ExtensionContext) {
  // Initialize learning services
  const profileService = LearningProfileService.getInstance();
  profileService.initialize(context);

  const activityMonitor = ActivityMonitor.getInstance();
  activityMonitor.initialize(profileService);

  const levelAdapter = LevelAdapter.getInstance();
  levelAdapter.initialize(profileService);

  // ... rest of activation code
}
```

**Step 2: Create Status Bar Item**

```typescript
// Create level status bar
const levelStatusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  100
);
levelStatusBarItem.command = 'devx.changeLevel';
levelStatusBarItem.tooltip = 'Click to change learning level';

// Update function
function updateLevelDisplay() {
  const profile = profileService.getProfile();
  const icon = levelAdapter.getLevelIcon(profile.level);
  levelStatusBarItem.text = `${icon} ${profile.level}`;
}

updateLevelDisplay();
levelStatusBarItem.show();
```

**Step 3: Wire Text Document Change Listener**

```typescript
// Monitor text changes for keystroke tracking
vscode.workspace.onDidChangeTextDocument((e) => {
  if (e.document.uri.scheme === 'file' && e.contentChanges.length > 0) {
    const change = e.contentChanges[0];
    const location = `${e.document.fileName}:${change.range.start.line}:${change.range.start.character}`;
    activityMonitor.recordKeystroke(change.text, location);
  }
});
```

**Step 4: Register Activity Callbacks**

```typescript
// Idle detection
activityMonitor.onIdle((idleTime) => {
  vscode.window.showInformationMessage(
    `⏰ Sensei: You've been idle for ${Math.round(idleTime / 1000)}s. Need help?`,
    'Get Hint',
    'I\'m thinking'
  ).then(response => {
    if (response === 'Get Hint') {
      vscode.commands.executeCommand('devx.askSensei');
    }
  });
});

// Stuck detection
activityMonitor.onStuck((location) => {
  vscode.window.showWarningMessage(
    `🤔 Sensei: Stuck at ${location}? Let's review the logic together.`,
    'Get Logic Guidance',
    'Keep trying'
  ).then(response => {
    if (response === 'Get Logic Guidance') {
      // Show architectural/logic guidance (NOT syntax)
      showLogicGuidance(location);
    }
  });
});
```

**Step 5: Register Commands**

```typescript
// Change level command
context.subscriptions.push(
  vscode.commands.registerCommand('devx.changeLevel', async () => {
    const levels = [
      { label: '🌱 Beginner', description: 'Full guidance with ghost text', value: 'beginner' },
      { label: '🌿 Intermediate', description: 'Comment hints and logic guidance', value: 'intermediate' },
      { label: '🌳 Pro', description: 'Independent coding with architecture guidance', value: 'pro' }
    ];

    const selected = await vscode.window.showQuickPick(levels, {
      placeHolder: 'Select your learning level',
      title: 'DevX: Learning Level'
    });

    if (selected) {
      profileService.setLevel(selected.value as any);
      updateLevelDisplay();
      vscode.window.showInformationMessage(`Level changed to ${selected.label}`);
    }
  })
);

// Reset profile command
context.subscriptions.push(
  vscode.commands.registerCommand('devx.resetProfile', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Reset your learning profile? This will clear all progress.',
      { modal: true },
      'Yes, Reset'
    );
    
    if (confirm) {
      profileService.resetProfile();
      activityMonitor.reset();
      updateLevelDisplay();
      vscode.window.showInformationMessage('✅ Learning profile reset');
    }
  })
);

// View stats command
context.subscriptions.push(
  vscode.commands.registerCommand('devx.viewStats', async () => {
    const profile = profileService.getProfile();
    const stats = `📊 Learning Statistics\n\nLevel: ${profile.level.toUpperCase()}\nPerformance Score: ${profile.performanceScore}/100\n\n⌨️ Typing Speed: ${Math.round(profile.typingSpeed)} WPM\n✅ Accuracy: ${(100 - profile.errorRate).toFixed(1)}%\n⏱️ Avg Completion Time: ${Math.round(profile.avgCompletionTime)}s\n📚 Blocks Completed: ${profile.sessionStats.blocksCompleted}\n💡 Hints Used: ${profile.sessionStats.hintsUsed}`;
    await vscode.window.showInformationMessage(stats, { modal: true });
  })
);
```

**Step 6: Periodic Level Adaptation Check**

```typescript
// Check for level changes every 5 minutes
setInterval(() => {
  levelAdapter.checkAndAdaptLevel();
}, 5 * 60 * 1000);
```

---

## Configuration

### VS Code Settings

Currently, the learning system uses hardcoded defaults. Future versions will support these settings:

```json
{
  "devx.learning.idleThresholds": {
    "beginner": 15,
    "intermediate": 30,
    "pro": 120
  },
  "devx.learning.stuckThreshold": 30,
  "devx.learning.performanceWeights": {
    "typingSpeed": 0.4,
    "errorRate": 0.4,
    "completionTime": 0.2
  },
  "devx.learning.levelUpThreshold": 85,
  "devx.learning.levelDownThreshold": 40,
  "devx.learning.autoAdapt": true,
  "devx.learning.autoAdaptInterval": 300000
}
```

### Storage Locations

- **Learning Profiles**: `context.globalState.get('devxLearningProfile')`
- **API Keys**: VS Code Secrets API (`context.secrets.get()`)
- **User Settings**: VS Code Workspace Configuration

---

## Usage Examples

### Example 1: Tracking a Lesson Completion

```typescript
// Student starts a lesson
const startTime = Date.now();

// Student types code (tracked automatically via onDidChangeTextDocument)
// Activity monitor records each keystroke

// Student completes the lesson
const endTime = Date.now();
const timeTaken = (endTime - startTime) / 1000; // seconds

// Record completion
profileService.recordBlockCompleted(timeTaken);

// Check if student should level up
if (profileService.shouldLevelUp()) {
  levelAdapter.checkAndAdaptLevel();
}
```

### Example 2: Custom Idle Detection

```typescript
// Add custom idle detection logic
activityMonitor.onIdle((idleTime) => {
  const profile = profileService.getProfile();
  
  if (profile.level === 'beginner' && idleTime > 30000) {
    // Beginner idle for 30+ seconds (double the threshold)
    // Offer more proactive help
    vscode.window.showInformationMessage(
      'Still stuck? Let me break this down step by step.',
      'Yes, please!',
      'I got it'
    ).then(response => {
      if (response === 'Yes, please!') {
        // Show detailed step-by-step guide
      }
    });
  }
});
```

### Example 3: Performance-Based Features

```typescript
// Enable advanced features based on performance
const profile = profileService.getProfile();

if (profile.performanceScore >= 70 && profile.level === 'intermediate') {
  // Unlock Pro features preview
  vscode.window.showInformationMessage(
    '🎉 High performance detected! Want to preview Pro mode features?',
    'Yes', 'Not yet'
  );
}

if (profile.errorRate < 5 && profile.sessionStats.blocksCompleted >= 10) {
  // Award achievement
  vscode.window.showInformationMessage(
    '🏆 Achievement Unlocked: Error-Free Master! (< 5% error rate)'
  );
}
```

### Example 4: Real-time WPM Display

```typescript
// Update WPM in real-time
let wpmStatusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  200
);

setInterval(() => {
  const wpm = activityMonitor.getTypingSpeed();
  if (wpm > 0) {
    wpmStatusBarItem.text = `⌨️ ${Math.round(wpm)} WPM`;
    wpmStatusBarItem.show();
  } else {
    wpmStatusBarItem.hide();
  }
}, 1000);
```

### Example 5: Error Pattern Analysis

```typescript
// Track specific error types
const errorPatterns: { [key: string]: number } = {};

// In your error detection logic
function onErrorDetected(errorType: string) {
  profileService.recordError(errorType);
  
  // Track patterns
  errorPatterns[errorType] = (errorPatterns[errorType] || 0) + 1;
  
  // Suggest targeted help
  if (errorPatterns['SyntaxError'] >= 5) {
    vscode.window.showWarningMessage(
      'Multiple syntax errors detected. Want a quick syntax reference?',
      'Yes', 'No'
    );
  }
}
```

---

## Best Practices

### For Extension Developers

1. **Initialize Early**: Set up learning services in `activate()` before registering commands
2. **Update Frequently**: Record keystrokes and errors as they happen for accurate metrics
3. **Non-Intrusive**: Keep notifications dismissible and non-modal
4. **Respect User Control**: Always allow manual level selection
5. **Persist Often**: Save profile after significant events (level change, block completion)

### For Educators

1. **Start Beginner**: All students begin at Beginner level, even experienced ones
2. **Trust Auto-Adapt**: Let the system suggest level changes based on data
3. **Review Stats**: Use `viewStats` command to check student progress
4. **Custom Thresholds**: Adjust idle/stuck thresholds based on lesson complexity

### For Students

1. **Be Patient**: The system needs a few minutes of activity to assess your level
2. **Try Auto-Suggest**: When the system suggests a level change, give it a try
3. **Check Stats**: Regularly view your statistics to track improvement
4. **Manual Override**: Use `changeLevel` if auto-adapt isn't matching your needs

---

## Troubleshooting

### Profile Not Persisting

**Problem**: Stats reset after reloading VS Code

**Solution**: Ensure `context.globalState` is being used, not `context.workspaceState`

```typescript
// Correct
context.globalState.update('devxLearningProfile', profile);

// Incorrect (only persists per workspace)
context.workspaceState.update('devxLearningProfile', profile);
```

### Idle Detection Not Triggering

**Problem**: Notifications don't appear when idle

**Solution**: Verify text change listener is wired correctly

```typescript
// Check that recordKeystroke is being called
activityMonitor.recordKeystroke = (char, location) => {
  console.log('Keystroke recorded:', char, location); // Debug log
  // ... original implementation
};
```

### Performance Score Always 0

**Problem**: Score doesn't update despite activity

**Solution**: Ensure all tracking methods are called:

```typescript
profileService.updateTypingSpeed(wpm);      // Must be called
profileService.recordError(errorType);       // When errors occur
profileService.recordBlockCompleted(time);   // When blocks complete
```

---

## Future Enhancements

### Planned for Sprint 2-5

- **Mode System**: Beginner/Intermediate/Pro modes with different code generation strategies
- **Comment Hints**: Strategic hints for Intermediate mode (no ghost text)
- **Code Blocks**: Break lessons into trackable blocks
- **Sensei Mentor**: Logic-focused guidance system (NOT syntax help)
- **Context Analysis**: Understand what the student is trying to accomplish
- **Achievement System**: Gamification with badges and milestones
- **Analytics Dashboard**: Webview panel with charts and graphs
- **Export Reports**: Generate PDF/HTML progress reports

---

## Support

For issues, questions, or contributions:

- **GitHub**: https://github.com/dev0root6/DevX-code-IDE
- **Issues**: https://github.com/dev0root6/DevX-code-IDE/issues
- **Documentation**: See DOCS.md for full API reference

---

**Version**: 1.1.0  
**Last Updated**: March 2, 2026  
**Status**: Sprint 1 Complete - Foundation Implemented
