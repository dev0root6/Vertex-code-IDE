import * as vscode from 'vscode';
import { LearningProfileService, LearningLevel } from './learningProfile';
import { AIService } from '../aiService';

/**
 * Provides contextual, conversational guidance based on student level
 */
export class GuidanceService {
    private static instance: GuidanceService;
    private profileService: LearningProfileService;
    private aiService: AIService;

    private constructor() {
        this.profileService = LearningProfileService.getInstance();
        this.aiService = AIService.getInstance();
    }

    public static getInstance(): GuidanceService {
        if (!GuidanceService.instance) {
            GuidanceService.instance = new GuidanceService();
        }
        return GuidanceService.instance;
    }

    /**
     * Provides level-appropriate code guidance
     * Beginner: Full code with explanations
     * Intermediate: Comments/hints only
     * Pro: Architecture/design guidance
     */
    public async provideCodeGuidance(
        userQuestion: string,
        context: string,
        language: string
    ): Promise<string> {
        const profile = this.profileService.getProfile();

        switch (profile.level) {
            case 'beginner':
                return this.provideBeginnersCode(userQuestion, context, language);
            
            case 'intermediate':
                return this.provideIntermediateHints(userQuestion, context, language);
            
            case 'pro':
                return this.provideProGuidance(userQuestion, context, language);
        }
    }

    /**
     * Beginner mode: Full working code with explanations focusing on WHY
     */
    private async provideBeginnersCode(
        question: string,
        context: string,
        language: string
    ): Promise<string> {
        const prompt = `You are teaching a beginner programmer.

Question: ${question}
Language: ${language}
Context: ${context}

Provide:
1. Complete working code that answers their question
2. Comments explaining WHY each part exists and what problem it solves (NOT just syntax)
3. Focus on the purpose and reasoning behind the code

Example comment style:
// We need a loop here because we want to process each item individually
// This variable stores the result so we can use it later in calculations

Format as actual ${language} code with WHY-focused comments.`;

        return await this.aiService.generateCode(prompt, context, language);
    }

    /**
     * Intermediate mode: Strategic comments/hints focusing on WHY and logic
     */
    private async provideIntermediateHints(
        question: string,
        context: string,
        language: string
    ): Promise<string> {
        const prompt = `You are mentoring an intermediate programmer who needs to solve this themselves.

Question: ${question}
Language: ${language}  
Context: ${context}

Provide ONLY strategic hints as comments (NOT full code):
- // TODO: You need to store the results because...
- // HINT: A loop would work here because we want to...
- // APPROACH: Think about WHY we need to check this condition - it prevents...

Focus on WHY and the reasoning behind each step, not syntax.
Give them the logical roadmap. 3-5 hint comments maximum.`;

        return await this.aiService.generateSenseiResponse(prompt, context);
    }

    /**
     * Pro mode: High-level architecture and design guidance
     */
    private async provideProGuidance(
        question: string,
        context: string,
        language: string
    ): Promise<string> {
        const prompt = `You are advising an experienced programmer on best practices and design.

Question: ${question}
Language: ${language}
Context: ${context}

Provide high-level guidance about:
- Design patterns that apply
- Architectural considerations
- Performance and scalability
- Edge cases and testing approaches

Be concise (3-5 sentences). Don't write code unless showing a specific pattern.`;

        return await this.aiService.generateSenseiResponse(prompt, context);
    }

    /**
     * Provides conversational encouragement based on progress
     */
    public generateEncouragement(
        stuckDuration: number,
        errorCount: number,
        level: LearningLevel
    ): string {
        const encouragements = {
            beginner: [
                "You're doing great! Every developer gets stuck sometimes. Let's break this down together.",
                "I can see you're thinking hard about this. That's exactly how learning works!",
                "Taking your time shows you're really trying to understand. I'm here to help!",
                "You've made good progress so far. Let's tackle this next part together."
            ],
            intermediate: [
                "You've got the fundamentals down. Now you're building problem-solving skills!",
                "I can see you're approaching this methodically. Want a strategic hint?",
                "You're thinking like a developer! Sometimes the best solutions take time.",
                "Great effort! You're getting closer - maybe look at it from a different angle?"
            ],
            pro: [
                "You're considering the right things. Sometimes complex solutions need time to crystallize.",
                "Your approach shows good architectural thinking. Want to discuss trade-offs?",
                "You're working through the design space well. Need a second perspective?",
                "Taking time to get it right is the mark of a professional. What are you weighing?"
            ]
        };

        const messages = encouragements[level];
        const index = Math.floor(Math.random() * messages.length);
        
        let message = messages[index];

        // Add context based on duration
        if (stuckDuration > 120) {
            message += " You've been on this for a while - that's dedication! Break it into smaller steps?";
        } else if (stuckDuration > 60) {
            message += " You're investing good time in understanding this.";
        }

        return message;
    }

    /**
     * Provides specific line explanation focusing on WHY
     */
    public async explainLine(
        lineText: string,
        context: string,
        language: string,
        level: LearningLevel
    ): Promise<string> {
        let prompt = '';

        if (level === 'beginner') {
            prompt = `Explain WHY this ${language} code line exists and what problem it solves:\n\n${lineText}\n\nContext:\n${context}\n\nFocus on the PURPOSE and REASONING behind this line, not the syntax. Why does the developer need this line here?`;
        } else if (level === 'intermediate') {
            prompt = `Explain WHY this ${language} code exists in the bigger picture:\n\n${lineText}\n\nContext:\n${context}\n\nFocus on the LOGIC and DECISION-MAKING: Why this approach? What problem does it solve?`;
        } else {
            prompt = `Analyze WHY this ${language} code exists from a design perspective:\n\n${lineText}\n\nContext:\n${context}\n\nDiscuss the reasoning, trade-offs, and why this solution was chosen.`;
        }

        return await this.aiService.generateSenseiResponse(prompt, context);
    }

    /**
     * Provides "next step" suggestions when user is idle
     */
    public async suggestNextStep(
        currentCode: string,
        language: string,
        level: LearningLevel
    ): Promise<string> {
        const prompt = `A ${level}-level student is working on this ${language} code:\n\n${currentCode}\n\nThey paused. Suggest what they might work on next (1-2 sentences). Be encouraging and specific.`;

        return await this.aiService.generateSenseiResponse(prompt, currentCode);
    }
}
