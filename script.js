// HealMeal frontend. Provider credentials stay on the backend.
const API_BASE = "/api";

const { SpeechOutput: HealMealSpeechOutput, VoiceManager: HealMealVoiceManager } = window.HealMealVoice;
const HealMealMarkdownRenderer = window.HealMealMarkdownRenderer;
const HealMealMedicationReminders = window.HealMealMedicationReminders;

// MAIN APPLICATION - The Complete Health Assistant
// ============================================

class HealthCompanion {
    constructor() {
        this.rime = new HealMealSpeechOutput();
        this.voice = new HealMealVoiceManager();
        this.conversationHistory = JSON.parse(localStorage.getItem("healthvoice_history") || "[]");
        this.medicationReminders = new HealMealMedicationReminders();
        this.chatQueue = Promise.resolve();
        this.voice.onResult = (transcript) => {
            const input = document.getElementById("voiceInput");
            if (input) input.value = transcript;
        };
        this.setupEventListeners();
        this.restoreConversationHistory();
    }

    async init() {
        console.log("HealMeal ready. AI requests are handled by the backend.");
    }

    async generateMealPlan(healthConcern) {
        const concern = String(healthConcern || "").trim();
        const status = document.getElementById("mealPlanStatus");
        if (!concern) {
            if (status) status.textContent = "Please enter a health concern or nutrition goal first.";
            document.getElementById("healthConcern")?.focus();
            return;
        }
        const requestId = this.mealPlanRequestId = (this.mealPlanRequestId || 0) + 1;
        const button = document.getElementById("generateMealBtn");
        if (status) status.textContent = "Generating meal ideas and nutrition notes…";
        if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
        try {
            const response = await fetch(`${API_BASE}/meal-plan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ healthConcern: concern })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Could not generate a meal plan.");
            if (requestId !== this.mealPlanRequestId) return;
            this.renderMealPlan(data);
            if (status) status.textContent = `Meal ideas for ${data.concern}. Nutrient values are approximate per serving.`;
        } catch (error) {
            if (requestId !== this.mealPlanRequestId) return;
            if (status) status.textContent = error.message || "Could not generate a meal plan. Please try again.";
            console.error("Meal plan request failed:", error);
        } finally {
            if (requestId === this.mealPlanRequestId && button) { button.disabled = false; button.removeAttribute("aria-busy"); }
        }
    }

    renderMealPlan(plan) {
        const mealGrid = document.getElementById("mealGrid");
        const title = document.getElementById("nutritionSummaryTitle");
        const summary = document.getElementById("nutritionSummary");
        const totals = document.getElementById("nutritionTotals");
        const focus = document.getElementById("nutritionFocus");
        const foods = document.getElementById("nutritionFoods");
        const sources = document.getElementById("nutritionSources");
        const disclaimer = document.getElementById("nutritionDisclaimer");
        if (!mealGrid || !focus || !foods) return;

        const make = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            node.textContent = text == null ? "" : String(text);
            return node;
        };
        mealGrid.replaceChildren();
        for (const meal of plan.meals) {
            const card = make("article", "meal-card");
            card.append(make("div", "meal-time", meal.meal));
            card.append(make("h4", "", meal.name));
            card.append(make("p", "", meal.description));
            const metrics = make("div", "meal-nutrition");
            metrics.append(make("span", "", `🔥 ~${Math.round(meal.calories)} cal`));
            metrics.append(make("span", "", `💪 ~${Math.round(meal.protein_g)}g protein`));
            metrics.append(make("span", "", `🌾 ~${Math.round(meal.carbs_g)}g carbs`));
            metrics.append(make("span", "", `🌿 ~${Math.round(meal.fiber_g)}g fiber`));
            card.append(metrics);
            mealGrid.append(card);
        }

        const selected = plan.concern || "Your health goal";
        if (title) title.textContent = `${selected}: nutrition focus`;
        if (summary) summary.textContent = plan.overview;
        if (totals) {
            const total = (key) => Math.round(plan.meals.reduce((sum, meal) => sum + Number(meal[key] || 0), 0));
            totals.replaceChildren(
                make("span", "", `~${total("calories")} cal`),
                make("span", "", `~${total("protein_g")}g protein`),
                make("span", "", `~${total("carbs_g")}g carbs`),
                make("span", "", `~${total("fiber_g")}g fiber`)
            );
        }
        focus.replaceChildren(...plan.nutrition_focus.map(item => {
            const li = make("li", "", item);
            li.prepend(make("i", "fas fa-circle-check"));
            return li;
        }));
        foods.replaceChildren(...plan.helpful_foods.map(item => make("li", "", item)));
        if (sources) {
            sources.replaceChildren(make("strong", "", "Trusted references:"));
            for (const source of plan.sources || []) {
                const link = make("a", "", source.label);
                link.href = source.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                sources.append(link);
            }
        }
        if (disclaimer) disclaimer.textContent = plan.disclaimer;
    }

    processUserQuery(query) {
        if (!query || !query.trim()) return;
        const cleanQuery = query.trim();
        this.addMessage("user", cleanQuery);
        const typingIndicator = this.showTypingIndicator();
        this.chatQueue = this.chatQueue.then(() => this.completeUserQuery(cleanQuery, typingIndicator));
        return this.chatQueue;
    }

    async completeUserQuery(cleanQuery, typingIndicator) {
        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: cleanQuery,
                    history: this.conversationHistory.slice(-8)
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "The assistant could not answer right now.");
            const answer = data.answer;
            if (!answer) throw new Error("The assistant returned an empty response.");
            this.conversationHistory.push({ role: "user", content: cleanQuery }, { role: "assistant", content: answer });
            this.conversationHistory = this.conversationHistory.slice(-16);
            localStorage.setItem("healthvoice_history", JSON.stringify(this.conversationHistory));
            this.addMessage("assistant", answer, typingIndicator);
            this.rime.speak(HealMealMarkdownRenderer.toPlainText(answer));
        } catch (error) {
            console.error("Chat request failed:", error);
            const msg = error.message || "I couldn't connect to the assistant. Please try again.";
            this.addMessage("assistant", msg, typingIndicator);
            this.rime.speak(msg);
        }
    }

    // ============================================
    // UI HELPERS
    // ============================================

    addMessage(type, text, before = null) {
        const conversationArea = document.getElementById('conversationArea');
        if (!conversationArea) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = document.createElement('div');
        icon.className = 'message-icon';
        icon.innerHTML = type === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const body = document.createElement('div');
        body.className = 'message-body';
        if (type === 'assistant') {
            HealMealMarkdownRenderer.renderMarkdown(body, text);
        } else {
            const p = document.createElement('p');
            p.textContent = text;
            body.appendChild(p);
        }
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString();
        
        content.appendChild(body);
        content.appendChild(time);
        messageDiv.appendChild(icon);
        messageDiv.appendChild(content);
        
        if (before?.parentNode === conversationArea) before.replaceWith(messageDiv);
        else conversationArea.appendChild(messageDiv);
        conversationArea.scrollTop = conversationArea.scrollHeight;
    }

    restoreConversationHistory() {
        const conversationArea = document.getElementById("conversationArea");
        if (!conversationArea || !Array.isArray(this.conversationHistory)) return;
        const messages = this.conversationHistory.filter(message =>
            message && ["user", "assistant"].includes(message.role) && typeof message.content === "string"
        );
        if (!messages.length) return;
        conversationArea.replaceChildren();
        for (const message of messages) this.addMessage(message.role, message.content);
    }

    showTypingIndicator() {
        const conversationArea = document.getElementById('conversationArea');
        if (!conversationArea) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'message assistant';
        indicator.innerHTML = `
            <div class="message-icon"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <p><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></p>
            </div>
        `;
        conversationArea.appendChild(indicator);
        conversationArea.scrollTop = conversationArea.scrollHeight;
        return indicator;
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Voice button - toggle listening
        const voiceBtn = document.getElementById('voiceBtn');
        // Medication reminders are browser-local and require this page to remain open.
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.voice.toggleListening();
            });
        }

        // Send button - process text
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const input = document.getElementById('voiceInput');
                if (input && input.value.trim()) {
                    this.processUserQuery(input.value.trim());
                    input.value = '';
                }
            });
        }

        // Enter key - process text
        const voiceInput = document.getElementById('voiceInput');
        if (voiceInput) {
            voiceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && voiceInput.value.trim()) {
                    e.preventDefault();
                    this.processUserQuery(voiceInput.value.trim());
                    voiceInput.value = '';
                }
            });
        }

        // Start voice consultation button
        const startVoiceBtn = document.getElementById('startVoiceBtn');
        if (startVoiceBtn) {
            startVoiceBtn.addEventListener('click', () => {
                const section = document.querySelector('.voice-consultation');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => this.voice.toggleListening(), 500);
            });
        }

        const guideMeBtn = document.getElementById('guideMeBtn');
        if (guideMeBtn) {
            const guideLines = [
                "Let me show what I can do.",
                "Ask me any health question.",
                "I'm here to help you personally.",
                "Let's explore your nutrition goals.",
                "Get practical meal ideas with me."
            ];
            guideMeBtn.addEventListener('click', () => {
                const section = document.querySelector('.voice-consultation');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
                const line = guideLines[Math.floor(Math.random() * guideLines.length)];
                this.addMessage('assistant', line);
                this.rime.speak(line);
            });
        }

        const mealBtn = document.getElementById("generateMealBtn");
        if (mealBtn) {
            mealBtn.addEventListener("click", () => {
                this.generateMealPlan(document.getElementById("healthConcern")?.value);
            });
        }
        document.getElementById("healthConcern")?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") this.generateMealPlan(event.currentTarget.value);
        });

        setupHealthTools();

        // Voice toggle in navbar
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                const section = document.querySelector('.voice-consultation');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => this.voice.toggleListening(), 500);
            });
        }
    }

}

// ============================================
// INITIALIZE THE APPLICATION
// ============================================

const app = new HealthCompanion();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+V to toggle voice
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        app.voice.toggleListening();
    }
});

console.log('🌟 HealMeal with secure backend AI');
console.log('🎤 Press the microphone button or Ctrl+Shift+V to speak!');


