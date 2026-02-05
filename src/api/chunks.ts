// Chunk API Functions
import type { Chunk } from '../types';

const API_BASE = 'http://localhost:3001';

export const fetchChunks = async (groupId: string): Promise<Chunk[]> => {
    if (!groupId) return [];

    try {
        const res = await fetch(`${API_BASE}/api/chunks/${groupId}`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
        return [];
    } catch (err) {
        console.error('Failed to fetch chunks:', err);
        return [];
    }
};

export const createChunk = async (groupId: string, chunk: Omit<Chunk, 'id'>): Promise<Chunk | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/chunks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, chunk })
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (err) {
        console.error('Failed to create chunk:', err);
        return null;
    }
};

export const updateChunk = async (groupId: string, chunk: Chunk): Promise<Chunk | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/chunks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, chunk })
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (err) {
        console.error('Failed to update chunk:', err);
        return null;
    }
};

export const deleteChunk = async (groupId: string, chunkId: number): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/chunks`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, chunkId })
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to delete chunk:', err);
        return false;
    }
};
