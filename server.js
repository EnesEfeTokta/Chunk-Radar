import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'src', 'data');

app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const slugify = (text) => {
    const slug = text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-');        // Replace multiple - with single -
    return slug || 'group-' + Date.now(); // Fallback if empty
};

// Helper to safely read JSON
const readJSON = (filePath, defaultValue = []) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const data = fs.readFileSync(filePath, 'utf8');
        return data ? JSON.parse(data) : defaultValue;
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultValue;
    }
};

// Helper to safely write JSON
const writeJSON = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error(`Error writing ${filePath}:`, err);
        throw err;
    }
};

// Migration: Convert old format to new unified metadata
const migrateToUnifiedMetadata = () => {
    const metadataPath = path.join(DATA_DIR, 'metadata.json');
    const statsPath = path.join(DATA_DIR, 'stats.json');

    console.log('Checking for data migration...');

    const existingData = readJSON(metadataPath, null);

    // Check if already in new format (object with groups/stats)
    if (existingData && !Array.isArray(existingData) && existingData.groups) {
        console.log('Metadata already in unified format.');
        return existingData;
    }

    // Need to migrate from old format
    console.log('Migrating to unified metadata format...');

    const oldGroups = Array.isArray(existingData) ? existingData : [];
    const oldStats = readJSON(statsPath, []);

    const newMetadata = {
        groups: oldGroups.length > 0 ? oldGroups : [
            { id: 'default', name: 'Günlük Popüler', file: 'chunks.json' }
        ],
        stats: oldStats
    };

    writeJSON(metadataPath, newMetadata);

    // Archive old stats.json
    if (fs.existsSync(statsPath)) {
        try {
            fs.renameSync(statsPath, path.join(DATA_DIR, 'stats.json.bak'));
            console.log('Old stats.json backed up to stats.json.bak');
        } catch (err) {
            console.log('Could not backup stats.json:', err.message);
        }
    }

    // Ensure default chunks file exists
    const chunksPath = path.join(DATA_DIR, 'chunks.json');
    if (!fs.existsSync(chunksPath)) {
        writeJSON(chunksPath, []);
    }

    console.log('Migration complete.');
    return newMetadata;
};

// Get metadata (unified structure)
const getMetadata = () => {
    const metadataPath = path.join(DATA_DIR, 'metadata.json');
    let data = readJSON(metadataPath, null);

    // Handle old format or missing file
    if (!data || Array.isArray(data)) {
        data = migrateToUnifiedMetadata();
    }

    return data;
};

// Save metadata (unified structure)
const saveMetadata = (metadata) => {
    const metadataPath = path.join(DATA_DIR, 'metadata.json');
    writeJSON(metadataPath, metadata);
};

// Initialize on startup
migrateToUnifiedMetadata();

// Get all groups
app.get('/api/groups', (req, res) => {
    try {
        const metadata = getMetadata();
        res.json(metadata.groups);
    } catch (err) {
        console.error('GET /api/groups error:', err);
        res.status(500).json({ error: 'Failed to read metadata' });
    }
});

// Create new group
app.post('/api/groups', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const id = slugify(name);
        const metadata = getMetadata();

        if (metadata.groups.find(g => g.id === id)) {
            return res.status(400).json({ error: 'Group already exists' });
        }

        const filename = `${id}.json`;
        const newGroupPath = path.join(DATA_DIR, filename);

        const newGroup = { id, name, file: filename };
        metadata.groups.push(newGroup);

        saveMetadata(metadata);
        writeJSON(newGroupPath, []);

        console.log(`Created group: ${name} (${id})`);
        res.json(newGroup);
    } catch (err) {
        console.error('POST /api/groups error:', err);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Update group
app.put('/api/groups/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        console.log(`Updating group ${id} to name: ${name}`);

        const metadata = getMetadata();
        const groupIdx = metadata.groups.findIndex(g => g.id === id);

        if (groupIdx === -1) return res.status(404).json({ error: 'Group not found' });

        metadata.groups[groupIdx].name = name;
        saveMetadata(metadata);

        res.json(metadata.groups[groupIdx]);
    } catch (err) {
        console.error('PUT /api/groups error:', err);
        res.status(500).json({ error: 'Failed to update group' });
    }
});

