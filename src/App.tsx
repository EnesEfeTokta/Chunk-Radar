import { useState, useEffect, useCallback, useMemo } from 'react'
import './index.css'

interface Chunk {
  id: number;
  english: string;
  turkish: string;
  examples: string[];
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
                {/* Grid Lines */}
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

                {/* Total Path */}
                <path
                  d={`M ${chartData?.points.map(p => `${p.x},${p.yTotal}`).join(' L ')}`}
                  fill="none"
                  stroke="var(--glass-border)"
                  strokeWidth="2"
                />

                {/* Correct Path */}
                <path
                  d={`M ${chartData?.points.map(p => `${p.x},${p.yCorrect}`).join(' L ')}`}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/chunks/${groupId}/${chunk.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunk: { english, turkish, examples: examples.filter(ex => ex.trim() !== '') }
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
      <div className="modal-content">
        <h2>Chunk Düzenle</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input placeholder="İngilizce" value={english} onChange={e => setEnglish(e.target.value)} required />
          <input placeholder="Türkçe" value={turkish} onChange={e => setTurkish(e.target.value)} required />
          {examples.map((ex, i) => (
            <input
              key={i}
              placeholder={`Örnek Cümle ${i + 1}`}
              value={ex}
              onChange={e => {
                const newExs = [...examples];
                newExs[i] = e.target.value;
                setExamples(newExs);
              }}
            />
          ))}
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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          chunk: { english, turkish, examples: examples.filter(ex => ex.trim() !== '') }
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
      <div className="modal-content">
        <h2>Yeni Chunk Ekle</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input placeholder="İngilizce (Chunk)" value={english} onChange={e => setEnglish(e.target.value)} required />
          <input placeholder="Türkçe Karşılığı" value={turkish} onChange={e => setTurkish(e.target.value)} required />
          {examples.map((ex, i) => (
            <input
              key={i}
              placeholder={`Örnek Cümle ${i + 1}`}
              value={ex}
              onChange={e => {
                const newExs = [...examples];
                newExs[i] = e.target.value;
                setExamples(newExs);
              }}
            />
          ))}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>Ekle</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FlashCard({ chunk, isFlipped, onFlip, onEdit }: { chunk: Chunk; isFlipped: boolean; onFlip: () => void; onEdit: () => void }) {
  return (
    <div className={`flash-card-container ${isFlipped ? 'flipped' : ''}`} onClick={onFlip}>
      <div className="flash-card">
        <div className="card-face card-front">
          <button className="edit-chunk-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
          <div className="chunk-info">
            <h2 className="chunk-english">{chunk.english}</h2>
            <p className="tap-hint">Cevabı görmek için tıkla</p>
          </div>
          <button className="tts-btn-small" onClick={(e) => { e.stopPropagation(); speak(chunk.english); }}>🔊</button>
        </div>
        <div className="card-face card-back">
          <div className="back-content">
            <span className="chunk-turkish-back">{chunk.turkish}</span>
            <div className="examples-list-back">
              {chunk.examples.map((example, idx) => (
                <p key={idx} className="example-item-back" onClick={(e) => { e.stopPropagation(); speak(example); }}>
                  {example}
                </p>
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
  const [wrongChunks, setWrongChunks] = useState<Chunk[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isFinished, setIsFinished] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

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
      // Logic to handle group selection after fetch
      if (data.length > 0) {
        const currentStillExists = data.find((g: Group) => g.id === selectedGroupId);
        if (!currentStillExists) {
          // Check if default exists, else first
          const defaultGroup = data.find((g: Group) => g.id === 'default');
          setSelectedGroupId(defaultGroup ? defaultGroup.id : data[0].id);
        }
      } else {
        // No groups (rare if default guaranteed by backend)
        setSelectedGroupId('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChunks = useCallback(async (groupId: string, isReview = false, specificChunks?: Chunk[]) => {
    let chunksToUse: Chunk[] = [];
    if (isReview && specificChunks) {
      chunksToUse = [...specificChunks];
    } else if (groupId) {
      try {
        const res = await fetch(`/api/chunks/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          chunksToUse = Array.isArray(data) ? data : [];
        }
      } catch (err) {
        console.error(err);
      }
    }

    const shuffled = [...chunksToUse].sort(() => Math.random() - 0.5);
    setSessionChunks(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
    setScore({ correct: 0, total: shuffled.length });
    setReviewMode(isReview);
    if (!isReview) setWrongChunks([]);
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

  const handleNext = (correct: boolean) => {
    const current = sessionChunks[currentIndex];
    let newCorrect = score.correct;
    if (!correct) {
      setWrongChunks(prev => [...prev.filter(c => c.id !== current.id), current]);
    }
    if (correct) {
      newCorrect = score.correct + 1;
      setScore(prev => ({ ...prev, correct: newCorrect }));
    }

    if (currentIndex + 1 < sessionChunks.length) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setIsFinished(true);
      // Track actual answers:
      saveStats(correct ? 1 : 0, correct ? 0 : 1);
    }

    // For stats during the session:
    if (currentIndex + 1 < sessionChunks.length) {
      saveStats(correct ? 1 : 0, correct ? 0 : 1);
    }
  };

  const currentChunk = sessionChunks[currentIndex];
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="container">
      <nav className="top-nav">
        <div className="nav-left">
          <div className="group-selector-wrapper">
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              {groups.length === 0 && <option value="">Grup Yok</option>}
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="nav-icon-btn" onClick={() => setShowEditGroupModal(true)} title="Grubu Düzenle">⚙</button>
            <button className="nav-icon-btn plus" onClick={() => setShowGroupModal(true)} title="Grup Oluştur">+</button>
          </div>
        </div>

        <h1 className="logo-text-nav" onClick={() => window.location.reload()}>Chunk <span className="accent">Radar</span></h1>

        <div className="nav-right">
          <button className="nav-btn stats" onClick={() => setShowStatsModal(true)}>📈 İst.</button>
          <button className="nav-btn primary" onClick={() => setShowChunkModal(true)}>Yeni Ekle</button>
        </div>
      </nav>

      <header className="progress-header">
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${(sessionChunks.length > 0 ? (currentIndex + (isFinished ? 1 : 0)) / sessionChunks.length : 0) * 100}%` }}></div>
        </div>
        <div className="score-info">
          {sessionChunks.length > 0 ? `${currentIndex + 1} / ${sessionChunks.length}` : 'Grup Boş'} {reviewMode && <span className="review-tag">Tekrar Modu</span>}
        </div>
      </header>

      <main className="game-area">
        {selectedGroupId && sessionChunks.length > 0 ? (
          !isFinished ? (
            <>
              <FlashCard
                chunk={currentChunk}
                isFlipped={isFlipped}
                onFlip={() => {
                  if (!isFlipped) {
                    setIsFlipped(true);
                    speak(currentChunk.english);
                  } else {
                    setIsFlipped(false);
                  }
                }}
                onEdit={() => setShowEditChunkModal(currentChunk)}
              />
              {isFlipped && (
                <div className="controls">
                  <button className="btn btn-wrong" onClick={() => handleNext(false)}>Yanlış</button>
                  <button className="btn btn-correct" onClick={() => handleNext(true)}>Doğru</button>
                </div>
              )}
            </>
          ) : (
            <div className="finish-card">
              <h2 className="finish-title">Tamamlandı!</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Doğru</span>
                  <span className="stat-value text-correct">{score.correct}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Yanlış</span>
                  <span className="stat-value text-wrong">{wrongChunks.length}</span>
                </div>
              </div>
              <div className="finish-actions">
                <button className="btn btn-primary" onClick={() => fetchChunks(selectedGroupId)}>Yeniden Başlat</button>
                {wrongChunks.length > 0 && (
                  <button className="btn btn-secondary" onClick={() => fetchChunks(selectedGroupId, true, wrongChunks)}>Yanlışları Tekrar Et ({wrongChunks.length})</button>
                )}
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
        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding: 1rem 0;
          border-bottom: 1px solid var(--glass-border);
          gap: 1rem;
        }

        .nav-left, .nav-right { display: flex; align-items: center; gap: 0.8rem; }
        
        .group-selector-wrapper {
          display: flex;
          background: var(--bg-card);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 2px;
          align-items: center;
        }

        .group-selector-wrapper select {
          background: transparent;
          color: white;
          border: none;
          padding: 0.5rem 0.8rem;
          outline: none;
          max-width: 150px;
        }

        .nav-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 1.1rem;
          padding: 0.4rem 0.6rem;
          transition: 0.2s;
        }
        .nav-icon-btn:hover { color: white; }
        .nav-icon-btn.plus { color: var(--accent-primary); border-left: 1px solid var(--glass-border); }

        .logo-text-nav { font-size: 1.4rem; font-weight: 800; cursor: pointer; flex-shrink: 0; }

        .nav-btn {
          padding: 0.5rem 1rem;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          border: 1px solid var(--glass-border);
          transition: 0.2s;
          font-family: 'Outfit', sans-serif;
        }
        .nav-btn.primary { background: var(--accent-primary); color: white; border: none; }
        .nav-btn.stats { background: var(--glass); color: white; }
        .nav-btn:hover { opacity: 0.8; }

        .progress-header { margin-bottom: 2rem; text-align: center; }

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
        .edit-chunk-btn { position: absolute; top: 1rem; left: 1rem; background: var(--glass); border: none; color: var(--text-muted); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.3s; }
        .card-front:hover .edit-chunk-btn { opacity: 1; }
        .edit-chunk-btn:hover { background: var(--accent-primary); color: white; }

        /* Existing Game Styles */
        .accent { background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .progress-bar-container { width: 100%; height: 6px; background: var(--glass-border); border-radius: 10px; overflow: hidden; margin-bottom: 0.5rem; }
        .progress-bar { height: 100%; background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary)); transition: width 0.4s ease; }
        .score-info { font-size: 0.9rem; color: var(--text-muted); }
        .game-area { display: flex; flex-direction: column; align-items: center; gap: 2rem; perspective: 1000px; padding-bottom: 4rem;}
        .flash-card-container { width: 100%; max-width: 450px; height: 340px; cursor: pointer; }
        .flash-card { position: relative; width: 100%; height: 100%; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; }
        .flash-card-container.flipped .flash-card { transform: rotateY(180deg); }
        .card-face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 28px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2.5rem; background: var(--bg-card); border: 1px solid var(--glass-border); box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4); }
        .card-front { background: linear-gradient(135deg, #1c1c24 0%, #121216 100%); }
        .card-back { background: linear-gradient(135deg, #1e1b4b 0%, #121216 100%); transform: rotateY(180deg); }
        .chunk-english { font-size: 2.3rem; text-align: center; margin-bottom: 1rem; font-family: 'Outfit', sans-serif; font-weight: 700; }
        .tap-hint { color: var(--text-muted); font-size: 0.9rem; opacity: 0.6; }
        .back-content { width: 100%; display: flex; flex-direction: column; gap: 1.5rem; align-items: center; }
        .chunk-turkish-back { color: var(--accent-secondary); font-size: 1.6rem; font-weight: 700; text-align: center; }
        .examples-list-back { width: 100%; display: flex; flex-direction: column; gap: 0.8rem; }
        .example-item-back { background: var(--glass); padding: 12px 16px; border-radius: 14px; font-size: 0.95rem; color: var(--text-muted); transition: all 0.2s; border: 1px solid var(--glass-border); }
        .example-item-back:hover { color: var(--text-main); background: rgba(255, 255, 255, 0.08); transform: translateX(5px); }
        .tts-btn-small { position: absolute; bottom: 1.5rem; right: 1.5rem; background: var(--glass); border: none; color: white; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 1.3rem; display: flex; align-items: center; justify-content: center; }
        .controls { display: flex; gap: 1.5rem; width: 100%; max-width: 450px; }
        .btn { flex: 1; padding: 1.2rem; border-radius: 20px; font-weight: 700; font-size: 1.1rem; cursor: pointer; transition: all 0.2s; border: none; font-family: 'Outfit', sans-serif; }
        .btn-wrong { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .btn-wrong:hover { background: #ef4444; color: white; }
        .btn-correct { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
        .btn-correct:hover { background: #22c55e; color: white; }
        .finish-card { background: var(--bg-card); padding: 3.5rem; border-radius: 36px; text-align: center; width: 100%; max-width: 480px; border: 1px solid var(--glass-border); }
        .finish-title { font-size: 2.2rem; margin-bottom: 2rem; }
        .text-correct { color: #22c55e; }
        .text-wrong { color: #ef4444; }
        .btn-primary { background: var(--accent-primary); color: white; }
        .btn-secondary { background: var(--glass); color: var(--text-main); border: 1px solid var(--glass-border); }
        .empty-state { text-align: center; margin-top: 4rem; color: var(--text-muted); }
      `}</style>
    </div>
  )
}

export default App
