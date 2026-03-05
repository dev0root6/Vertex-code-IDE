# DevX Extension - New Features Guide

## 🎯 Overview
This extension provides an intelligent learning environment with adaptive AI assistance, inline feedback, and conversational guidance.

## ✨ Key Features

### 1. 💬 Chat with Sensei
Open a conversational chat panel to ask Sensei anything about coding.

**How to use:**
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Search for "Chat with Sensei"
- Or run command: `DevX: 💬 Chat with Sensei`

**Features:**
- Real-time conversational AI assistance
- Context-aware responses (knows your current code)
- Chat history for reference
- Beautiful webview interface
- Optional - can be closed when not needed

### 2. 🧙‍♂️ Inline Sensei Feedback (V1.1 Style)
Sensei provides supportive, inline feedback automatically when you pause coding.

**How it works:**
- Pause your cursor for **2 seconds** on any line
- Sensei analyzes your code and provides supportive feedback
- Messages appear inline after your code like:
  - "looks pretty clean, amazing coder! 💯"
  - "nice approach here! ✨"
  - "great logic flow! 🎯"
  - "consider edge cases here 🤔"

**Features:**
- **Non-repetitive:** Shows only once per line
- **Auto-clears:** Disappears after 6 seconds
- **Contextual:** Analyzes surrounding code
- **Level-adaptive:** Feedback matches your skill level

### 3. 📊 Improved API Error Handling
Better error dialogs when AI providers have issues.

**Error Types:**
1. **Network Timeout** - Cannot reach provider
2. **Empty Response** - Model unavailable/overloaded  
3. **API Limit Exhausted** - Too many requests

**Features:**
- **Modal dialogs** with clear error explanations
- **Quick actions:** Switch to Gemini, Change Provider, Retry
- **Provider recommendations** when APIs are exhausted
- **Auto-switching** option to Gemini (most reliable)

**Example:**
```
⚡ OpenRouter API Limit Exhausted

You've made too many requests or exhausted your quota.

[Switch to Gemini] [Try Different Model] [View Alternatives]
```

### 4. 🎓 Adaptive Learning System (3 Levels)

**Beginner Level:**
- Full working code with line-by-line comments
- Detailed explanations
- Step-by-step guidance

**Intermediate Level:**
- Strategic hints with TODO/HINT comments only
- No full code solutions
- Encourages independent problem-solving

**Pro Level:**
- Architecture and design pattern suggestions
- High-level guidance
- Assumes strong fundamentals

### 5. 🔒 Learning Mode Restrictions

**Permanently Blocked:**
- Copy (Ctrl+C)
- Paste (Ctrl+V)
- Cut (Ctrl+X)

**Toggle-able:**
- Tab key - Press `Ctrl+Alt+G` to toggle (hidden feature)
- Shows notification: "✅ Tab key ENABLED" or "🚫 Tab key DISABLED"

### 6. 🎯 Contextual Guidance System

**Request Guidance:**
- Command: `DevX: Request Learning Guidance`
- Provides level-appropriate help based on:
  - Current code context
  - Line you're stuck on
  - Your learning level
  - Recent activity

**Idle Detection:**
- Triggers after inactivity (15s/30s/120s based on level)
- Suggests next steps conversationally

**Stuck Detection:**
- Detects when you're stuck on a line for 30+ seconds
- Offers: "Yes, give me a hint" / "Let me think more" / "Explain this line"

## 🚀 Commands Reference

| Command | Keybinding | Description |
|---------|-----------|-------------|
| Chat with Sensei | - | Opens chat panel |
| Ask Sensei | Ctrl+I / Cmd+I | Get contextual help |
| Request Guidance | - | Request learning guidance |
| Change Level | - | Switch between beginner/intermediate/pro |
| View Stats | - | See learning progress |
| Toggle Tab | Ctrl+Alt+G | Enable/disable tab key |
| Select Model | Ctrl+J / Cmd+J | Choose AI model |
| Change Provider | - | Switch AI provider |

## 🔧 Configuration

**AI Providers:**
- **Gemini** (Recommended) - Free, 1500 requests/day
- **Local Ollama** - Unlimited, offline, privacy-focused
- **OpenRouter** - Pay-as-you-go, many models
- **Ollama Cloud** - Cloud-hosted Ollama models

**Learning Levels:**
- Auto-adapts based on performance
- Manual override available via "Change Level" command

## 💡 Tips

1. **Use Chat for Queries:** Open the chat panel when you have questions
2. **Let Sensei Guide:** Pause coding for 2s to get inline feedback
3. **Request Help When Stuck:** Use "Request Guidance" command
4. **Switch Providers:** If one API is down, switch to Gemini
5. **Toggle Tab Temporarily:** Use Ctrl+Alt+G if you need tab completion

## 🐛 Troubleshooting

**Inline feedback not showing:**
- Make sure your cursor is on a line with code (not empty)
- Pause for a full 2 seconds
- Check if it already showed on that line (non-repetitive)

**API errors:**
- Use modal dialog options to switch providers
- Gemini is most reliable (free tier)
- Local Ollama requires installation

**Chat not responding:**
- Check API configuration
- Ensure AI provider is selected
- View console for errors

## 📝 Notes

- All features are designed to encourage learning through typing
- Copy/paste restrictions help build muscle memory
- Inline feedback is supportive and encouraging
- Chat panel is optional - use when needed
- API error handling guides you to working alternatives

---

**Version:** 1.1.0  
**Last Updated:** 2024
