import { useState, useEffect, useCallback } from 'react';
import './index.css';

// Types
import type {
    Chunk, Group, ChunkStatus, ChunkProgress, StreakInfo,
    Settings, ConfidenceData, Story, FocusMode, PracticeSentence
} from './types';

// Utils
import { speak, speakSequence, formatTime } from './utils';

// API
import * as API from './api';

// Components
import { StoryList, StoryReader, StoryModal } from './components/Story';
import { ViewTabs } from './components/Navigation';

function App() {
    // === STATE ===
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('default');
    const [sessionChunks, setSessionChunks] = useState<Chunk[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [progress, setProgress] = useState<ChunkProgress[]>([]);
    const [isFinished, setIsFinished] = useState(false);

    // Timer states
    const [sessionStartTime] = useState(Date.now());
    const [sessionElapsed, setSessionElapsed] = useState(0);
    const [cardStartTime, setCardStartTime] = useState(Date.now());
    const [cardElapsed, setCardElapsed] = useState(0);

    // Modals
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);
    const [showChunkModal, setShowChunkModal] = useState(false);
    const [showEditChunkModal, setShowEditChunkModal] = useState<Chunk | null>(null);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // Feature states
    const [streakInfo, setStreakInfo] = useState<StreakInfo>({
        currentStreak: 0, longestStreak: 0, todayCount: 0, dailyGoal: 20, goalReached: false
    });
    const [settings, setSettings] = useState<Settings>({
        dailyGoal: 20, ttsSpeed: 0.85, ttsVoice: 'en-US'
    });
    const [focusMode, setFocusMode] = useState<FocusMode>('all');
    const [confidence, setConfidence] = useState<Record<number, ConfidenceData>>({});

    // Story states
    const [stories, setStories] = useState<Story[]>([]);
    const [currentView, setCurrentView] = useState<'flashcards' | 'stories'>('flashcards');
    const [selectedStory, setSelectedStory] = useState<Story | null>(null);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [editingStory, setEditingStory] = useState<Story | null>(null);

    const [showConfetti, setShowConfetti] = useState(false);
    const [showSpeechPractice, setShowSpeechPractice] = useState(false);

    // === DATA LOADING ===
    const loadGroups = async () => {
        const data = await API.fetchGroups();
        setGroups(data);
        if (data.length > 0) {
            const currentStillExists = data.find(g => g.id === selectedGroupId);
            if (!currentStillExists) {
                const defaultGroup = data.find(g => g.id === 'default');
                setSelectedGroupId(defaultGroup ? defaultGroup.id : data[0].id);
            }
        } else {
            setSelectedGroupId('');
        }
    };

    const loadChunks = useCallback(async (groupId: string) => {
        if (!groupId) return;

        const data = await API.fetchChunks(groupId);
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setSessionChunks(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsFinished(false);

        // Load persisted progress
        const persistedProgress = await API.fetchProgress(groupId);
        setProgress(shuffled.map(c => ({
            chunkId: c.id,
            status: (persistedProgress[c.id] as ChunkStatus) || 'unreviewed'
        })));

        setCardStartTime(Date.now());
    }, []);

    const loadStories = async () => {
        const data = await API.fetchStories();
        setStories(data);
    };

    const loadSettings = async () => {
        const data = await API.fetchSettings();
        setSettings(data);
    };

    const loadStreak = async () => {
        const data = await API.fetchStreak();
        setStreakInfo(data);
    };

    // Initial load
    useEffect(() => {
        loadGroups();
        loadStories();
        loadSettings();
        loadStreak();
    }, []);

    // Load chunks when group changes
    useEffect(() => {
        if (selectedGroupId) {
            loadChunks(selectedGroupId);
        }
    }, [selectedGroupId, loadChunks]);

    // === STORY HANDLERS ===
    const handleSaveStory = async (storyData: Partial<Story>) => {
        if (editingStory) {
            await API.updateStory(editingStory.id, storyData);
        } else {
            await API.createStory(storyData);
        }
        await loadStories();
        setShowStoryModal(false);
        setEditingStory(null);
    };

    const handleDeleteStory = async (id: number) => {
        await API.deleteStory(id);
        await loadStories();
    };

    const handleEditStory = (story: Story) => {
        setEditingStory(story);
        setShowStoryModal(true);
    };

    const handleAddStory = () => {
        setEditingStory(null);
        setShowStoryModal(true);
    };

    // === ANSWER HANDLER ===
    const handleAnswer = (status: ChunkStatus) => {
        const newProgress = [...progress];
        newProgress[currentIndex].status = status;
        setProgress(newProgress);

        const currentChunkId = sessionChunks[currentIndex].id;
        API.saveProgress(selectedGroupId, currentChunkId, status);

        if (status === 'correct' || status === 'wrong') {
            API.updateConfidence(selectedGroupId, currentChunkId, status === 'correct');
        }

        if (status === 'correct') {
            API.saveStats(1, 0);
        } else if (status === 'wrong') {
            API.saveStats(0, 1);
        }

        loadStreak();

        if (currentIndex + 1 < sessionChunks.length) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
            setCardStartTime(Date.now());
        } else {
            setIsFinished(true);
            if (streakInfo.goalReached) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 5000);
            }
        }
    };

    // === RENDER ===
    return (
        <div className="container">
            {/* Confetti */}
            {showConfetti && (
                <div className="confetti-container">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="confetti"
                            style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }}
                        />
                    ))}
                </div>
            )}

            {/* Top Nav */}
            <nav className="top-nav-modern">
                <div className="nav-left">
                    <h1 className="logo-text-nav" onClick={() => window.location.reload()}>
                        Chunk <span className="accent">Radar</span>
                    </h1>
                    <div className="timer-display">⏱️ Oturum: {formatTime(sessionElapsed)}</div>
                    <div className="streak-display">
                        🔥 {streakInfo.currentStreak} gün
                        <span className="streak-progress">
                            ({streakInfo.todayCount}/{streakInfo.dailyGoal})
                        </span>
                    </div>
                </div>
            </nav>

            {/* View Tabs */}
            <ViewTabs currentView={currentView} onChange={setCurrentView} />

            {/* Content */}
            {currentView === 'stories' ? (
                // Story View
                selectedStory ? (
                    <StoryReader
                        story={selectedStory}
                        onBack={() => setSelectedStory(null)}
                    />
                ) : (
                    <StoryList
                        stories={stories}
                        onSelect={setSelectedStory}
                        onEdit={handleEditStory}
                        onDelete={handleDeleteStory}
                        onAdd={handleAddStory}
                    />
                )
            ) : (
                // Flashcards View (Original App.tsx content will go here)
                <div>
                    <h2>Flashcards görünümü yakında gelecek</h2>
                    <p>Eski App.tsx içeriği buraya taşınacak</p>
                </div>
            )}

            {/* Story Modal */}
            {showStoryModal && (
                <StoryModal
                    story={editingStory}
                    onClose={() => {
                        setShowStoryModal(false);
                        setEditingStory(null);
                    }}
                    onSave={handleSaveStory}
                />
            )}
        </div>
    );
}

export default App;
