// HealMeal frontend. Provider credentials stay on the backend.
const API_BASE = "/api";

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
            const response = await fetch(`${API_BASE}/voice`, {
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
                    status.style.color = '#22c55e';
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
            status.style.color = isListening ? '#ef4444' : '#22c55e';
        }
        
        if (btn) {
            btn.classList.toggle('listening', isListening);
            btn.innerHTML = isListening ? 
                '<i class="fas fa-stop"></i>' : 
                '<i class="fas fa-microphone"></i>';
        }
    }
}

// ============================================
// MAIN APPLICATION - The Complete Health Assistant
// ============================================

class HealthCompanion {
    constructor() {
        this.rime = new SpeechOutput();
        this.voice = new VoiceManager();
        this.userId = localStorage.getItem("healthvoice_user_id") || `user_${crypto.randomUUID()}`;
        localStorage.setItem("healthvoice_user_id", this.userId);
        this.conversationHistory = JSON.parse(localStorage.getItem("healthvoice_history") || "[]");
        this.voice.onResult = (transcript) => {
            const input = document.getElementById("voiceInput");
            if (input) input.value = transcript;
        };
        this.setupEventListeners();
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

    async processUserQuery(query) {
        if (!query || !query.trim()) return;
        const cleanQuery = query.trim();
        this.addMessage("user", cleanQuery);
        this.showTypingIndicator();
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
            this.removeTypingIndicator();
            this.addMessage("assistant", answer);
            this.rime.speak(this.toPlainText(answer));
        } catch (error) {
            console.error("Chat request failed:", error);
            this.removeTypingIndicator();
            const msg = error.message || "I couldn't connect to the assistant. Please try again.";
            this.addMessage("assistant", msg);
            this.rime.speak(msg);
        }
    }

    detectCondition(query) {
        const conditions = ['diabetes', 'hypertension', 'heart disease', 'obesity', 'anemia', 
                           'asthma', 'arthritis', 'depression', 'anxiety', 'migraine'];
        const lower = query.toLowerCase();
        for (const condition of conditions) {
            if (lower.includes(condition)) {
                return condition;
            }
        }
        return 'general';
    }

