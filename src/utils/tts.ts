// TTS (Text-to-Speech) Utilities

export const speak = (text: string, rate: number = 0.85, voice: string = 'en-US'): void => {
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

export const speakSequence = async (texts: string[], rate: number = 0.85, voice: string = 'en-US'): Promise<void> => {
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
            window.speechSynthesis.speak(utterance);
        });
    }
};
