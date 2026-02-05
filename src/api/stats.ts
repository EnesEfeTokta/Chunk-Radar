// Stats and Streak API Functions
import type { DayStat, StreakInfo } from '../types';

const API_BASE = 'http://localhost:3001';

export const fetchStats = async (): Promise<DayStat[]> => {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        if (res.ok) {
            return await res.json();
        }
        return [];
    } catch (err) {
        console.error('Failed to fetch stats:', err);
        return [];
    }
};

export const saveStats = async (correct: number, wrong: number): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correct, wrong })
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to save stats:', err);
        return false;
    }
};

export const fetchStreak = async (): Promise<StreakInfo> => {
    try {
        const res = await fetch(`${API_BASE}/api/streak`);
        if (res.ok) {
            return await res.json();
        }
        return { currentStreak: 0, longestStreak: 0, todayCount: 0, dailyGoal: 20, goalReached: false };
    } catch (err) {
        console.error('Failed to fetch streak:', err);
        return { currentStreak: 0, longestStreak: 0, todayCount: 0, dailyGoal: 20, goalReached: false };
    }
};
