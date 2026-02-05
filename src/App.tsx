import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import './index.css'

// Components
import { StoryList, StoryReader, StoryModal } from './components/Story';

interface Chunk {
    id: number;
    english: string;
    turkish: string;
    examples: string[];
    exampleTranslations?: string[];
}

interface Group {
    id: string;
    name: string;
    file: string;
}

interface DayStat {
    date: string;
    correct: number;
    wrong: number;
    total: number;
}

type ChunkStatus = 'unreviewed' | 'correct' | 'wrong' | 'skipped';

interface ChunkProgress {
    chunkId: number;
    status: ChunkStatus;
}

interface StreakInfo {
    currentStreak: number;
    longestStreak: number;
    todayCount: number;
    dailyGoal: number;
    goalReached: boolean;
}

interface Settings {
    dailyGoal: number;
    ttsSpeed: number;
    ttsVoice: string;
}

interface ConfidenceData {
    level: number;
    nextReview: string | null;
    lastReviewed?: string;
}

interface Story {
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

type FocusMode = 'all' | 'wrong' | 'skipped' | 'review';

const speak = (text: string, rate: number = 0.85, voice: string = 'en-US') => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        voice === 'en-GB'
            ? v.lang === 'en-GB' || v.name.includes('British')
            : v.name.includes('Google US English') || v.name.includes('Samantha') || v.lang === 'en-US'
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.lang = voice;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
};

const speakSequence = async (texts: string[], rate: number = 0.85, voice: string = 'en-US') => {
    for (const text of texts) {
        await new Promise<void>((resolve) => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v =>
                voice === 'en-GB'
                    ? v.lang === 'en-GB' || v.name.includes('British')
                    : v.name.includes('Google US English') || v.name.includes('Samantha') || v.lang === 'en-US'
            );
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.lang = voice;
            utterance.rate = rate;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
    }
};

