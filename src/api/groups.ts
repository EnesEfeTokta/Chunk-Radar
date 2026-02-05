// Group API Functions
import type { Group } from '../types';

const API_BASE = 'http://localhost:3001';

export const fetchGroups = async (): Promise<Group[]> => {
    try {
        const res = await fetch(`${API_BASE}/api/groups`);
        if (res.ok) {
            return await res.json();
        }
        return [];
    } catch (err) {
        console.error('Failed to fetch groups:', err);
        return [];
    }
};

export const createGroup = async (group: Omit<Group, 'id'>): Promise<Group | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(group)
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (err) {
        console.error('Failed to create group:', err);
        return null;
    }
};

export const updateGroup = async (group: Group): Promise<Group | null> => {
    try {
        const res = await fetch(`${API_BASE}/api/groups/${group.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(group)
        });
        if (res.ok) {
            return await res.json();
        }
        return null;
    } catch (err) {
        console.error('Failed to update group:', err);
        return null;
    }
};

export const deleteGroup = async (groupId: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/api/groups/${groupId}`, {
            method: 'DELETE'
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to delete group:', err);
        return false;
    }
};
