// Progress API Functions
import type { ChunkStatus } from '../types';

const API_BASE = 'http://localhost:3001';

export const fetchProgress = async (groupId: string): Promise<Record<number, ChunkStatus>> => {
    try {
        const res = await fetch(`${API_BASE}/api/progress/${groupId}`);
        if (res.ok) {
            return await res.json();
        }
        return {};
    } catch (err) {
        console.error('Failed to load progress:', err);
        return {};
    }
};

export const saveProgress = async (groupId: string, chunkId: number, status: ChunkStatus): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, chunkId, status })
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to save progress:', err);
        return false;
    }
};

export const resetProgress = async (groupId: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/progress/${groupId}`, {
            method: 'DELETE'
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to reset progress:', err);
        return false;
    }
};

export const updateConfidence = async (groupId: string, chunkId: number, isCorrect: boolean): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/confidence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, chunkId, isCorrect })
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to update confidence:', err);
        return false;
    }
};
