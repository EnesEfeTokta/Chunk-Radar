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

// Helper: Ensure default group exists
const ensureDefaultGroup = () => {
    const metadataPath = path.join(DATA_DIR, 'metadata.json');
    let groups = readJSON(metadataPath, null);

    if (!groups || groups.length === 0) {
        // First time initialization
        groups = [{ id: 'default', name: 'Günlük Popüler', file: 'chunks.json' }];
        writeJSON(metadataPath, groups);

        // Ensure default chunks file exists
        const chunksPath = path.join(DATA_DIR, 'chunks.json');
        if (!fs.existsSync(chunksPath)) {
            writeJSON(chunksPath, []);
        }
    }
    return groups;
};

// Get all groups
app.get('/api/groups', (req, res) => {
    try {
        const groups = ensureDefaultGroup();
        res.json(groups);
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
        // Ensure ID is unique
        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        let groups = readJSON(metadataPath, []);

        if (groups.find(g => g.id === id)) {
            return res.status(400).json({ error: 'Group already exists' });
        }

        const filename = `${id}.json`;
        const newGroupPath = path.join(DATA_DIR, filename);

        const newGroup = { id, name, file: filename };
        groups.push(newGroup);

        writeJSON(metadataPath, groups);
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

        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        let groups = readJSON(metadataPath, []);
        const groupIdx = groups.findIndex(g => g.id === id);

        if (groupIdx === -1) return res.status(404).json({ error: 'Group not found' });

        groups[groupIdx].name = name;
        writeJSON(metadataPath, groups);

        res.json(groups[groupIdx]);
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

        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        let groups = readJSON(metadataPath, []);
        const group = groups.find(g => g.id === id);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Don't delete chunks.json (the default one)
        if (group.file !== 'chunks.json') {
            const groupFilePath = path.join(DATA_DIR, group.file);
            if (fs.existsSync(groupFilePath)) {
                try {
                    fs.unlinkSync(groupFilePath);
                } catch (e) {
                    console.error('Failed to delete group file:', e);
                }
            }
        }

        groups = groups.filter(g => g.id !== id);
        writeJSON(metadataPath, groups);

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
        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        const groups = readJSON(metadataPath, []);
        const group = groups.find(g => g.id === groupId);

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

        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        const groups = readJSON(metadataPath, []);
        const group = groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        let chunks = readJSON(groupFilePath, []);
        // Note: chunkId comes as string from params, stored as number usually
        const chunkIdx = chunks.findIndex(c => c.id == chunkId);

        if (chunkIdx === -1) return res.status(404).json({ error: 'Chunk not found' });

        chunks[chunkIdx] = { ...chunks[chunkIdx], ...chunk };
        writeJSON(groupFilePath, chunks);
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

        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        const groups = readJSON(metadataPath, []);
        const group = groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        let chunks = readJSON(groupFilePath, []);
        chunks = chunks.filter(c => c.id != chunkId);

        writeJSON(groupFilePath, chunks);
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
        const metadataPath = path.join(DATA_DIR, 'metadata.json');
        const groups = readJSON(metadataPath, []);
        const group = groups.find(g => g.id === groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const groupFilePath = path.join(DATA_DIR, group.file);
        const chunks = readJSON(groupFilePath, []);
        res.json(chunks);
    } catch (err) {
        console.error('GET /api/chunks error:', err);
        res.status(500).json({ error: 'Failed to read chunks' });
    }
});

// Stats API
app.get('/api/stats', (req, res) => {
    try {
        const statsPath = path.join(DATA_DIR, 'stats.json');
        const stats = readJSON(statsPath, []);
        res.json(stats);
    } catch (err) {
        console.error('GET /api/stats error:', err);
        res.status(500).json({ error: 'Failed to read stats' });
    }
});

app.post('/api/stats', (req, res) => {
    try {
        const { correct, wrong } = req.body;
        const date = new Date().toISOString().split('T')[0];
        const statsPath = path.join(DATA_DIR, 'stats.json');

        let stats = readJSON(statsPath, []);

        const todayIdx = stats.findIndex(s => s.date === date);
        if (todayIdx !== -1) {
            stats[todayIdx].correct += correct;
            stats[todayIdx].wrong += wrong;
            stats[todayIdx].total += (correct + wrong);
        } else {
            stats.push({ date, correct, wrong, total: correct + wrong });
        }

        // Keep only last 30 days
        if (stats.length > 30) stats.shift();

        writeJSON(statsPath, stats);
        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/stats error:', err);
        res.status(500).json({ error: 'Failed to save stats' });
    }
});

app.listen(PORT, () => {
    console.log(`Persistence server running at http://localhost:${PORT}`);
});
