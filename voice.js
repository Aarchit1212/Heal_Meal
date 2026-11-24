// Optional server speech with browser speech fallback, plus speech recognition.
class SpeechOutput {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.audio = null;
        this.requestId = 0;
    }

    stop() {
        this.synthesis?.cancel();
        if (this.audio) {
            this.audio.pause();
            URL.revokeObjectURL(this.audio.src);
            this.audio = null;
        }
    }

    speakWithBrowser(text) {
        if (!this.synthesis) return false;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        const voices = this.synthesis.getVoices();
        const voice = voices.find(v => v.lang === "en-IN") || voices.find(v => v.lang === "en-US") || voices[0];
        if (voice) utterance.voice = voice;
        this.synthesis.speak(utterance);
        return true;
    }

    async speak(text) {
        if (!text) return false;
        this.stop();
        const requestId = ++this.requestId;
        try {
            const response = await fetch(`/api/voice`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error("ElevenLabs voice is unavailable");
            const blob = await response.blob();
            if (requestId !== this.requestId) return false;
            this.audio = new Audio(URL.createObjectURL(blob));
            this.audio.onended = () => {
                URL.revokeObjectURL(this.audio.src);
                this.audio = null;
            };
            await this.audio.play();
            return true;
        } catch (error) {
            console.warn("ElevenLabs voice unavailable; using the browser voice instead.", error);
            return this.speakWithBrowser(text);
        }
    }
}

// VOICE MANAGER - Speech Recognition
// ============================================

class VoiceManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.hasTranscript = false;
        this.onResult = null;
        this.initRecognition();
    }

    initRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('⚠️ Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'en-US';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            this.hasTranscript = transcript.trim().length > 0;
            if (this.onResult) this.onResult(transcript.trim(), event.results[event.results.length - 1].isFinal);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI(false);
            if (this.hasTranscript) {
                const status = document.getElementById('voiceStatus');
                if (status) {
                    status.textContent = 'Transcription ready — review and press Send';
                    status.style.color = '#15803d';
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Speech recognition error:', event.error);
            this.isListening = false;
            this.updateUI(false);
            
            if (event.error === 'not-allowed') {
                const status = document.getElementById('voiceStatus');
                if (status) {
                    status.textContent = "Microphone access is needed to transcribe speech.";
                    status.style.color = '#ef4444';
                }
            }
        };
    }

    toggleListening() {
        if (!this.recognition) {
            alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.hasTranscript = false;
            this.recognition.start();
            this.isListening = true;
            this.updateUI(true);
        }
    }

    updateUI(isListening) {
        const status = document.getElementById('voiceStatus');
        const btn = document.getElementById('voiceBtn');
        
        if (status) {
            status.textContent = isListening ? '🎤 Listening...' : 'Ready to listen';
            status.style.color = isListening ? '#ef4444' : '#15803d';
        }
        
        if (btn) {
            btn.classList.toggle('listening', isListening);
            btn.setAttribute('aria-pressed', String(isListening));
            btn.setAttribute('aria-label', isListening ? 'Stop voice input' : 'Start voice input');
            btn.title = isListening ? 'Stop voice input' : 'Start voice input';
            btn.innerHTML = isListening ? 
                '<i class="fas fa-stop" aria-hidden="true"></i>' :
                '<i class="fas fa-microphone" aria-hidden="true"></i>';
        }
    }
}

// ============================================

window.HealMealVoice = { SpeechOutput, VoiceManager };
