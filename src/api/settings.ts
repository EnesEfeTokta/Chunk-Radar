// Settings API Functions
import type { Settings } from '../types';

const API_BASE = 'http://localhost:3001';

export const fetchSettings = async (): Promise<Settings> => {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (res.ok) {
            return await res.json();
        }
        return { dailyGoal: 20, ttsSpeed: 0.85, ttsVoice: 'en-US' };
    } catch (err) {
        console.error('Failed to fetch settings:', err);
        return { dailyGoal: 20, ttsSpeed: 0.85, ttsVoice: 'en-US' };
    }
};

export const saveSettings = async (settings: Partial<Settings>): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
    }
};
