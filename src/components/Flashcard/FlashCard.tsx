// FlashCard Component
import React, { useState, useEffect, useRef } from 'react';
import type { Chunk } from '../../types';
import { speak, speakSequence } from '../../utils';

interface FlashCardProps {
    chunk: Chunk;
    isFlipped: boolean;
    onSingleClick: () => void;
    onDoubleClick: () => void;
    onEdit: () => void;
    cardElapsed: number;
    formatTime: (seconds: number) => string;
    ttsSpeed?: number;
    ttsVoice?: string;
}

export function FlashCard({
    chunk,
    isFlipped,
    onSingleClick,
    onDoubleClick,
    onEdit,
    cardElapsed,
    formatTime,
    ttsSpeed = 0.85,
    ttsVoice = 'en-US'
}: FlashCardProps) {
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
        hoverTimerRef.current = window.setTimeout(async () => {
            // Play TTS first
            await speak(text, ttsSpeed, ttsVoice);
            // Then flip
            setHoveredExample(idx);
            // Clear timer reference
            hoverTimerRef.current = null;
        }, 1000);
    };

    const handleExampleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only reset if actually leaving the element
        const relatedTarget = e.relatedTarget as HTMLElement;
        const currentTarget = e.currentTarget;

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
