// View Tabs Component - Switch between Flashcards and Stories
import React from 'react';
interface ViewTabsProps {
    currentView: 'flashcards' | 'stories';
    onChange: (view: 'flashcards' | 'stories') => void;
}

export const ViewTabs: React.FC<ViewTabsProps> = ({ currentView, onChange }) => {
    return (
        <div className="main-view-tabs">
            <button
                className={`view-tab ${currentView === 'flashcards' ? 'active' : ''}`}
                onClick={() => onChange('flashcards')}
            >
                🎴 Flashcards
            </button>
            <button
                className={`view-tab ${currentView === 'stories' ? 'active' : ''}`}
                onClick={() => onChange('stories')}
            >
                📖 Hikayeler
            </button>
        </div>
    );
};