// Delete group
app.delete('/api/groups/:id', (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Deleting group ${id}`);

        const metadata = getMetadata();
        const group = metadata.groups.find(g => g.id === id);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Don't delete chunks.json (the default one)
        if (group.file !== 'chunks.json') {
            const groupFilePath = path.join(DATA_DIR, group.file);
            if (fs.existsSync(groupFilePath)) {
                try {
                    fs.unlinkSync(groupFilePath);
                    console.log(`Deleted file: ${group.file}`);
                } catch (e) {
                    console.error('Failed to delete group file:', e);
                }
            }
        }

        metadata.groups = metadata.groups.filter(g => g.id !== id);
        // Note: Stats are preserved (not deleted)
        saveMetadata(metadata);

        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/groups error:', err);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});

// Add chunk to group
app.post('/api/chunks', (req, res) => {
    try {
        const { groupId, chunk } = req.body;
        const metadata = getMetadata();
        const group = metadata.groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        let chunks = readJSON(groupFilePath, []);

        const newChunk = {
            ...chunk,
            id: Date.now() // Use timestamp for unique ID
        };
        chunks.push(newChunk);

        writeJSON(groupFilePath, chunks);
        res.json(newChunk);
    } catch (err) {
        console.error('POST /api/chunks error:', err);
        res.status(500).json({ error: 'Failed to add chunk' });
    }
});

// Update chunk
app.put('/api/chunks/:groupId/:chunkId', (req, res) => {
    try {
        const { groupId, chunkId } = req.params;
        const { chunk } = req.body;

        const metadata = getMetadata();
        const group = metadata.groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        let chunks = readJSON(groupFilePath, []);
        const chunkIdx = chunks.findIndex(c => c.id == chunkId);

        if (chunkIdx === -1) return res.status(404).json({ error: 'Chunk not found' });

        chunks[chunkIdx] = { ...chunks[chunkIdx], ...chunk };
        writeJSON(groupFilePath, chunks);
        // Note: Stats are preserved (not affected)
        res.json(chunks[chunkIdx]);
    } catch (err) {
        console.error('PUT /api/chunks error:', err);
        res.status(500).json({ error: 'Failed to update chunk' });
    }
});

// Delete chunk
app.delete('/api/chunks/:groupId/:chunkId', (req, res) => {
    try {
        const { groupId, chunkId } = req.params;

        const metadata = getMetadata();
        const group = metadata.groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        let chunks = readJSON(groupFilePath, []);
        chunks = chunks.filter(c => c.id != chunkId);

        writeJSON(groupFilePath, chunks);
        // Note: Stats are preserved (not affected)
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/chunks error:', err);
        res.status(500).json({ error: 'Failed to delete chunk' });
    }
});

// Get chunks for group
app.get('/api/chunks/:groupId', (req, res) => {
    try {
        const { groupId } = req.params;
        const metadata = getMetadata();
        const group = metadata.groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        const chunks = readJSON(groupFilePath, []);
        res.json(chunks);
    } catch (err) {
        console.error('GET /api/chunks error:', err);
        res.status(500).json({ error: 'Failed to read chunks' });
    }
});

// Stats API - Read from metadata.stats
app.get('/api/stats', (req, res) => {
    try {
        const metadata = getMetadata();
        res.json(metadata.stats || []);
    } catch (err) {
        console.error('GET /api/stats error:', err);
        res.status(500).json({ error: 'Failed to read stats' });
    }
});

// Stats API - Write to metadata.stats
app.post('/api/stats', (req, res) => {
    try {
        const { correct, wrong } = req.body;
        const date = new Date().toISOString().split('T')[0];

        const metadata = getMetadata();
        let stats = metadata.stats || [];

        const todayIdx = stats.findIndex(s => s.date === date);
        if (todayIdx !== -1) {
            stats[todayIdx].correct += correct;
            stats[todayIdx].wrong += wrong;
            stats[todayIdx].total += (correct + wrong);
        } else {
            stats.push({ date, correct, wrong, total: correct + wrong });
        }

        // Keep only last 30 days
        stats = stats.slice(-30);

        metadata.stats = stats;
        saveMetadata(metadata);

        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/stats error:', err);
        res.status(500).json({ error: 'Failed to save stats' });
    }
});

// Progress API - Get progress for a group
app.get('/api/progress/:groupId', (req, res) => {
    try {
        const { groupId } = req.params;
        const metadata = getMetadata();
        const progress = metadata.progress || {};
        res.json(progress[groupId] || {});
    } catch (err) {
        console.error('GET /api/progress error:', err);
        res.status(500).json({ error: 'Failed to read progress' });
    }
});

// Progress API - Save/update chunk progress
app.post('/api/progress', (req, res) => {
    try {
        const { groupId, chunkId, status } = req.body;
        if (!groupId || !chunkId || !status) {
            return res.status(400).json({ error: 'groupId, chunkId, and status are required' });
        }

        const metadata = getMetadata();
        if (!metadata.progress) {
            metadata.progress = {};
        }
        if (!metadata.progress[groupId]) {
            metadata.progress[groupId] = {};
        }

        metadata.progress[groupId][chunkId] = status;
        saveMetadata(metadata);

        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/progress error:', err);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

// Progress API - Reset progress for a group
app.delete('/api/progress/:groupId', (req, res) => {
    try {
        const { groupId } = req.params;
        const metadata = getMetadata();

        if (metadata.progress && metadata.progress[groupId]) {
            metadata.progress[groupId] = {};
            saveMetadata(metadata);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/progress error:', err);
        res.status(500).json({ error: 'Failed to reset progress' });
    }
});

// Settings API - Get user settings
app.get('/api/settings', (req, res) => {
    try {
        const metadata = getMetadata();
        const defaultSettings = {
            dailyGoal: 20,
            ttsSpeed: 0.85,
            ttsVoice: 'en-US'
        };
        res.json(metadata.settings || defaultSettings);
    } catch (err) {
        console.error('GET /api/settings error:', err);
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

// Settings API - Update user settings
app.put('/api/settings', (req, res) => {
    try {
        const { dailyGoal, ttsSpeed, ttsVoice } = req.body;
        const metadata = getMetadata();

        metadata.settings = {
            ...(metadata.settings || {}),
            ...(dailyGoal !== undefined && { dailyGoal }),
            ...(ttsSpeed !== undefined && { ttsSpeed }),
            ...(ttsVoice !== undefined && { ttsVoice })
        };

        saveMetadata(metadata);
        res.json(metadata.settings);
    } catch (err) {
        console.error('PUT /api/settings error:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Streak API - Get current streak info
app.get('/api/streak', (req, res) => {
    try {
        const metadata = getMetadata();
        const today = new Date().toISOString().split('T')[0];
        const stats = metadata.stats || [];

        // Calculate streak
        let currentStreak = 0;
        let longestStreak = metadata.longestStreak || 0;

        // Check if user studied today
        const todayStats = stats.find(s => s.date === today);
        const todayCount = todayStats ? todayStats.total : 0;
        const dailyGoal = metadata.settings?.dailyGoal || 20;

        // Calculate current streak by checking consecutive days
        const sortedStats = [...stats].sort((a, b) => new Date(b.date) - new Date(a.date));

        for (let i = 0; i < sortedStats.length; i++) {
            const statDate = new Date(sortedStats[i].date);
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedDateStr = expectedDate.toISOString().split('T')[0];

            if (sortedStats[i].date === expectedDateStr && sortedStats[i].total >= dailyGoal) {
                currentStreak++;
            } else if (i === 0 && sortedStats[i].date !== expectedDateStr) {
                // Today not studied yet, check from yesterday
                expectedDate.setDate(expectedDate.getDate() - 1);
                const yesterdayStr = expectedDate.toISOString().split('T')[0];
                if (sortedStats[i].date === yesterdayStr && sortedStats[i].total >= dailyGoal) {
                    currentStreak++;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        // Update longest streak if needed
        if (currentStreak > longestStreak) {
            metadata.longestStreak = currentStreak;
            saveMetadata(metadata);
            longestStreak = currentStreak;
        }

        res.json({
            currentStreak,
            longestStreak,
            todayCount,
            dailyGoal,
            goalReached: todayCount >= dailyGoal
        });
    } catch (err) {
        console.error('GET /api/streak error:', err);
        res.status(500).json({ error: 'Failed to get streak' });
    }
});

// Confidence API - Update chunk confidence level for spaced repetition
app.post('/api/confidence', (req, res) => {
    try {
        const { groupId, chunkId, isCorrect } = req.body;
        if (!groupId || !chunkId || isCorrect === undefined) {
            return res.status(400).json({ error: 'groupId, chunkId, and isCorrect are required' });
        }

        const metadata = getMetadata();
        if (!metadata.confidence) {
            metadata.confidence = {};
        }
        if (!metadata.confidence[groupId]) {
            metadata.confidence[groupId] = {};
        }

        const current = metadata.confidence[groupId][chunkId] || { level: 0, nextReview: null };

        if (isCorrect) {
            // Increase confidence, max 5
            current.level = Math.min(5, current.level + 1);
            // Next review in days: 1, 2, 4, 7, 14, 30
            const intervals = [1, 2, 4, 7, 14, 30];
            const daysUntilNext = intervals[Math.min(current.level, 5)];
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + daysUntilNext);
            current.nextReview = nextDate.toISOString().split('T')[0];
        } else {
            // Reset confidence on wrong answer
            current.level = Math.max(0, current.level - 2);
            // Review tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            current.nextReview = tomorrow.toISOString().split('T')[0];
        }

        current.lastReviewed = new Date().toISOString().split('T')[0];
        metadata.confidence[groupId][chunkId] = current;
        saveMetadata(metadata);

        res.json({ success: true, confidence: current });
    } catch (err) {
        console.error('POST /api/confidence error:', err);
        res.status(500).json({ error: 'Failed to update confidence' });
    }
});

// Confidence API - Get all confidence data for a group
app.get('/api/confidence/:groupId', (req, res) => {
    try {
        const { groupId } = req.params;
        const metadata = getMetadata();
        res.json(metadata.confidence?.[groupId] || {});
    } catch (err) {
        console.error('GET /api/confidence error:', err);
        res.status(500).json({ error: 'Failed to get confidence data' });
    }
});

app.listen(PORT, () => {
    console.log(`Persistence server running at http://localhost:${PORT}`);
});
