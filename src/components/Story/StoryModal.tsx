// Story Modal Component - Add/Edit Story
import React, { useState, useEffect } from 'react';
import type { Story } from '../../types';

interface StoryModalProps {
    story: Story | null;
    onClose: () => void;
    onSave: (story: Partial<Story>) => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({ story, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: '',
        titleTurkish: '',
        content: '',
        contentTurkish: '',
        difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
        tags: [] as string[],
    });

    useEffect(() => {
        if (story) {
            setFormData({
                title: story.title,
                titleTurkish: story.titleTurkish,
                content: story.content,
                contentTurkish: story.contentTurkish,
                difficulty: story.difficulty,
                tags: story.tags || [],
            });
        }
    }, [story]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const wordCount = formData.content.split(/\s+/).length;
        onSave({
            ...formData,
            wordCount,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{story ? 'Hikayeyi Düzenle' : 'Yeni Hikaye'}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Başlık (İngilizce)</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Başlık (Türkçe)</label>
                        <input
                            type="text"
                            value={formData.titleTurkish}
                            onChange={(e) => setFormData({ ...formData, titleTurkish: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>İçerik (İngilizce)</label>
                        <textarea
                            rows={8}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>İçerik (Türkçe)</label>
                        <textarea
                            rows={8}
                            value={formData.contentTurkish}
                            onChange={(e) => setFormData({ ...formData, contentTurkish: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Seviye</label>
                        <select
                            value={formData.difficulty}
                            onChange={(e) => setFormData({
                                ...formData,
                                difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced'
                            })}
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                        </select>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            İptal
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