function StatisticsDashboard({ onClose }: { onClose: () => void }) {
    const [stats, setStats] = useState<DayStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/stats')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch stats');
                return res.json();
            })
            .then(data => {
                setStats(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setStats([]);
                setLoading(false);
            });
    }, []);

    const chartData = useMemo(() => {
        if (stats.length === 0) return null;
        const max = Math.max(...stats.map(s => s.total), 10);
        const width = 400;
        const height = 150;
        const padding = 20;

        const points = stats.map((s, i) => {
            const x = (i / (stats.length - 1 || 1)) * (width - padding * 2) + padding;
            const yCorrect = height - ((s.correct / max) * (height - padding * 2) + padding);
            const yTotal = height - ((s.total / max) * (height - padding * 2) + padding);
            return { x, yCorrect, yTotal, date: s.date, correct: s.correct, total: s.total };
        });

        return { points, width, height, padding };
    }, [stats]);

    return (
        <div className="modal-overlay">
            <div className="modal-content stats-modal">
                <div className="modal-header">
                    <h2>Çalışma İstatistikleri</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                {loading ? <p>Yükleniyor...</p> : stats.length === 0 ? <p>Henüz veri yok. Çalışmaya başla!</p> : (
                    <div className="stats-container">
                        <div className="chart-wrapper">
                            <svg viewBox={`0 0 ${chartData?.width} ${chartData?.height}`} className="stats-svg">
                                {[0, 0.5, 1].map(v => (
                                    <line
                                        key={v}
                                        x1="20" y1={20 + v * 110}
                                        x2="380" y2={20 + v * 110}
                                        stroke="var(--glass-border)"
                                        strokeWidth="1"
                                        strokeDasharray="4"
                                    />
                                ))}

                                <path
                                    d={`M ${chartData?.points.map(p => `${p.x},${p.yTotal}`).join(' L ')}`}
                                    fill="none"
                                    stroke="var(--glass-border)"
                                    strokeWidth="2"
                                />

                                <path
                                    d={`M ${chartData?.points.map(p => `${p.x},${p.yCorrect}`).join(' L ')}`}
                                    fill="none"
                                    stroke="var(--accent-primary)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {chartData?.points.map((p, i) => (
                                    <g key={i} className="chart-point">
                                        <circle cx={p.x} cy={p.yCorrect} r="4" fill="var(--accent-primary)" />
                                        <title>{`${p.date}: ${p.correct} Doğru / ${p.total} Toplam`}</title>
                                    </g>
                                ))}
                            </svg>
                        </div>

                        <div className="stats-summary-grid">
                            <div className="summary-card">
                                <span className="summary-label">Toplam Doğru</span>
                                <span className="summary-value text-correct">{stats.reduce((acc, s) => acc + s.correct, 0)}</span>
                            </div>
                            <div className="summary-card">
                                <span className="summary-label">Başarı Oranı</span>
                                <span className="summary-value">
                                    %{Math.round((stats.reduce((acc, s) => acc + s.correct, 0) / (stats.reduce((acc, s) => acc + s.total, 0) || 1)) * 100)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Speech Practice Modal with Web Speech Recognition
interface PracticeSentence {
    english: string;
    turkish: string;
}

function SpeechPracticeModal({
    sentences,
    onClose,
    ttsSpeed = 0.85,
    ttsVoice = 'en-US'
}: {
    sentences: PracticeSentence[];
    onClose: () => void;
    ttsSpeed?: number;
    ttsVoice?: string;
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState<'ready' | 'listening' | 'countdown' | 'result'>('ready');
    const [countdown, setCountdown] = useState(3);
    const [spokenText, setSpokenText] = useState('');
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState({ correct: 0, wrong: 0 });
    const [isFinished, setIsFinished] = useState(false);

    const currentSentence = sentences[currentIndex];

    // Normalize text for comparison
    const normalizeText = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[.,!?;:'"]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Calculate similarity between two strings
    const calculateSimilarity = (str1: string, str2: string): number => {
        const s1 = normalizeText(str1);
        const s2 = normalizeText(str2);

        if (s1 === s2) return 1;

        const words1 = s1.split(' ');
        const words2 = s2.split(' ');
        const commonWords = words1.filter(w => words2.includes(w));

        return commonWords.length / Math.max(words1.length, words2.length);
    };

    // Start practice - TTS reads the sentence, then countdown
    const startPractice = async () => {
        setPhase('ready');
        setSpokenText('');

        // Read the sentence aloud
        await new Promise<void>((resolve) => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(currentSentence.english);
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v =>
                ttsVoice === 'en-GB'
                    ? v.lang === 'en-GB' || v.name.includes('British')
                    : v.name.includes('Google US English') || v.name.includes('Samantha') || v.lang === 'en-US'
            );
            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.lang = ttsVoice;
            utterance.rate = ttsSpeed;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });

        // Start countdown
        setPhase('countdown');
        setCountdown(3);

        for (let i = 3; i >= 1; i--) {
            setCountdown(i);
            await new Promise(r => setTimeout(r, 1000));
        }

        // Start listening
        startListening();
    };

    // Start speech recognition
    const startListening = () => {
        setPhase('listening');
        setSpokenText('');

        // Check for browser support
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert('Tarayıcınız ses tanıma desteklemiyor. Chrome kullanmayı deneyin.');
            setPhase('ready');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        let finalTranscript = '';

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0].transcript)
                .join('');
            finalTranscript = transcript;
            setSpokenText(transcript);
        };

        recognition.onend = () => {
            setPhase('result');
            // Check if correct (at least 80% similarity)
            const similarity = calculateSimilarity(finalTranscript || '', currentSentence.english);
            const correct = similarity >= 0.7;
            setIsCorrect(correct);

            if (correct) {
                setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
            } else {
                setScore(prev => ({ ...prev, wrong: prev.wrong + 1 }));
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setPhase('result');
            setIsCorrect(false);
            setScore(prev => ({ ...prev, wrong: prev.wrong + 1 }));
        };

        recognition.start();

        // Auto-stop after 8 seconds
        setTimeout(() => {
            try {
                recognition.stop();
            } catch {
                // Already stopped
            }
        }, 8000);
    };

    // Move to next sentence or retry
    const handleNext = () => {
        if (currentIndex + 1 < sentences.length) {
            setCurrentIndex(currentIndex + 1);
            setPhase('ready');
            setSpokenText('');
        } else {
            setIsFinished(true);
        }
    };

    const handleRetry = () => {
        setPhase('ready');
        setSpokenText('');
        startPractice();
    };

    if (isFinished) {
        return (
            <div className="modal-overlay">
                <div className="modal-content speech-modal">
                    <div className="modal-header">
                        <h2>🎉 Pratik Tamamlandı!</h2>
                        <button className="close-btn" onClick={onClose}>&times;</button>
                    </div>
                    <div className="speech-finish">
                        <div className="speech-score">
                            <div className="score-item correct">
                                <span className="score-label">Doğru</span>
                                <span className="score-value">{score.correct}</span>
                            </div>
                            <div className="score-item wrong">
                                <span className="score-label">Yanlış</span>
                                <span className="score-value">{score.wrong}</span>
                            </div>
                        </div>
                        <div className="speech-accuracy">
                            Başarı: %{Math.round((score.correct / (score.correct + score.wrong || 1)) * 100)}
                        </div>
                        <button className="btn btn-primary" onClick={onClose}>Kapat</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content speech-modal">
                <div className="modal-header">
                    <h2>🎤 Konuşma Pratiği</h2>
                    <span className="speech-progress">{currentIndex + 1} / {sentences.length}</span>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="speech-content">
                    {/* Sentence Display */}
                    <div className="speech-sentence">
                        <p className="sentence-english">{currentSentence.english}</p>
                        {phase === 'result' && isCorrect && (
                            <p className="sentence-turkish">{currentSentence.turkish}</p>
                        )}
                    </div>

                    {/* Phase Content */}
                    {phase === 'ready' && (
                        <div className="speech-action">
                            <p className="speech-hint">Cümleyi dinle ve ardından tekrarla!</p>
                            <button className="btn btn-primary speech-start-btn" onClick={startPractice}>
                                ▶️ Başla
                            </button>
                        </div>
                    )}

                    {phase === 'countdown' && (
                        <div className="speech-countdown">
                            <div className="countdown-number">{countdown}</div>
                            <p>Hazırlan...</p>
                        </div>
                    )}

                    {phase === 'listening' && (
                        <div className="speech-listening">
                            <div className="mic-indicator">
                                <div className="mic-pulse"></div>
                                🎤
                            </div>
                            <p className="listening-text">Dinleniyor...</p>
                            {spokenText && (
                                <p className="spoken-text">"{spokenText}"</p>
                            )}
                        </div>
                    )}

                    {phase === 'result' && (
                        <div className={`speech-result ${isCorrect ? 'correct' : 'wrong'}`}>
                            <div className="result-icon">
                                {isCorrect ? '✅' : '❌'}
                            </div>
                            <h3>{isCorrect ? 'Doğru!' : 'Tekrar Dene!'}</h3>
                            {spokenText && (
                                <p className="your-answer">Sen: "{spokenText}"</p>
                            )}
                            <div className="result-actions">
                                {!isCorrect && (
                                    <button className="btn btn-wrong" onClick={handleRetry}>🔄 Tekrar</button>
                                )}
                                <button className="btn btn-correct" onClick={handleNext}>
                                    {currentIndex + 1 < sentences.length ? 'Sonraki →' : 'Bitir'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EditGroupModal({ group, onClose, onSuccess }: { group: Group; onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState(group.name);
    const [loading, setLoading] = useState(false);
    const isDefault = group.id === 'default';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`/api/groups/${group.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Grup güncellenemedi.');
            }
        } catch (err) {
            console.error(err);
            alert('Network hatası.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Bu grubu ve içindeki tüm chunk\'ları silmek istediğine emin misin?')) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Grup silinemedi.');
            }
        } catch (err) {
            console.error(err);
            alert('Network hatası.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Grubu Düzenle</h2>
                <form onSubmit={handleSubmit} className="modal-form">
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        autoFocus
                    />
                    <div className="modal-actions">
                        {!isDefault && (
                            <button type="button" className="btn btn-wrong" onClick={handleDelete} disabled={loading}>Grubu Sil</button>
                        )}
                        <div style={{ flex: 1 }} />
                        <button type="button" className="btn btn-secondary" onClick={onClose}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>Güncelle</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditChunkModal({ groupId, chunk, onClose, onSuccess }: { groupId: string; chunk: Chunk; onClose: () => void; onSuccess: () => void }) {
    const [english, setEnglish] = useState(chunk.english);
    const [turkish, setTurkish] = useState(chunk.turkish);
    const [examples, setExamples] = useState([...chunk.examples, '', '', ''].slice(0, 3));
    const [exampleTranslations, setExampleTranslations] = useState([...(chunk.exampleTranslations || []), '', '', ''].slice(0, 3));
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const filteredExamples = examples.filter(ex => ex.trim() !== '');
            const filteredTranslations = exampleTranslations.slice(0, filteredExamples.length);

            const res = await fetch(`/api/chunks/${groupId}/${chunk.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chunk: {
                        english,
                        turkish,
                        examples: filteredExamples,
                        exampleTranslations: filteredTranslations
                    }
                }),
            });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Chunk güncellenemedi.');
            }
        } catch (err) {
            console.error(err);
            alert('Network hatası.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Bu chunk\'ı silmek istediğine emin misin?')) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/chunks/${groupId}/${chunk.id}`, { method: 'DELETE' });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Chunk silinemedi.');
            }
        } catch (err) {
            console.error(err);
            alert('Network hatası.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content modal-large">
                <h2>Chunk Düzenle</h2>
                <form onSubmit={handleSubmit} className="modal-form">
                    <input placeholder="İngilizce" value={english} onChange={e => setEnglish(e.target.value)} required />
                    <input placeholder="Türkçe" value={turkish} onChange={e => setTurkish(e.target.value)} required />

                    <div className="examples-section">
                        <label className="section-label">Örnek Cümleler</label>
                        {examples.map((ex, i) => (
                            <div key={i} className="example-row">
                                <input
                                    placeholder={`İngilizce Örnek ${i + 1}`}
                                    value={ex}
                                    onChange={e => {
                                        const newExs = [...examples];
                                        newExs[i] = e.target.value;
                                        setExamples(newExs);
                                    }}
                                />
                                <input
                                    placeholder={`Türkçe Çeviri ${i + 1}`}
                                    value={exampleTranslations[i]}
                                    onChange={e => {
                                        const newTrans = [...exampleTranslations];
                                        newTrans[i] = e.target.value;
                                        setExampleTranslations(newTrans);
                                    }}
                                    className="translation-input"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-wrong" onClick={handleDelete} disabled={loading}>Sil</button>
                        <div style={{ flex: 1 }} />
                        <button type="button" className="btn btn-secondary" onClick={onClose}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>Güncelle</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CreateGroupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                const d = await res.json();
                alert(d.error || 'Grup oluşturulamadı.');
            }
        } catch (err) {
            console.error(err);
            alert('Network hatası.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Yeni Grup Oluştur</h2>
                <form onSubmit={handleSubmit} className="modal-form">
                    <input
                        type="text"
                        placeholder="Grup Adı (örn: Top 200)"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        autoFocus
                    />
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>Oluştur</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddChunkModal({ groupId, onClose, onSuccess }: { groupId: string; onClose: () => void; onSuccess: () => void }) {
    const [english, setEnglish] = useState('');
    const [turkish, setTurkish] = useState('');
    const [examples, setExamples] = useState(['', '', '']);
    const [exampleTranslations, setExampleTranslations] = useState(['', '', '']);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const filteredExamples = examples.filter(ex => ex.trim() !== '');
            const filteredTranslations = exampleTranslations.slice(0, filteredExamples.length);

            const res = await fetch('/api/chunks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId,
                    chunk: {
                        english,
                        turkish,
                        examples: filteredExamples,
                        exampleTranslations: filteredTranslations
                    }
                }),
            });
            if (res.ok) {
                onSuccess();
                onClose();
            } else {
                alert('Chunk eklenemedi.');
            }
        } catch (err) {
            console.error(err);
            alert('Network hatası.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content modal-large">
                <h2>Yeni Chunk Ekle</h2>
                <form onSubmit={handleSubmit} className="modal-form">
                    <input placeholder="İngilizce (Chunk)" value={english} onChange={e => setEnglish(e.target.value)} required />
                    <input placeholder="Türkçe Karşılığı" value={turkish} onChange={e => setTurkish(e.target.value)} required />

                    <div className="examples-section">
                        <label className="section-label">Örnek Cümleler</label>
                        {examples.map((ex, i) => (
                            <div key={i} className="example-row">
                                <input
                                    placeholder={`İngilizce Örnek ${i + 1}`}
                                    value={ex}
                                    onChange={e => {
                                        const newExs = [...examples];
                                        newExs[i] = e.target.value;
                                        setExamples(newExs);
                                    }}
                                />
                                <input
                                    placeholder={`Türkçe Çeviri ${i + 1}`}
                                    value={exampleTranslations[i]}
                                    onChange={e => {
                                        const newTrans = [...exampleTranslations];
                                        newTrans[i] = e.target.value;
                                        setExampleTranslations(newTrans);
                                    }}
                                    className="translation-input"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>İptal</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>Ekle</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function FlashCard({ chunk, isFlipped, onSingleClick, onDoubleClick, onEdit, cardElapsed, formatTime, ttsSpeed = 0.85, ttsVoice = 'en-US' }: {
    chunk: Chunk;
    isFlipped: boolean;
    onSingleClick: () => void;
    onDoubleClick: () => void;
    onEdit: () => void;
    cardElapsed: number;
    formatTime: (seconds: number) => string;
    ttsSpeed?: number;
    ttsVoice?: string;
}) {
    const [lastClickTime, setLastClickTime] = useState(0);
    const [hoveredExample, setHoveredExample] = useState<number | null>(null);
    const hoverTimerRef = useRef<number | null>(null);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
        };
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        // Don't trigger if clicking edit or speaker buttons
        if ((e.target as HTMLElement).closest('.edit-chunk-btn, .tts-btn-small, .tts-all-btn')) {
            return;
        }

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;

        if (timeSinceLastClick < 300) {
            // Double click
            onDoubleClick();
            setLastClickTime(0); // Reset to avoid triple-click
        } else {
            // Single click - wait a bit to distinguish from double click
            setTimeout(() => {
                if (Date.now() - now > 250) {
                    onSingleClick();
                }
            }, 250);
            setLastClickTime(now);
        }
    };

    const handleReadAll = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await speakSequence([chunk.english, ...chunk.examples], ttsSpeed, ttsVoice);
    };

    const handleExampleEnter = (idx: number, text: string) => {
        // Clear any existing timer
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
        }

        // Start 1 second delay timer
        hoverTimerRef.current = setTimeout(async () => {
            // Play TTS first
            await speak(text, ttsSpeed, ttsVoice);
            // Then flip
            setHoveredExample(idx);
            // Clear timer reference
            hoverTimerRef.current = null;
        }, 1000);
    };

    const handleExampleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only reset if actually leaving the element (not just entering child pseudo-element)
        const relatedTarget = e.relatedTarget as HTMLElement;
        const currentTarget = e.currentTarget as HTMLElement;

        // If related target is a child of current target, ignore (still inside)
        if (relatedTarget && currentTarget.contains(relatedTarget)) {
            return;
        }

        // Cancel timer if still running
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        // Reset flip
        setHoveredExample(null);
    };

    return (
        <div className={`flash-card-container ${isFlipped ? 'flipped' : ''}`} onClick={handleClick}>
            {/* Controls outside the rotating card */}
            <button className="card-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎ Düzenle</button>
            <div className="card-timer">⏱️ {formatTime(cardElapsed)}</div>

            <div className="flash-card">
                <div className="card-face card-front">
                    <h2 className="chunk-english">{chunk.english}</h2>
                    <p className="tap-hint">{isFlipped ? 'Tekrar görmek için tıkla' : 'Çevirmek için çift tıkla'}</p>
                </div>
                <div className="card-face card-back">
                    <span className="chunk-turkish-back">{chunk.turkish}</span>
                    <div className="examples-list-back">
                        {chunk.examples.map((example, idx) => (
                            <div
                                key={idx}
                                className="example-item-back"
                                onMouseEnter={() => handleExampleEnter(idx, example)}
                                onMouseLeave={handleExampleLeave}
                                onClick={(e) => { e.stopPropagation(); speak(example, ttsSpeed, ttsVoice); }}
                            >
                                <div className="example-english">{example}</div>
                                {hoveredExample === idx && (
                                    <div className="example-turkish-inline">
                                        {chunk.exampleTranslations?.[idx] || ''}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <button className="tts-btn-small" onClick={handleReadAll}>🔊 Tümünü Oku</button>
                </div>
            </div>
        </div>
    );
}

function App() {
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

    // New Feature States
    const [streakInfo, setStreakInfo] = useState<StreakInfo>({ currentStreak: 0, longestStreak: 0, todayCount: 0, dailyGoal: 20, goalReached: false });
    const [settings, setSettings] = useState<Settings>({ dailyGoal: 20, ttsSpeed: 0.85, ttsVoice: 'en-US' });
    const [focusMode, setFocusMode] = useState<FocusMode>('all');
    const [confidence, setConfidence] = useState<Record<number, ConfidenceData>>({});

    // Story States
    const [stories, setStories] = useState<Story[]>([]);
    const [currentView, setCurrentView] = useState<'flashcards' | 'stories'>('flashcards');
    const [selectedStory, setSelectedStory] = useState<Story | null>(null);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showSpeechPractice, setShowSpeechPractice] = useState(false);

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            setGroups(data);
            if (data.length > 0) {
                const currentStillExists = data.find((g: Group) => g.id === selectedGroupId);
                if (!currentStillExists) {
                    const defaultGroup = data.find((g: Group) => g.id === 'default');
                    setSelectedGroupId(defaultGroup ? defaultGroup.id : data[0].id);
                }
            } else {
                setSelectedGroupId('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const loadProgress = async (groupId: string) => {
        try {
            const res = await fetch(`/api/progress/${groupId}`);
            if (res.ok) {
                const data = await res.json();
                return data;
            }
        } catch (err) {
            console.error('Failed to load progress:', err);
        }
        return {};
    };

    const saveProgress = async (groupId: string, chunkId: number, status: ChunkStatus) => {
        try {
            await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, chunkId, status }),
            });
        } catch (err) {
            console.error('Failed to save progress:', err);
        }
    };

    const resetProgress = async (groupId: string) => {
        try {
            await fetch(`/api/progress/${groupId}`, { method: 'DELETE' });
            // Reload chunks to reset UI
            await fetchChunks(groupId);
        } catch (err) {
            console.error('Failed to reset progress:', err);
        }
    };

    const fetchChunks = useCallback(async (groupId: string) => {
        if (!groupId) return;

        try {
            const res = await fetch(`/api/chunks/${groupId}`);
            if (res.ok) {
                const data = await res.json();
                const chunksToUse = Array.isArray(data) ? data : [];

                const shuffled = [...chunksToUse].sort(() => Math.random() - 0.5);
                setSessionChunks(shuffled);
                setCurrentIndex(0);
                setIsFlipped(false);
                setIsFinished(false);

                // Load persisted progress
                const persistedProgress = await loadProgress(groupId);
                setProgress(shuffled.map(c => ({
                    chunkId: c.id,
                    status: (persistedProgress[c.id] as ChunkStatus) || 'unreviewed'
                })));

                // Reset card timer
                setCardStartTime(Date.now());
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    const saveStats = async (correct: number, wrong: number) => {
        try {
            await fetch('/api/stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correct, wrong }),
            });
        } catch (err) {
            console.error(err);
        }
    };

    // Fetch settings
    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    };

    // Fetch streak info
    const fetchStreak = async () => {
        try {
            const res = await fetch('/api/streak');
            if (res.ok) {
                const data = await res.json();
                const wasNotReached = !streakInfo.goalReached;
                setStreakInfo(data);
                // Show confetti when goal just reached
                if (data.goalReached && wasNotReached) {
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 3000);
                }
            }
        } catch (err) {
            console.error('Failed to load streak:', err);
        }
    };

    // === STORY FUNCTIONS ===
    const fetchStories = async () => {
        try {
            const res = await fetch('/api/stories');
            if (res.ok) {
                const data = await res.json();
                setStories(data);
            }
        } catch (err) {
            console.error('Failed to load stories:', err);
        }
    };

    const handleAddStory = () => {
        setEditingStory(null);
        setShowStoryModal(true);
    };

    const handleEditStory = (story: Story) => {
        setEditingStory(story);
        setShowStoryModal(true);
    };

    const handleSaveStory = async (story: Partial<Story>) => {
        try {
            if (editingStory) {
                // Update existing
                const res = await fetch(`/api/stories/${editingStory.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(story),
                });
                if (res.ok) {
                    await fetchStories();
                }
            } else {
                // Create new
                const res = await fetch('/api/stories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(story),
                });
                if (res.ok) {
                    await fetchStories();
                }
            }
        } catch (err) {
            console.error('Failed to save story:', err);
        }
    };

    const handleDeleteStory = async (id: number) => {
        if (!confirm('Bu hikayeyi silmek istediğinize emin misiniz?')) return;
        try {
            const res = await fetch(`/api/stories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchStories();
            }
        } catch (err) {
            console.error('Failed to delete story:', err);
        }
    };


    // Fetch confidence data for a group
    const fetchConfidence = async (groupId: string) => {
        try {
            const res = await fetch(`/api/confidence/${groupId}`);
            if (res.ok) {
                const data = await res.json();
                setConfidence(data);
            }
        } catch (err) {
            console.error('Failed to load confidence:', err);
        }
    };

    // Update confidence after answer
    const updateConfidence = async (chunkId: number, isCorrect: boolean) => {
        try {
            await fetch('/api/confidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: selectedGroupId, chunkId, isCorrect }),
            });
        } catch (err) {
            console.error('Failed to update confidence:', err);
        }
    };

    // Save settings
    const saveSettings = async (newSettings: Partial<Settings>) => {
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings),
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    };

    useEffect(() => {
        fetchGroups();
        fetchSettings();
        fetchStreak();
        fetchStories();
        window.speechSynthesis.getVoices();
    }, []);

    useEffect(() => {
        if (selectedGroupId && groups.length > 0) {
            fetchChunks(selectedGroupId);
            fetchConfidence(selectedGroupId);
        }
    }, [selectedGroupId, fetchChunks, groups]);

    // Timer update effect
    useEffect(() => {
        const interval = setInterval(() => {
            setSessionElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
            setCardElapsed(Math.floor((Date.now() - cardStartTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [sessionStartTime, cardStartTime]);

    // Keyboard shortcuts: A=Wrong, S=Skip, D=Correct
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Only trigger if card is flipped and we're not in a text input
            if (!isFlipped || isFinished) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case 'a':
                    handleAnswer('wrong');
                    break;
                case 's':
                    handleAnswer('skipped');
                    break;
                case 'd':
                    handleAnswer('correct');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isFlipped, isFinished, currentIndex, sessionChunks, progress]);

    const handleAnswer = (status: ChunkStatus) => {
        const newProgress = [...progress];
        newProgress[currentIndex].status = status;
        setProgress(newProgress);

        // Save progress to backend
        const currentChunkId = sessionChunks[currentIndex].id;
        saveProgress(selectedGroupId, currentChunkId, status);

        // Update confidence for spaced repetition
        if (status === 'correct' || status === 'wrong') {
            updateConfidence(currentChunkId, status === 'correct');
        }

        // Record stats
        if (status === 'correct') {
            saveStats(1, 0);
        } else if (status === 'wrong') {
            saveStats(0, 1);
        }

        // Refresh streak after each answer
        fetchStreak();

        if (currentIndex + 1 < sessionChunks.length) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
            // Reset card timer for next card
            setCardStartTime(Date.now());
        } else {
            setIsFinished(true);
        }
    };

    const jumpToCard = (index: number) => {
        setCurrentIndex(index);
        setIsFlipped(false);
        // Reset card timer when jumping to a card
        setCardStartTime(Date.now());
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const currentChunk = sessionChunks[currentIndex];
    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    // Filter chunks based on focus mode
    const filteredChunks = useMemo(() => {
        if (focusMode === 'all') return sessionChunks;

        return sessionChunks.filter((chunk, idx) => {
            const status = progress[idx]?.status;
            const conf = confidence[chunk.id];
            const level = conf ? conf.level : 0; // Treat missing confidence as level 0

            switch (focusMode) {
                case 'wrong':
                    return status === 'wrong';
                case 'skipped':
                    return status === 'skipped';
                case 'review':
                    // Review mode: low confidence (< 3) or wrong/skipped
                    return level < 3 || status === 'wrong' || status === 'skipped';
                default:
                    return true;
            }
        });
    }, [sessionChunks, progress, confidence, focusMode]);

    // Initial load - fetch groups and stories


    // Calculate stats for finish screen
    const correctCount = progress.filter(p => p.status === 'correct').length;
    const wrongCount = progress.filter(p => p.status === 'wrong').length;
    const skippedCount = progress.filter(p => p.status === 'skipped').length;

    // Get sentences for speech practice - collect all examples from current group
    const speechSentences = useMemo(() => {
        const sentences: PracticeSentence[] = [];
        sessionChunks.forEach(chunk => {
            chunk.examples.forEach((example, idx) => {
                sentences.push({
                    english: example,
                    turkish: chunk.exampleTranslations?.[idx] || chunk.turkish
                });
            });
        });
        // Shuffle and limit to 10 sentences
        return sentences.sort(() => Math.random() - 0.5).slice(0, 10);
    }, [sessionChunks]);

    return (
        <div className="container">
            {/* Confetti Animation */}
            {showConfetti && (
                <div className="confetti-container">
                    {[...Array(50)].map((_, i) => (
                        <div key={i} className="confetti" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }} />
                    ))}
                </div>
            )}

            <nav className="top-nav-modern">
                <div className="nav-left">
                    <h1 className="logo-text-nav" onClick={() => window.location.reload()}>Chunk <span className="accent">Radar</span></h1>
                    <div className="timer-display">⏱️ Oturum: {formatTime(sessionElapsed)}</div>
                    <div className="streak-display">
                        🔥 {streakInfo.currentStreak} gün
                        <span className="streak-progress">({streakInfo.todayCount}/{streakInfo.dailyGoal})</span>
                    </div>
                </div>

                <div className="nav-right">
                    <button className="nav-btn speech-practice-btn" onClick={() => setShowSpeechPractice(true)}>🎤 Pratik</button>
                    <button className="nav-btn settings" onClick={() => setShowSettingsModal(true)}>⚙️</button>
                    <button className="nav-btn stats" onClick={() => setShowStatsModal(true)}>📈 İst.</button>
                    <button className="nav-btn secondary" onClick={() => setShowChunkModal(true)}>+ Chunk</button>
                    <button className="nav-btn secondary" onClick={() => setShowGroupModal(true)}>+ Grup</button>
                    {selectedGroup && (
                        <button className="nav-btn secondary" onClick={() => setShowEditGroupModal(true)}>✏️ Düzenle</button>
                    )}
                </div>
            </nav>

            {/* Main View Tabs */}
            <div className="main-view-tabs">
                <button
                    className={`view-tab ${currentView === 'flashcards' ? 'active' : ''}`}
                    onClick={() => setCurrentView('flashcards')}
                >
                    🎴 Flashcards
                </button>
                <button
                    className={`view-tab ${currentView === 'stories' ? 'active' : ''}`}
                    onClick={() => setCurrentView('stories')}
                >
                    📖 Hikayeler
                </button>
            </div>

            {/* Flashcards View */}
            {currentView === 'flashcards' && (
                <>
                    {/* Modern Group Tabs - Keep at top */}
                    <div className="group-tabs-container">
                        <div className="group-tabs">
                            {groups.map(g => (
                                <button
                                    key={g.id}
                                    className={`group-tab ${selectedGroupId === g.id ? 'active' : ''}`}
                                    onClick={() => setSelectedGroupId(g.id)}
                                >
                                    {g.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    {
                        sessionChunks.length > 0 && !isFinished && (
                            <div className="right-panel">
                                {/* Sticky Focus Filter Bar */}
                                <div className="focus-filter-bar">
                                    <button
                                        className={`filter-pill ${focusMode === 'all' ? 'active' : ''}`}
                                        onClick={() => setFocusMode('all')}
                                        title="Tüm chunk'ları göster"
                                    >
                                        Tümü
                                    </button>
                                    <button
                                        className={`filter-pill ${focusMode === 'wrong' ? 'active' : ''}`}
                                        onClick={() => setFocusMode('wrong')}
                                        title="Sadece yanlış yanıtlananlar"
                                    >
                                        ❌ {wrongCount}
                                    </button>
                                    <button
                                        className={`filter-pill ${focusMode === 'skipped' ? 'active' : ''}`}
                                        onClick={() => setFocusMode('skipped')}
                                        title="Sadece atlananlar"
                                    >
                                        ❓ {skippedCount}
                                    </button>
                                    <button
                                        className={`filter-pill ${focusMode === 'review' ? 'active' : ''}`}
                                        onClick={() => setFocusMode('review')}
                                        title="Tekrar edilmesi gerekenler"
                                    >
                                        🔄 {filteredChunks.length}
                                    </button>
                                </div>

                                {/* Chunk Navigator */}
                                <div className="chunk-navigator">
                                    <div className="navigator-header">
                                        <span className="chunk-count">
                                            {focusMode === 'all' ? sessionChunks.length : filteredChunks.length} Chunk
                                            {focusMode !== 'all' && <span style={{ opacity: 0.6, fontSize: '0.85em' }}> (filtreli)</span>}
                                        </span>
                                    </div>
                                    {(focusMode === 'all' ? sessionChunks : filteredChunks).map((chunk) => {
                                        // Get the real index in sessionChunks
                                        const idx = sessionChunks.indexOf(chunk);
                                        const conf = confidence[chunk.id];
                                        const status = progress[idx]?.status || 'unreviewed';
                                        return (
                                            <div
                                                key={chunk.id}
                                                className={`chunk-item ${status} ${idx === currentIndex ? 'active' : ''}`}
                                                onClick={() => jumpToCard(idx)}
                                            >
                                                <div className="chunk-number">{idx + 1}</div>
                                                <div className="chunk-preview">
                                                    <div className="chunk-text">{chunk.english}</div>
                                                    <div className="chunk-confidence">
                                                        {conf ? `Lv ${conf.level}/5` : 'Lv 0/5'}
                                                    </div>
                                                </div>
                                                <div className="chunk-status-icon">
                                                    {status === 'correct' && '✓'}
                                                    {status === 'wrong' && '✗'}
                                                    {status === 'skipped' && '?'}
                                                    {status === 'unreviewed' && '○'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Sticky Footer */}
                                <div className="panel-footer">
                                    <button className="reset-btn" onClick={() => resetProgress(selectedGroupId)}>
                                        🔄 İlerlemeyi Sıfırla
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    <main className="game-area">
                        {selectedGroupId && sessionChunks.length > 0 ? (
                            !isFinished ? (
                                <>
                                    <FlashCard
                                        chunk={currentChunk}
                                        isFlipped={isFlipped}
                                        onSingleClick={() => speak(currentChunk.english, settings.ttsSpeed, settings.ttsVoice)}
                                        onDoubleClick={() => setIsFlipped(!isFlipped)}
                                        onEdit={() => setShowEditChunkModal(currentChunk)}
                                        cardElapsed={cardElapsed}
                                        formatTime={formatTime}
                                        ttsSpeed={settings.ttsSpeed}
                                        ttsVoice={settings.ttsVoice}
                                    />
                                    {isFlipped && (
                                        <div className="controls">
                                            <button className="btn btn-wrong" onClick={() => handleAnswer('wrong')}>Yanlış</button>
                                            <button className="btn btn-skipped" onClick={() => handleAnswer('skipped')}>Bilmiyorum</button>
                                            <button className="btn btn-correct" onClick={() => handleAnswer('correct')}>Doğru</button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="finish-card">
                                    <h2 className="finish-title">Tamamlandı!</h2>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span className="stat-label">Doğru</span>
                                            <span className="stat-value text-correct">{correctCount}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Yanlış</span>
                                            <span className="stat-value text-wrong">{wrongCount}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Bilmiyorum</span>
                                            <span className="stat-value text-skipped">{skippedCount}</span>
                                        </div>
                                    </div>
                                    <div className="finish-actions">
                                        <button className="btn btn-primary" onClick={() => fetchChunks(selectedGroupId)}>Yeniden Başlat</button>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="empty-state">
                                {groups.length === 0 ? (
                                    <>
                                        <p>Henüz bir grup oluşturmadınız.</p>
                                        <button className="btn btn-primary" onClick={() => setShowGroupModal(true)}>İlk Grubu Oluştur</button>
                                    </>
                                ) : (
                                    <>
                                        <p>Bu grupta henüz chunk bulunmuyor.</p>
                                        <button className="btn btn-primary" onClick={() => setShowChunkModal(true)}>İlk Chunk'ı Ekle</button>
                                    </>
                                )}
                            </div>
                        )}
                    </main>

                    {showGroupModal && <CreateGroupModal onClose={() => setShowGroupModal(false)} onSuccess={fetchGroups} />}
                    {showEditGroupModal && selectedGroup && <EditGroupModal group={selectedGroup} onClose={() => setShowEditGroupModal(false)} onSuccess={fetchGroups} />}
                    {showChunkModal && selectedGroupId && <AddChunkModal groupId={selectedGroupId} onClose={() => setShowChunkModal(false)} onSuccess={() => fetchChunks(selectedGroupId)} />}
                    {showEditChunkModal && selectedGroupId && <EditChunkModal groupId={selectedGroupId} chunk={showEditChunkModal} onClose={() => setShowEditChunkModal(null)} onSuccess={() => fetchChunks(selectedGroupId)} />}
                    {showStatsModal && <StatisticsDashboard onClose={() => setShowStatsModal(false)} />}

                    {/* Speech Practice Modal */}
                    {
                        showSpeechPractice && speechSentences.length > 0 && (
                            <SpeechPracticeModal
                                sentences={speechSentences}
                                onClose={() => setShowSpeechPractice(false)}
                                ttsSpeed={settings.ttsSpeed}
                                ttsVoice={settings.ttsVoice}
                            />
                        )
                    }

                    {/* Settings Modal */}
                    {
                        showSettingsModal && (
                            <div className="modal-overlay">
                                <div className="modal-content">
                                    <div className="modal-header">
                                        <h2>⚙️ Ayarlar</h2>
                                        <button className="close-btn" onClick={() => setShowSettingsModal(false)}>&times;</button>
                                    </div>
                                    <div className="settings-form">
                                        <div className="setting-group">
                                            <label>🎯 Günlük Hedef (Chunk)</label>
                                            <div className="setting-input-group">
                                                <input
                                                    type="number"
                                                    min="5"
                                                    max="100"
                                                    value={settings.dailyGoal}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 20;
                                                        setSettings(s => ({ ...s, dailyGoal: val }));
                                                    }}
                                                />
                                                <button className="btn btn-small" onClick={() => saveSettings({ dailyGoal: settings.dailyGoal })}>Kaydet</button>
                                            </div>
                                        </div>

                                        <div className="setting-group">
                                            <label>🔊 Konuşma Hızı</label>
                                            <div className="speed-buttons">
                                                {[
                                                    { value: 0.6, label: 'Yavaş' },
                                                    { value: 0.85, label: 'Normal' },
                                                    { value: 1.0, label: 'Hızlı' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        className={`speed-btn ${settings.ttsSpeed === opt.value ? 'active' : ''}`}
                                                        onClick={() => { setSettings(s => ({ ...s, ttsSpeed: opt.value })); saveSettings({ ttsSpeed: opt.value }); }}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="setting-group">
                                            <label>🌍 Aksan</label>
                                            <div className="accent-buttons">
                                                {[
                                                    { value: 'en-US', label: '🇺🇸 Amerikan' },
                                                    { value: 'en-GB', label: '🇬🇧 İngiliz' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        className={`accent-btn ${settings.ttsVoice === opt.value ? 'active' : ''}`}
                                                        onClick={() => { setSettings(s => ({ ...s, ttsVoice: opt.value })); saveSettings({ ttsVoice: opt.value }); }}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="setting-group">
                                            <label>🔥 Streak Bilgisi</label>
                                            <div className="streak-info-card">
                                                <div className="streak-stat">
                                                    <span>Mevcut Streak</span>
                                                    <strong>{streakInfo.currentStreak} gün</strong>
                                                </div>
                                                <div className="streak-stat">
                                                    <span>En Uzun Streak</span>
                                                    <strong>{streakInfo.longestStreak} gün</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                </>
            )}


            {/* Stories View */}
            {currentView === 'stories' && (
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
            )}

            {/* Story Modal */}
            {showStoryModal && (
                <StoryModal
                    story={editingStory}
                    onClose={() => { setShowStoryModal(false); setEditingStory(null); }}
                    onSave={handleSaveStory}
                />
            )}
        </div>
    );
}



export default App;
