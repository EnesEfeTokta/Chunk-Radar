import { useState, useEffect, useCallback, useMemo } from 'react'
import './index.css'

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

const speak = (text: string) => {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha') || v.lang === 'en-US');
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
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

function FlashCard({ chunk, isFlipped, onSingleClick, onDoubleClick, onEdit, cardElapsed, formatTime }: {
  chunk: Chunk;
  isFlipped: boolean;
  onSingleClick: () => void;
  onDoubleClick: () => void;
  onEdit: () => void;
  cardElapsed: number;
  formatTime: (seconds: number) => string;
}) {
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking edit or speaker buttons
    if ((e.target as HTMLElement).closest('.edit-chunk-btn, .tts-btn-small')) {
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

  return (
    <div className={`flash-card-container ${isFlipped ? 'flipped' : ''}`} onClick={handleClick}>
      <div className="flash-card">
        <div className="card-face card-front">
          <button className="edit-chunk-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
          <div className="card-timer">⏱️ {formatTime(cardElapsed)}</div>
          <div className="chunk-info">
            <h2 className="chunk-english">{chunk.english}</h2>
            <p className="tap-hint">{isFlipped ? 'Tekrar görmek için tıkla' : 'Çevirmek için çift tıkla'}</p>
          </div>
          <button className="tts-btn-small" onClick={(e) => { e.stopPropagation(); speak(chunk.english); }}>🔊</button>
        </div>
        <div className="card-face card-back">
          <div className="back-content">
            <span className="chunk-turkish-back">{chunk.turkish}</span>
            <div className="examples-list-back">
              {chunk.examples.map((example, idx) => (
                <div key={idx} className="example-item-wrapper">
                  <p className="example-item-back" onClick={(e) => { e.stopPropagation(); speak(example); }}>
                    {example}
                  </p>
                  {chunk.exampleTranslations && chunk.exampleTranslations[idx] && (
                    <p className="example-translation">{chunk.exampleTranslations[idx]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
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

  useEffect(() => {
    fetchGroups();
    window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (selectedGroupId && groups.length > 0) {
      fetchChunks(selectedGroupId);
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

  const handleAnswer = (status: ChunkStatus) => {
    const newProgress = [...progress];
    newProgress[currentIndex].status = status;
    setProgress(newProgress);

    // Save progress to backend
    const currentChunkId = sessionChunks[currentIndex].id;
    saveProgress(selectedGroupId, currentChunkId, status);

    // Record stats
    if (status === 'correct') {
      saveStats(1, 0);
    } else if (status === 'wrong') {
      saveStats(0, 1);
    }

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

  const getStatusClass = (status: ChunkStatus) => {
    switch (status) {
      case 'correct': return 'status-correct';
      case 'wrong': return 'status-wrong';
      case 'skipped': return 'status-skipped';
      default: return 'status-unreviewed';
    }
  };

  const currentChunk = sessionChunks[currentIndex];
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Calculate stats for finish screen
  const correctCount = progress.filter(p => p.status === 'correct').length;
  const wrongCount = progress.filter(p => p.status === 'wrong').length;
  const skippedCount = progress.filter(p => p.status === 'skipped').length;

  return (
    <div className="container">
      <nav className="top-nav-modern">
        <div className="nav-left">
          <h1 className="logo-text-nav" onClick={() => window.location.reload()}>Chunk <span className="accent">Radar</span></h1>
          <div className="timer-display">⏱️ Oturum: {formatTime(sessionElapsed)}</div>
        </div>

        <div className="nav-right">
          <button className="nav-btn stats" onClick={() => setShowStatsModal(true)}>📈 İst.</button>
          <button className="nav-btn secondary" onClick={() => setShowChunkModal(true)}>+ Chunk</button>
          <button className="nav-btn secondary" onClick={() => setShowGroupModal(true)}>+ Grup</button>
          {selectedGroup && (
            <button className="nav-btn secondary" onClick={() => setShowEditGroupModal(true)}>⚙ Düzenle</button>
          )}
        </div>
      </nav>

      {/* Modern Group Tabs */}
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

      {/* Mini Cards Navigation */}
      {sessionChunks.length > 0 && !isFinished && (
        <>
          <div className="mini-cards-nav">
            {sessionChunks.map((chunk, idx) => (
              <div
                key={chunk.id}
                className={`mini-card ${getStatusClass(progress[idx]?.status || 'unreviewed')} ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => jumpToCard(idx)}
                title={`Chunk ${idx + 1}: ${chunk.english}`}
              >
                {progress[idx]?.status === 'skipped' ? '?' : idx + 1}
              </div>
            ))}
          </div>
          <div className="reset-container">
            <button className="reset-btn" onClick={() => resetProgress(selectedGroupId)}>🔄 İlerlemeyi Sıfırla</button>
          </div>
        </>
      )}

      <main className="game-area">
        {selectedGroupId && sessionChunks.length > 0 ? (
          !isFinished ? (
            <>
              <FlashCard
                chunk={currentChunk}
                isFlipped={isFlipped}
                onSingleClick={() => speak(currentChunk.english)}
                onDoubleClick={() => setIsFlipped(!isFlipped)}
                onEdit={() => setShowEditChunkModal(currentChunk)}
                cardElapsed={cardElapsed}
                formatTime={formatTime}
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

      <style>{`
        /* Modern Navigation */
        .top-nav-modern {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding: 1rem 0;
        }

        .nav-left, .nav-right { display: flex; align-items: center; gap: 0.8rem; }
        .logo-text-nav { font-size: 1.8rem; font-weight: 800; cursor: pointer; }

        .nav-btn {
          padding: 0.6rem 1.2rem;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          border: 1px solid var(--glass-border);
          transition: all 0.2s;
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
        }
        .nav-btn.primary { background: var(--accent-primary); color: white; border: none; }
        .nav-btn.secondary { background: var(--glass); color: white; }
        .nav-btn.stats { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; }
        .nav-btn:hover { opacity: 0.85; transform: translateY(-1px); }

        /* Timer Display */
        .timer-display {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--accent-secondary);
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .card-timer {
          position: absolute;
          top: 1rem;
          right: 4rem;
          background: rgba(139, 92, 246, 0.15);
          padding: 0.4rem 0.8rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--accent-secondary);
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        /* Reset Button */
        .reset-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .reset-btn {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.15));
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f97316;
          padding: 0.6rem 1.2rem;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          font-family: 'Outfit', sans-serif;
          font-size: 0.85rem;
        }

        .reset-btn:hover {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(249, 115, 22, 0.25));
          transform: translateY(-1px);
        }

        /* Modal Large */
        .modal-large { max-width: 600px; }

        /* Examples Section in Modal */
        .examples-section {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .section-label {
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-bottom: 0.3rem;
        }

        .example-row {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .translation-input {
          background: rgba(139, 92, 246, 0.1) !important;
          border-color: rgba(139, 92, 246, 0.3) !important;
          font-size: 0.9rem !important;
        }

        /* Example Translation Display */
        .example-item-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .example-translation {
          color: rgba(139, 92, 246, 0.6);
          font-size: 0.8rem;
          margin: 0;
          padding-left: 1rem;
          font-style: italic;
          opacity: 0.8;
        }

        /* Group Tabs */
        .group-tabs-container {
          margin-bottom: 2rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .group-tabs {
          display: flex;
          gap: 0.8rem;
          padding: 0.5rem 0;
          min-width: min-content;
        }

        .group-tab {
          padding: 0.8rem 1.8rem;
          border-radius: 50px;
          background: var(--glass);
          color: var(--text-muted);
          border: 1px solid var(--glass-border);
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          font-family: 'Outfit', sans-serif;
        }

        .group-tab:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .group-tab.active {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        /* Mini Cards Navigation */
        .mini-cards-nav {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          padding: 1rem;
          background: var(--bg-card);
          border-radius: 16px;
          border: 1px solid var(--glass-border);
          flex-wrap: wrap;
          justify-content: center;
          max-width: 800px;
          margin-left: auto;
          margin-right: auto;
        }

        .mini-card {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }

        .mini-card:hover {
          transform: scale(1.1);
        }

        .mini-card.active {
          border-color: white;
          box-shadow: 0 0 0 2px var(--bg-deep);
        }

        .mini-card.status-unreviewed {
          background: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.5);
        }

        .mini-card.status-correct {
          background: #22c55e;
          color: white;
        }

        .mini-card.status-wrong {
          background: #ef4444;
          color: white;
        }

        .mini-card.status-skipped {
          background: #3b82f6;
          color: white;
        }

        /* Updated Controls */
        .controls {
          display: flex;
          gap: 1rem;
          width: 100%;
          max-width: 600px;
        }

        .btn-skipped {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .btn-skipped:hover {
          background: #3b82f6;
          color: white;
        }

        /* Stats */
        .text-skipped { color: #3b82f6; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0; }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--bg-card);
          padding: 2.5rem;
          border-radius: 28px;
          width: 90%;
          max-width: 500px;
          border: 1px solid var(--glass-border);
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
        }

        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .close-btn { background: transparent; border: none; font-size: 2rem; color: var(--text-muted); cursor: pointer; }

        .modal-content h2 { font-size: 1.8rem; }
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .modal-form input { background: var(--bg-deep); border: 1px solid var(--glass-border); padding: 1rem; border-radius: 14px; color: white; font-size: 1rem; }
        .modal-actions { display: flex; gap: 1rem; margin-top: 1rem; align-items: center; }

        /* Stats Styles */
        .stats-modal { max-width: 600px; }
        .stats-svg { width: 100%; height: auto; margin: 1.5rem 0; overflow: visible; }
        .chart-point:hover circle { r: 6; cursor: pointer; }
        .stats-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem; }
        .summary-card { background: var(--bg-deep); padding: 1.5rem; border-radius: 20px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 0.5rem; text-align: center; }
        .summary-label { color: var(--text-muted); font-size: 0.85rem; }
        .summary-value { font-size: 2rem; font-weight: 800; }

        /* Edit Styles */
        .edit-chunk-btn { position: absolute; top: 1rem; left: 1rem; background: var(--glass); border: none; color: var(--text-muted); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.3s; z-index: 10; }
        .card-front:hover .edit-chunk-btn { opacity: 1; }
        .edit-chunk-btn:hover { background: var(--accent-primary); color: white; }

        /* Game Styles */
        .accent { background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .game-area { display: flex; flex-direction: column; align-items: center; gap: 2rem; perspective: 1000px; padding-bottom: 4rem;}
        .flash-card-container { width: 100%; max-width: 500px; height: 380px; cursor: pointer; }
        .flash-card { position: relative; width: 100%; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; }
        .flash-card-container.flipped .flash-card { transform: rotateY(180deg); }
        .card-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 28px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2.5rem; background: var(--bg-card); border: 1px solid var(--glass-border); box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4); }
        .card-front { background: linear-gradient(135deg, #1c1c24 0%, #121216 100%); }
        .card-back { background: linear-gradient(135deg, #1e1b4b 0%, #121216 100%); transform: rotateY(180deg); }
        .chunk-english { font-size: 2.5rem; text-align: center; margin-bottom: 1rem; font-family: 'Outfit', sans-serif; font-weight: 700; }
        .tap-hint { color: var(--text-muted); font-size: 0.9rem; opacity: 0.6; }
        .chunk-info { text-align: center; }
        .back-content { width: 100%; display: flex; flex-direction: column; gap: 1.5rem; align-items: center; }
        .chunk-turkish-back { color: var(--accent-secondary); font-size: 1.8rem; font-weight: 700; text-align: center; }
        .examples-list-back { width: 100%; display: flex; flex-direction: column; gap: 0.8rem; }
        .example-item-back { background: var(--glass); padding: 14px 18px; border-radius: 16px; font-size: 1rem; color: var(--text-muted); transition: all 0.2s; border: 1px solid var(--glass-border); cursor: pointer; }
        .example-item-back:hover { color: var(--text-main); background: rgba(255, 255, 255, 0.08); transform: translateX(5px); }
        .tts-btn-small { position: absolute; bottom: 1.5rem; right: 1.5rem; background: var(--glass); border: none; color: white; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; font-size: 1.4rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; }
        .tts-btn-small:hover { background: var(--accent-primary); transform: scale(1.1); }
        .btn { flex: 1; padding: 1.2rem; border-radius: 20px; font-weight: 700; font-size: 1.1rem; cursor: pointer; transition: all 0.2s; border: none; font-family: 'Outfit', sans-serif; }
        .btn-wrong { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-wrong:hover { background: #ef4444; color: white; }
        .btn-correct { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
        .btn-correct:hover { background: #22c55e; color: white; }
        .finish-card { background: var(--bg-card); padding: 3.5rem; border-radius: 36px; text-align: center; width: 100%; max-width: 560px; border: 1px solid var(--glass-border); }
        .finish-title { font-size: 2.2rem; margin-bottom: 2rem; }
        .stat-item { display: flex; flex-direction: column; gap: 0.5rem; }
        .stat-label { color: var(--text-muted); font-size: 0.9rem; }
        .stat-value { font-size: 2.5rem; font-weight: 800; }
        .text-correct { color: #22c55e; }
        .text-wrong { color: #ef4444; }
        .btn-primary { background: var(--accent-primary); color: white; }
        .btn-secondary { background: var(--glass); color: var(--text-main); border: 1px solid var(--glass-border); }
        .finish-actions { margin-top: 2rem; display: flex; justify-content: center; }
        .empty-state { text-align: center; margin-top: 4rem; color: var(--text-muted); }
      `}</style>
    </div>
  )
}

export default App
