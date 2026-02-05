// Story API Functions
import type { Story } from '../types';

const API_BASE = 'http://localhost:3001';

export const fetchStories = async (): Promise<Story[]> => {
    try {
        const res = await fetch(`${API_BASE}/api/stories`);
        if (res.ok) {
            return await res.json();
        }
        return [];
    } catch (err) {
        console.error('Failed to fetch stories:', err);
        return [];
    }
};

export const createStory = async (story: Partial<Story>): Promise<Story | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/stories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(story)
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (err) {
        console.error('Failed to create story:', err);
        return null;
    }
};

export const updateStory = async (id: number, story: Partial<Story>): Promise<Story | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/stories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(story)
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (err) {
        console.error('Failed to update story:', err);
        return null;
    }
};

export const deleteStory = async (id: number): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/stories/${id}`, {
            method: 'DELETE'
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to delete story:', err);
        return false;
    }
};
