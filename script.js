// HealMeal frontend. Provider credentials stay on the backend.
const API_BASE = "/api";

const { SpeechOutput: HealMealSpeechOutput, VoiceManager: HealMealVoiceManager } = window.HealMealVoice;

// MAIN APPLICATION - The Complete Health Assistant
// ============================================

class HealthCompanion {
    constructor() {
        this.rime = new HealMealSpeechOutput();
        this.voice = new HealMealVoiceManager();
        this.conversationHistory = JSON.parse(localStorage.getItem("healthvoice_history") || "[]");
        this.medications = JSON.parse(localStorage.getItem("healmeal_medications") || "[]");
        this.alarmTimer = null;
        this.lastAlarmCheckAt = new Date(Date.now() - 60_000);
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
            this.rime.speak(this.toPlainText(answer));
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
            this.renderMarkdown(body, text);
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

    // Render the small, useful Markdown subset returned by the assistant with DOM
    // nodes only.  Model output is never inserted as HTML, so it cannot run scripts.
    renderMarkdown(container, markdown) {
        const lines = String(markdown || '').replace(/\r/g, '').split('\n');
        let index = 0;
        const isSpecial = (line, next) => /^(#{1,4})\s+/.test(line) || /^\s*([-*])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line) || /^\s{0,3}([-*_])\1\1+\s*$/.test(line) || (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next || ''));

        while (index < lines.length) {
            const line = lines[index];
            if (!line.trim()) { index++; continue; }

            if (/^\s{0,3}([-*_])\1\1+\s*$/.test(line)) {
                container.appendChild(document.createElement('hr')); index++; continue;
            }
            const heading = line.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                const el = document.createElement(`h${heading[1].length + 1}`);
                this.appendInlineMarkdown(el, heading[2]); container.appendChild(el); index++; continue;
            }
            if (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] || '')) {
                const table = document.createElement('table');
                const header = this.tableCells(line);
                const thead = table.createTHead(); const headerRow = thead.insertRow();
                header.forEach(cell => { const th = document.createElement('th'); this.appendInlineMarkdown(th, cell); headerRow.appendChild(th); });
                const tbody = table.createTBody(); index += 2;
                while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                    const row = tbody.insertRow(); const cells = this.tableCells(lines[index]);
                    header.forEach((_, cellIndex) => { const td = row.insertCell(); this.appendInlineMarkdown(td, cells[cellIndex] || ''); });
                    index++;
                }
                const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.appendChild(table); container.appendChild(wrapper); continue;
            }
            const listMatch = line.match(/^\s*([-*])\s+(.+)$/) || line.match(/^\s*(\d+)[.)]\s+(.+)$/);
            if (listMatch) {
                const ordered = /^\s*\d+[.)]\s+/.test(line); const list = document.createElement(ordered ? 'ol' : 'ul');
                while (index < lines.length) {
                    const match = ordered ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/) : lines[index].match(/^\s*[-*]\s+(.+)$/);
                    if (!match) break;
                    const li = document.createElement('li'); this.appendInlineMarkdown(li, match[1]); list.appendChild(li); index++;
                }
                container.appendChild(list); continue;
            }
            const paragraph = [];
            while (index < lines.length && lines[index].trim() && !isSpecial(lines[index], lines[index + 1])) paragraph.push(lines[index++].trim());
            const p = document.createElement('p'); this.appendInlineMarkdown(p, paragraph.join(' ')); container.appendChild(p);
        }
    }

    tableCells(line) {
        return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    }

    appendInlineMarkdown(element, value) {
        const token = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|<br\s*\/?>)/gi;
        let last = 0; let match;
        while ((match = token.exec(value)) !== null) {
            if (match.index > last) element.append(document.createTextNode(value.slice(last, match.index)));
            if (match[2] && match[3]) { const a = document.createElement('a'); a.href = match[3]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = match[2]; element.appendChild(a); }
            else if (match[4] || match[5]) { const strong = document.createElement('strong'); strong.textContent = match[4] || match[5]; element.appendChild(strong); }
            else if (match[6]) { const code = document.createElement('code'); code.textContent = match[6]; element.appendChild(code); }
            else if (match[7] || match[8]) { const em = document.createElement('em'); em.textContent = match[7] || match[8]; element.appendChild(em); }
            else { element.appendChild(document.createElement('br')); }
            last = token.lastIndex;
        }
        if (last < value.length) element.append(document.createTextNode(value.slice(last)));
    }

    toPlainText(markdown) {
        return String(markdown || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#>|]/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\|/g, ', ').replace(/\s+/g, ' ').trim();
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

    setupMedicationReminders() {
        const dialog = document.getElementById("medicationDialog");
        const form = document.getElementById("medicationForm");
        const list = document.getElementById("medicationList");
        const removeButton = document.getElementById("removeMedBtn");
        const error = document.getElementById("medicationFormError");
        const description = document.getElementById("medicationDescription");
        const countWords = value => value.trim().split(/\s+/).filter(Boolean).length;
        const close = () => { if (dialog?.open) dialog.close(); };

        document.getElementById("addMedBtn")?.addEventListener("click", () => {
            form?.reset();
            if (error) error.textContent = "";
            const time = document.getElementById("medicationTime");
            if (time) {
                const now = new Date(Date.now() + 5 * 60_000);
                time.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            }
            dialog?.showModal();
            document.getElementById("medicationName")?.focus();
        });
        document.getElementById("closeMedDialog")?.addEventListener("click", close);
        document.getElementById("cancelMedDialog")?.addEventListener("click", close);
        document.getElementById("previewMedicationSound")?.addEventListener("click", () => {
            this.playMedicationAlarm(document.getElementById("medicationSound")?.value || "gentle");
        });
        description?.addEventListener("input", () => {
            if (error) error.textContent = countWords(description.value) > 15 ? "Keep the note to 15 words or fewer." : "";
        });

        form?.addEventListener("submit", event => {
            event.preventDefault();
            const name = document.getElementById("medicationName")?.value.trim();
            const time = document.getElementById("medicationTime")?.value;
            const note = description?.value.trim() || "";
            if (!name || !time) return;
            if (countWords(note) > 15) {
                if (error) error.textContent = "Keep the note to 15 words or fewer.";
                return;
            }
            this.medications.push({
                id: crypto.randomUUID(), name, time, note,
                sound: document.getElementById("medicationSound")?.value || "gentle",
                lastAlertDate: ""
            });
            this.saveMedications();
            this.renderMedications();
            close();
            if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
        });

        list?.addEventListener("change", () => {
            if (removeButton) removeButton.disabled = !list.querySelector(".medication-select:checked");
        });
        removeButton?.addEventListener("click", () => {
            const selected = new Set([...list.querySelectorAll(".medication-select:checked")].map(input => input.value));
            this.medications = this.medications.filter(med => !selected.has(med.id));
            this.saveMedications();
            this.renderMedications();
        });
        document.getElementById("clearSavedDataBtn")?.addEventListener("click", () => this.clearSavedData());

        this.renderMedications();
        this.checkMedicationAlarms();
        this.alarmTimer = window.setInterval(() => this.checkMedicationAlarms(), 15_000);
    }

    clearSavedData() {
        const confirmed = window.confirm("This permanently clears saved chat history and medication reminders from this browser. Continue?");
        if (!confirmed) return;
        localStorage.removeItem("healthvoice_history");
        localStorage.removeItem("healmeal_medications");
        window.location.reload();
    }

    saveMedications() {
        localStorage.setItem("healmeal_medications", JSON.stringify(this.medications));
    }

    renderMedications() {
        const list = document.getElementById("medicationList");
        const removeButton = document.getElementById("removeMedBtn");
        if (!list) return;
        list.replaceChildren();
        if (!this.medications.length) {
            const empty = document.createElement("p");
            empty.className = "medication-empty";
            empty.textContent = "No medications added yet. Choose Add Medication to create a reminder.";
            list.append(empty);
        }
        for (const med of this.medications) {
            const item = document.createElement("article");
            item.className = "medication-item";
            const info = document.createElement("div");
            info.className = "med-info";
            const title = document.createElement("h3");
            title.textContent = med.name;
            const note = document.createElement("p");
            note.textContent = med.note || "Medication reminder";
            info.append(title, note);
            const time = document.createElement("time");
            time.className = "med-status";
            time.dateTime = med.time;
            const [hour, minute] = med.time.split(":").map(Number);
            const displayTime = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            time.textContent = `Daily reminder · ${displayTime}`;
            const label = document.createElement("label");
            label.className = "medication-select-label";
            const checkbox = document.createElement("input");
            checkbox.className = "medication-select";
            checkbox.type = "checkbox";
            checkbox.value = med.id;
            checkbox.setAttribute("aria-label", `Select ${med.name} for removal`);
            label.append(checkbox);
            item.append(info, time, label);
            list.append(item);
        }
        if (removeButton) removeButton.disabled = true;
    }

    checkMedicationAlarms() {
        const now = new Date();
        const previousCheck = this.lastAlarmCheckAt;
        this.lastAlarmCheckAt = now;
        if (!this.medications.length) return;
        const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
        const due = this.medications.filter(med => {
            const [hour, minute] = med.time.split(":").map(Number);
            const dueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
            return dueAt > previousCheck && dueAt <= now && med.lastAlertDate !== today;
        });
        if (!due.length) return;
        for (const med of due) {
            med.lastAlertDate = today;
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("HealMeal medication reminder", { body: med.note ? `${med.name}: ${med.note}` : `Time for ${med.name}.` });
            }
            this.playMedicationAlarm(med.sound);
        }
        this.saveMedications();
    }

    playMedicationAlarm(sound) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const patterns = { gentle: [660, 880, 660], classic: [880, 880, 880], pulse: [523, 659, 784] };
        const notes = patterns[sound] || patterns.gentle;
        notes.forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const start = context.currentTime + index * 0.28;
            oscillator.type = sound === "pulse" ? "sine" : "triangle";
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.12, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.24);
        });
        window.setTimeout(() => context.close(), 1600);
    }

    setupEventListeners() {
        this.setupMedicationReminders();
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