    extractTags(query) {
        const tags = [];
        const keywords = ['meal', 'diet', 'nutrition', 'vitamin', 'exercise', 'sleep', 
                         'stress', 'weight', 'blood pressure', 'sugar', 'cholesterol'];
        const lower = query.toLowerCase();
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                tags.push(keyword);
            }
        }
        return tags;
    }


    // ============================================
    // UI HELPERS
    // ============================================

    addMessage(type, text) {
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
        
        conversationArea.appendChild(messageDiv);
        conversationArea.scrollTop = conversationArea.scrollHeight;
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
        indicator.id = 'typingIndicator';
        indicator.className = 'message assistant';
        indicator.innerHTML = `
            <div class="message-icon"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <p><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></p>
            </div>
        `;
        conversationArea.appendChild(indicator);
        conversationArea.scrollTop = conversationArea.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        // Voice button - toggle listening
        const voiceBtn = document.getElementById('voiceBtn');
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
            voiceInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && voiceInput.value.trim()) {
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

        const mealBtn = document.getElementById("generateMealBtn");
        if (mealBtn) {
            mealBtn.addEventListener("click", () => {
                this.generateMealPlan(document.getElementById("healthConcern")?.value);
            });
        }
        document.getElementById("healthConcern")?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") this.generateMealPlan(event.currentTarget.value);
        });

        // Health tools catalogue
        const toolPanel = document.getElementById("toolPanel");
        const toolMenuItems = document.querySelectorAll(".tool-menu-item");
        const toolHeader = (icon, title, description) => `<div class="tool-panel-header"><i class="fas ${icon}"></i><div><h3>${title}</h3><p>${description}</p></div></div>`;
        const field = (id, label, unit, type = "number") => `<div class="tool-field"><label for="${id}">${label}</label><div class="input-unit"><input id="${id}" type="${type}" inputmode="decimal" min="0" />${unit ? `<span>${unit}</span>` : ""}</div></div>`;
        const resultBox = (id, text) => `<div class="tool-result" id="${id}">${text}</div>`;

        const renderBmi = (unit = "metric") => {
            if (!toolPanel) return;
            const inputs = unit === "metric"
                ? `${field("bmiHeight", "Height", "cm")}${field("bmiWeight", "Weight", "kg")}`
                : `${field("bmiFeet", "Height", "ft")}${field("bmiInches", "Height", "in")}${field("bmiPounds", "Weight", "lb")}`;
            toolPanel.innerHTML = `${toolHeader("fa-weight-scale", "BMI Calculator", "An adult body-mass-index screening tool using your preferred units.")}
                <div class="unit-tabs" role="tablist"><button class="unit-tab ${unit === "metric" ? "active" : ""}" type="button" data-unit="metric">Metric (cm / kg)</button><button class="unit-tab ${unit === "us" ? "active" : ""}" type="button" data-unit="us">Feet & pounds</button></div>
                <div class="tool-form">${inputs}<button class="btn-primary tool-action" type="button" data-action="bmi">Calculate BMI</button></div>
                ${resultBox("toolResult", "Enter your height and weight to see your BMI.")}<p class="tool-note">For adults only. BMI is a screening measure, not a diagnosis, and may not reflect health for every body type, pregnancy, or condition.</p>`;
            toolPanel.querySelectorAll(".unit-tab").forEach(button => button.addEventListener("click", () => renderBmi(button.dataset.unit)));
        };

        const toolViews = {
            bmr: () => `${toolHeader("fa-fire", "BMR Calculator", "Estimate resting energy use using age, gender, height, and weight.")}<div class="tool-form">${field("bmrAge", "Age", "years")}${field("bmrWeight", "Weight", "kg")}${field("bmrHeight", "Height", "cm")}<div class="tool-field"><label for="bmrSex">Gender</label><select id="bmrSex"><option value="female">Female</option><option value="male">Male</option></select></div><button class="btn-primary tool-action" type="button" data-action="bmr">Calculate BMR</button></div>${resultBox("toolResult", "This estimate is not a calorie prescription.")}<p class="tool-note">Energy needs vary with health status, pregnancy, medicines, and activity. Discuss personalised targets with a dietitian.</p>`,
            calorie: () => `${toolHeader("fa-bowl-food", "Calorie Calculator", "Estimate daily maintenance calories using your age, gender, height, weight, and activity.")}<div class="tool-form">${field("calAge", "Age", "years")}${field("calWeight", "Weight", "kg")}${field("calHeight", "Height", "cm")}<div class="tool-field"><label for="calSex">Gender</label><select id="calSex"><option value="female">Female</option><option value="male">Male</option></select></div><div class="tool-field"><label for="calActivity">Activity level</label><select id="calActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><button class="btn-primary tool-action" type="button" data-action="calorie">Calculate calories</button></div>${resultBox("toolResult", "Complete the fields to see a general maintenance estimate.")}<p class="tool-note">This is an estimate, not a personalised nutrition prescription.</p>`,
            tdee: () => `${toolHeader("fa-person-running", "TDEE Calculator", "Estimate total daily energy expenditure from your age, gender, measurements, and activity.")}<div class="tool-form">${field("tdeeAge", "Age", "years")}${field("tdeeWeight", "Weight", "kg")}${field("tdeeHeight", "Height", "cm")}<div class="tool-field"><label for="tdeeSex">Gender</label><select id="tdeeSex"><option value="female">Female</option><option value="male">Male</option></select></div><div class="tool-field"><label for="tdeeActivity">Activity level</label><select id="tdeeActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><button class="btn-primary tool-action" type="button" data-action="tdee">Calculate TDEE</button></div>${resultBox("toolResult", "Complete the fields to estimate your TDEE.")}<p class="tool-note">TDEE can vary substantially from day to day and is not a medical recommendation.</p>`,
            deficit: () => `${toolHeader("fa-arrow-trend-down", "Calorie Deficit Calculator", "Estimate a moderate calorie-deficit range from your daily energy needs.")}<div class="tool-form">${field("defAge", "Age", "years")}${field("defWeight", "Weight", "kg")}${field("defHeight", "Height", "cm")}<div class="tool-field"><label for="defSex">Gender</label><select id="defSex"><option value="female">Female</option><option value="male">Male</option></select></div><div class="tool-field"><label for="defActivity">Activity level</label><select id="defActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div>${field("deficitAmount", "Daily deficit", "kcal", "number")}<button class="btn-primary tool-action" type="button" data-action="deficit">Calculate target</button></div>${resultBox("toolResult", "Complete the fields; a 500 kcal/day deficit is used when left blank.")}<p class="tool-note">Avoid aggressive restriction. Pregnancy, adolescence, eating disorders, illness, or medication use need clinician guidance.</p>`,
            bodyfat: () => `${toolHeader("fa-percent", "Body Fat Calculator", "Estimate body fat percentage from circumference measurements and gender.")}<div class="tool-form">${field("bfHeight", "Height", "cm")}${field("bfWaist", "Waist", "cm")}${field("bfNeck", "Neck", "cm")}<div class="tool-field"><label for="bfSex">Gender</label><select id="bfSex"><option value="female">Female</option><option value="male">Male</option></select></div>${field("bfHip", "Hip (for female estimate)", "cm")}<button class="btn-primary tool-action" type="button" data-action="bodyfat">Estimate body fat</button></div>${resultBox("toolResult", "Complete the relevant measurements to see an estimate.")}<p class="tool-note">Circumference-based body-fat figures have a wide margin of error and are not a diagnosis.</p>`,
            macro: () => `${toolHeader("fa-chart-pie", "Macro Calculator", "Estimate a balanced macro split from your age, gender, measurements, and activity.")}<div class="tool-form">${field("macroAge", "Age", "years")}${field("macroWeight", "Weight", "kg")}${field("macroHeight", "Height", "cm")}<div class="tool-field"><label for="macroSex">Gender</label><select id="macroSex"><option value="female">Female</option><option value="male">Male</option></select></div><div class="tool-field"><label for="macroActivity">Activity level</label><select id="macroActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><button class="btn-primary tool-action" type="button" data-action="macro">Calculate macros</button></div>${resultBox("toolResult", "Complete the fields for an illustrative daily macro estimate.")}<p class="tool-note">Macro targets should be individualised for medical conditions and pregnancy.</p>`,
            protein: () => `${toolHeader("fa-drumstick-bite", "Protein Calculator", "Estimate a general daily protein range from weight and activity.")}<div class="tool-form">${field("proteinWeight", "Weight", "kg")}<div class="tool-field"><label for="proteinActivity">Activity level</label><select id="proteinActivity"><option value="0.8">Mostly sedentary</option><option value="1.0">Regular activity</option><option value="1.2">Frequent training</option></select></div><button class="btn-primary tool-action" type="button" data-action="protein">Calculate protein</button></div>${resultBox("toolResult", "Enter your weight and activity level.")}<p class="tool-note">People with kidney disease or other medical conditions should seek personal advice before changing protein intake.</p>`,
            weightloss: () => `${toolHeader("fa-scale-balanced", "Weight Loss Calculator", "Estimate the calorie gap associated with a chosen weight-loss pace.")}<div class="tool-form">${field("wlAge", "Age", "years")}${field("wlWeight", "Current weight", "kg")}${field("wlHeight", "Height", "cm")}<div class="tool-field"><label for="wlSex">Gender</label><select id="wlSex"><option value="female">Female</option><option value="male">Male</option></select></div><div class="tool-field"><label for="wlActivity">Activity level</label><select id="wlActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><div class="tool-field"><label for="wlPace">Preferred pace</label><select id="wlPace"><option value="0.25">0.25 kg/week</option><option value="0.5">0.5 kg/week</option></select></div><button class="btn-primary tool-action" type="button" data-action="weightloss">Estimate plan</button></div>${resultBox("toolResult", "Complete the fields for a general estimate.")}<p class="tool-note">Sustainable progress varies. Do not use this tool for children, pregnancy, eating disorders, or unintentional weight loss.</p>`,
        };

        const showTool = (tool) => {
            toolMenuItems.forEach(item => {
                const active = item.dataset.tool === tool;
                item.classList.toggle("active", active);
                item.setAttribute("aria-pressed", String(active));
            });
            if (tool === "bmi") renderBmi();
            else if (toolPanel && toolViews[tool]) {
                toolPanel.innerHTML = toolViews[tool]();
                toolPanel.style.animation = "none";
                requestAnimationFrame(() => { toolPanel.style.animation = ""; });
            }
        };

        const number = id => Number.parseFloat(document.getElementById(id)?.value);
        toolPanel?.addEventListener("click", event => {
            const action = event.target.closest("[data-action]")?.dataset.action;
            const result = document.getElementById("toolResult");
            if (!action || !result) return;
            if (action === "bmi") {
                const metric = document.getElementById("bmiHeight");
                const weight = metric ? number("bmiWeight") : number("bmiPounds") * 0.453592;
                const heightM = metric ? number("bmiHeight") / 100 : ((number("bmiFeet") * 12) + number("bmiInches")) * 0.0254;
                if (!(weight > 0 && heightM > 0)) return void (result.textContent = "Please enter valid height and weight values.");
                const bmi = weight / (heightM ** 2);
                const category = bmi < 18.5 ? "Underweight range" : bmi < 25 ? "Healthy weight range" : bmi < 30 ? "Overweight range" : "Obesity range";
                result.innerHTML = `<strong>BMI: ${bmi.toFixed(1)}</strong><br>${category}.`;
            }
            if (action === "bmr") {
                const age = number("bmrAge"), weight = number("bmrWeight"), height = number("bmrHeight"), sex = document.getElementById("bmrSex")?.value;
                if (!(age > 0 && weight > 0 && height > 0)) return void (result.textContent = "Please complete all fields with valid values.");
                const bmr = sex === "male" ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
                result.innerHTML = `<strong>Estimated BMR: ${Math.round(bmr)} kcal/day</strong><br>This estimates energy used at rest, not your personal food target.`;
            }
            if (["calorie", "tdee", "deficit", "macro", "weightloss"].includes(action)) {
                const prefix = action === "calorie" ? "cal" : action === "tdee" ? "tdee" : action === "deficit" ? "def" : action === "macro" ? "macro" : "wl";
                const age = number(`${prefix}Age`), weight = number(`${prefix}Weight`), height = number(`${prefix}Height`);
                const sex = document.getElementById(`${prefix}Sex`)?.value;
                const activity = Number.parseFloat(document.getElementById(`${prefix}Activity`)?.value);
                if (!(age > 0 && weight > 0 && height > 0 && activity > 0)) return void (result.textContent = "Please complete all fields with valid values.");
                const bmr = sex === "male" ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
                const tdee = bmr * activity;
                if (action === "calorie") result.innerHTML = `<strong>Estimated maintenance calories: ${Math.round(tdee)} kcal/day</strong><br>This is a general estimate based on your selected activity level.`;
                if (action === "tdee") result.innerHTML = `<strong>Estimated TDEE: ${Math.round(tdee)} kcal/day</strong><br>Estimated BMR: ${Math.round(bmr)} kcal/day.`;
                if (action === "deficit") {
                    const deficit = number("deficitAmount") || 500;
                    if (!(deficit > 0 && deficit < tdee)) return void (result.textContent = "Please enter a calorie deficit that is lower than your estimated maintenance calories.");
                    result.innerHTML = `<strong>Estimated daily target: ${Math.round(tdee - deficit)} kcal/day</strong><br>This uses a ${Math.round(deficit)} kcal/day deficit from an estimated maintenance of ${Math.round(tdee)} kcal/day.`;
                }
                if (action === "macro") {
                    const protein = Math.round((tdee * .25) / 4), carbs = Math.round((tdee * .45) / 4), fat = Math.round((tdee * .30) / 9);
                    result.innerHTML = `<strong>Illustrative daily macros for ${Math.round(tdee)} kcal</strong><br>Protein: ${protein} g · Carbohydrate: ${carbs} g · Fat: ${fat} g.`;
                }
                if (action === "weightloss") {
                    const pace = Number.parseFloat(document.getElementById("wlPace")?.value);
                    const dailyGap = (pace * 7700) / 7;
                    if (!(dailyGap > 0 && dailyGap < tdee)) return void (result.textContent = "That pace is not suitable for this estimate. Please discuss weight goals with a clinician.");
                    result.innerHTML = `<strong>Estimated daily target: ${Math.round(tdee - dailyGap)} kcal/day</strong><br>That corresponds to about ${pace} kg/week from an estimated maintenance of ${Math.round(tdee)} kcal/day.`;
                }
            }
            if (action === "bodyfat") {
                const height = number("bfHeight"), waist = number("bfWaist"), neck = number("bfNeck"), hip = number("bfHip"), sex = document.getElementById("bfSex")?.value;
                const valid = sex === "male" ? height > 0 && waist > neck : height > 0 && waist + hip > neck;
                if (!valid) return void (result.textContent = "Please enter valid measurements; for women, include hip circumference.");
                const inches = 0.393701;
                const value = sex === "male" ? 495 / (1.0324 - .19077 * Math.log10((waist - neck) * inches) + .15456 * Math.log10(height * inches)) - 450 : 495 / (1.29579 - .35004 * Math.log10((waist + hip - neck) * inches) + .221 * Math.log10(height * inches)) - 450;
                result.innerHTML = `<strong>Estimated body fat: ${value.toFixed(1)}%</strong><br>This circumference-based result is only a rough screening estimate.`;
            }
            if (action === "protein") {
                const weight = number("proteinWeight"), multiplier = Number.parseFloat(document.getElementById("proteinActivity")?.value);
                if (!(weight > 0 && multiplier > 0)) return void (result.textContent = "Please enter a valid weight and activity level.");
                result.innerHTML = `<strong>General protein estimate: ${Math.round(weight * multiplier)} g/day</strong><br>Based on ${multiplier} g per kg of body weight.`;
            }
        });
        toolMenuItems.forEach(item => item.addEventListener("click", () => showTool(item.dataset.tool)));
        if (toolPanel) showTool("bmi");

        // Demo button
        const demoBtn = document.getElementById('demoBtn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.runDemo();
            });
        }

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

    // ============================================
    // DEMO MODE
    // ============================================

    runDemo() {
        const demos = [
            "Let me show you what I can do!",
            "Ask me any health question and I'll give you a personalized answer.",
            "You can ask me follow up questions in this conversation.",
            "I speak responses using your browser's built in speech voice.",
            "Try asking me about meal planning, nutrition, or medications!",
            "What would you like to know about today?"
        ];
        
        let index = 0;
        const showNext = () => {
            if (index < demos.length) {
                this.addMessage('assistant', demos[index]);
                this.rime.speak(demos[index]);
                index++;
                setTimeout(showNext, 2500);
            }
        };
        showNext();
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


