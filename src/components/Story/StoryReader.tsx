// Story Reader Component
import React from 'react';
import type { Story } from '../../types';

interface StoryReaderProps {
    story: Story;
    onBack: () => void;
}

export const StoryReader: React.FC<StoryReaderProps> = ({ story, onBack }) => {
    return (
        <div className="story-reader">
            <button className="back-btn" onClick={onBack}>
                ← Hikayelere Dön
            </button>
            <h1>{story.title}</h1>
            <p className="story-subtitle">{story.titleTurkish}</p>
            <span className={`story-badge story-${story.difficulty}`}>
                {story.difficulty}
            </span>
            <div className="story-content">
                <h3>📖 İngilizce</h3>
                <p className="english-text">{story.content}</p>
                <hr />
                <h3>🇹🇷 Türkçe</h3>
                <p className="turkish-text">{story.contentTurkish}</p>
            </div>
        </div>
    );
};
