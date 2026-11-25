// Owns browser-local medication reminder state, controls, and alarms.
window.HealMealMedicationReminders = class {
    constructor() {
        this.medications = JSON.parse(localStorage.getItem("healmeal_medications") || "[]");
        this.alarmTimer = null;
        this.lastAlarmCheckAt = new Date(Date.now() - 60_000);
        this.setupMedicationReminders();
    }

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
};
