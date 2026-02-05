// Story List Component
import React from 'react';
import type { Story } from '../../types';

interface StoryListProps {
    stories: Story[];
    onSelect: (story: Story) => void;
    onEdit: (story: Story) => void;
    onDelete: (id: number) => void;
    onAdd: () => void;
}

export const StoryList: React.FC<StoryListProps> = ({ stories, onSelect, onEdit, onDelete, onAdd }) => {
    const handleDelete = (id: number) => {
        if (confirm('Bu hikayeyi silmek istediğinizden emin misiniz?')) {
            onDelete(id);
        }
    };

    return (
        <div className="stories-container">
            <div className="stories-header">
                <h1>📖 Hikayeler</h1>
                <button className="btn btn-primary" onClick={onAdd}>
                    + Yeni Hikaye
                </button>
            </div>
            <div className="story-grid">
                {stories.map(story => (
                    <div key={story.id} className="story-card">
                        <h3>{story.title}</h3>
                        <p className="story-turkish">{story.titleTurkish}</p>
                        <span className={`story-badge story-${story.difficulty}`}>
                            {story.difficulty}
                        </span>
                        {story.wordCount && (
                            <span className="word-count">{story.wordCount} kelime</span>
                        )}
                        <div className="story-actions">
                            <button className="btn btn-small" onClick={() => onSelect(story)}>
                                Oku
                            </button>
                            <button className="btn btn-small" onClick={() => onEdit(story)}>
                                ✏️
                            </button>
                            <button
                                className="btn btn-small btn-danger"
                                onClick={() => handleDelete(story.id)}
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
