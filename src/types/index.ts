// Type Definitions for Chunk-Radar

export interface Chunk {
    id: number;
    english: string;
    turkish: string;
    examples: string[];
    exampleTranslations?: string[];
}

export interface Group {
    id: string;
    name: string;
    file: string;
}

export interface DayStat {
    date: string;
    correct: number;
    wrong: number;
    total: number;
}

export type ChunkStatus = 'unreviewed' | 'correct' | 'wrong' | 'skipped';

export interface ChunkProgress {
    chunkId: number;
    status: ChunkStatus;
}

export interface StreakInfo {
    currentStreak: number;
    longestStreak: number;
    todayCount: number;
    dailyGoal: number;
    goalReached: boolean;
}

export interface Settings {
    dailyGoal: number;
    ttsSpeed: number;
    ttsVoice: string;
}

export interface ConfidenceData {
    level: number;
    nextReview: string | null;
    lastReviewed?: string;
}

export interface Story {
    id: number;
    title: string;
    titleTurkish: string;
    content: string;
    contentTurkish: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tags?: string[];
    wordCount?: number;
    createdAt: string;
    updatedAt: string;
}

export type FocusMode = 'all' | 'wrong' | 'skipped' | 'review';

export interface PracticeSentence {
    english: string;
    turkish: string;
}
