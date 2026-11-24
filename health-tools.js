// Health calculator views, input checks, and result rendering.
window.setupHealthTools = function setupHealthTools() {
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
                <div class="unit-tabs" role="group" aria-label="Measurement units"><button class="unit-tab ${unit === "metric" ? "active" : ""}" type="button" data-unit="metric" aria-pressed="${unit === "metric"}">Metric (cm / kg)</button><button class="unit-tab ${unit === "us" ? "active" : ""}" type="button" data-unit="us" aria-pressed="${unit === "us"}">Feet & pounds</button></div>
                <div class="tool-form">${inputs}<button class="btn-primary tool-action" type="button" data-action="bmi">Calculate BMI</button></div>
                ${resultBox("toolResult", "Enter your height and weight to see your BMI.")}<p class="tool-note">For adults only. BMI is a screening measure, not a diagnosis, and may not reflect health for every body type, pregnancy, or condition.</p>`;
            toolPanel.querySelectorAll(".unit-tab").forEach(button => button.addEventListener("click", () => renderBmi(button.dataset.unit)));
        };

        const toolViews = {
            bmr: () => `${toolHeader("fa-fire", "BMR Calculator", "Estimate resting energy use using age, equation sex category, height, and weight.")}<div class="tool-form">${field("bmrAge", "Age", "years")}${field("bmrWeight", "Weight", "kg")}${field("bmrHeight", "Height", "cm")}<div class="tool-field"><label for="bmrSex">Equation sex category</label><select id="bmrSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div><button class="btn-primary tool-action" type="button" data-action="bmr">Calculate BMR</button></div>${resultBox("toolResult", "This estimate is not a calorie prescription.")}<p class="tool-note">Uses the Mifflin–St Jeor adult equation. It estimates resting energy and is not a food target.</p>`,
            calorie: () => `${toolHeader("fa-bowl-food", "Calorie Calculator", "Estimate daily maintenance calories using age, equation sex category, height, weight, and activity.")}<div class="tool-form">${field("calAge", "Age", "years")}${field("calWeight", "Weight", "kg")}${field("calHeight", "Height", "cm")}<div class="tool-field"><label for="calSex">Equation sex category</label><select id="calSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div><div class="tool-field"><label for="calActivity">Activity level</label><select id="calActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><button class="btn-primary tool-action" type="button" data-action="calorie">Calculate calories</button></div>${resultBox("toolResult", "Complete the fields to see a general maintenance estimate.")}<p class="tool-note">Uses the Mifflin–St Jeor adult equation and a selected activity multiplier; both are simplified estimates.</p>`,
            tdee: () => `${toolHeader("fa-person-running", "TDEE Calculator", "Estimate total daily energy expenditure from age, equation sex category, measurements, and activity.")}<div class="tool-form">${field("tdeeAge", "Age", "years")}${field("tdeeWeight", "Weight", "kg")}${field("tdeeHeight", "Height", "cm")}<div class="tool-field"><label for="tdeeSex">Equation sex category</label><select id="tdeeSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div><div class="tool-field"><label for="tdeeActivity">Activity level</label><select id="tdeeActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><button class="btn-primary tool-action" type="button" data-action="tdee">Calculate TDEE</button></div>${resultBox("toolResult", "Complete the fields to estimate your TDEE.")}<p class="tool-note">Uses the Mifflin–St Jeor equation with a selected activity multiplier; actual needs vary and are not a medical recommendation.</p>`,
            deficit: () => `${toolHeader("fa-arrow-trend-down", "Calorie Deficit Calculator", "Estimate a moderate calorie-deficit range from your daily energy needs.")}<div class="tool-form">${field("defAge", "Age", "years")}${field("defWeight", "Weight", "kg")}${field("defHeight", "Height", "cm")}<div class="tool-field"><label for="defSex">Equation sex category</label><select id="defSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div><div class="tool-field"><label for="defActivity">Activity level</label><select id="defActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div>${field("deficitAmount", "Daily deficit", "kcal", "number")}<button class="btn-primary tool-action" type="button" data-action="deficit">Calculate target</button></div>${resultBox("toolResult", "A blank deficit uses 500 kcal/day. The estimate is limited to 500 kcal/day and rejected if the result falls below estimated resting energy.")}<p class="tool-note">Avoid aggressive restriction. Pregnancy, adolescence, eating disorders, illness, or medication use need clinician guidance.</p>`,
            bodyfat: () => `${toolHeader("fa-percent", "Body Fat Calculator", "Estimate body fat percentage from circumference measurements and gender.")}<div class="tool-form">${field("bfHeight", "Height", "cm")}${field("bfWaist", "Waist", "cm")}${field("bfNeck", "Neck", "cm")}<div class="tool-field"><label for="bfSex">Equation sex category</label><select id="bfSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div>${field("bfHip", "Hip (for female estimate)", "cm")}<button class="btn-primary tool-action" type="button" data-action="bodyfat">Estimate body fat</button></div>${resultBox("toolResult", "Complete the relevant measurements to see an estimate.")}<p class="tool-note">Uses a circumference-based US Navy equation. Measurement error can be large; this is not a diagnosis.</p>`,
            macro: () => `${toolHeader("fa-chart-pie", "Macro Calculator", "Estimate a balanced macro split from age, equation sex category, measurements, and activity.")}<div class="tool-form">${field("macroAge", "Age", "years")}${field("macroWeight", "Weight", "kg")}${field("macroHeight", "Height", "cm")}<div class="tool-field"><label for="macroSex">Equation sex category</label><select id="macroSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div><div class="tool-field"><label for="macroActivity">Activity level</label><select id="macroActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><button class="btn-primary tool-action" type="button" data-action="macro">Calculate macros</button></div>${resultBox("toolResult", "Complete the fields for an illustrative daily macro estimate.")}<p class="tool-note">Illustrates a fixed 25% protein, 45% carbohydrate, and 30% fat split. It is not personalised; conditions or pregnancy need clinician guidance.</p>`,
            protein: () => `${toolHeader("fa-drumstick-bite", "Protein Calculator", "Estimate a general daily protein range from weight and activity.")}<div class="tool-form">${field("proteinWeight", "Weight", "kg")}<div class="tool-field"><label for="proteinActivity">Activity level</label><select id="proteinActivity"><option value="0.8">Mostly sedentary</option><option value="1.0">Regular activity</option><option value="1.2">Frequent training</option></select></div><button class="btn-primary tool-action" type="button" data-action="protein">Calculate protein</button></div>${resultBox("toolResult", "Enter your weight and activity level.")}<p class="tool-note">Uses a simple 0.8, 1.0, or 1.2 g/kg multiplier. People with kidney disease or other medical conditions should seek personal advice before changing intake.</p>`,
            weightloss: () => `${toolHeader("fa-scale-balanced", "Weight Loss Calculator", "Uses a simplified 7,700 kcal per kg energy equivalent; real weight change is not linear or predicted by this tool.")}<div class="tool-form">${field("wlAge", "Age", "years")}${field("wlWeight", "Current weight", "kg")}${field("wlHeight", "Height", "cm")}<div class="tool-field"><label for="wlSex">Equation sex category</label><select id="wlSex"><option value="female">Female equation</option><option value="male">Male equation</option></select></div><div class="tool-field"><label for="wlActivity">Activity level</label><select id="wlActivity"><option value="1.2">Sedentary</option><option value="1.375">Lightly active</option><option value="1.55">Moderately active</option><option value="1.725">Very active</option></select></div><div class="tool-field"><label for="wlPace">Preferred pace</label><select id="wlPace"><option value="0.25">0.25 kg/week</option><option value="0.5">0.5 kg/week</option></select></div><button class="btn-primary tool-action" type="button" data-action="weightloss">Estimate plan</button></div>${resultBox("toolResult", "Complete the fields for a general estimate.")}<p class="tool-note">Sustainable progress varies. Do not use this tool for children, pregnancy, eating disorders, or unintentional weight loss.</p>`,
            water: () => `${toolHeader("fa-glass-water", "Water Intake Calculator", "A general daily-fluid reminder based on body weight.")}<div class="tool-form">${field("waterWeight", "Weight", "kg")}<button class="btn-primary tool-action" type="button" data-action="water">Calculate water intake</button></div>${resultBox("toolResult", "Enter your weight for a general reminder.")}<p class="tool-note">Uses a rough 30 mL/kg daily estimate. Fluid needs vary with climate, exercise, health, pregnancy, and medicines; follow clinician-set limits.</p>`,
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
        const inRange = (id, min, max) => { const value = number(id); return Number.isFinite(value) && value >= min && value <= max; };
        toolPanel?.addEventListener("click", event => {
            const action = event.target.closest("[data-action]")?.dataset.action;
            const result = document.getElementById("toolResult");
            if (!action || !result) return;
            const invalid = message => { result.textContent = message; };
            if (action === "bmi") {
                const metric = document.getElementById("bmiHeight");
                const weight = metric ? number("bmiWeight") : number("bmiPounds") * 0.453592;
                const heightM = metric ? number("bmiHeight") / 100 : ((number("bmiFeet") * 12) + number("bmiInches")) * 0.0254;
                if (!(Number.isFinite(weight) && weight >= 25 && weight <= 300 && Number.isFinite(heightM) && heightM >= 1 && heightM <= 2.5)) return void invalid("Enter a height between 100 and 250 cm and a weight between 25 and 300 kg (or equivalent units).");
                const bmi = weight / (heightM ** 2);
                const category = bmi < 18.5 ? "Underweight range" : bmi < 25 ? "Healthy weight range" : bmi < 30 ? "Overweight range" : "Obesity range";
                result.innerHTML = `<strong>BMI: ${bmi.toFixed(1)}</strong><br>${category}.`;
            }
            if (action === "bmr") {
                const age = number("bmrAge"), weight = number("bmrWeight"), height = number("bmrHeight"), sex = document.getElementById("bmrSex")?.value;
                if (!(inRange("bmrAge", 18, 100) && inRange("bmrWeight", 25, 300) && inRange("bmrHeight", 100, 250))) return void invalid("For this adult estimate, enter age 18–100, weight 25–300 kg, and height 100–250 cm.");
                const bmr = sex === "male" ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
                result.innerHTML = `<strong>Estimated BMR: ${Math.round(bmr)} kcal/day</strong><br>This estimates energy used at rest, not your personal food target.`;
            }
            if (["calorie", "tdee", "deficit", "macro", "weightloss"].includes(action)) {
                const prefix = action === "calorie" ? "cal" : action === "tdee" ? "tdee" : action === "deficit" ? "def" : action === "macro" ? "macro" : "wl";
                const age = number(`${prefix}Age`), weight = number(`${prefix}Weight`), height = number(`${prefix}Height`);
                const sex = document.getElementById(`${prefix}Sex`)?.value;
                const activity = Number.parseFloat(document.getElementById(`${prefix}Activity`)?.value);
                if (!(inRange(`${prefix}Age`, 18, 100) && inRange(`${prefix}Weight`, 25, 300) && inRange(`${prefix}Height`, 100, 250) && Number.isFinite(activity) && activity >= 1.2 && activity <= 1.725)) return void invalid("For this adult estimate, enter age 18–100, weight 25–300 kg, height 100–250 cm, and a listed activity level.");
                const bmr = sex === "male" ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
                const tdee = bmr * activity;
                if (action === "calorie") result.innerHTML = `<strong>Estimated maintenance calories: ${Math.round(tdee)} kcal/day</strong><br>This is a general estimate based on your selected activity level.`;
                if (action === "tdee") result.innerHTML = `<strong>Estimated TDEE: ${Math.round(tdee)} kcal/day</strong><br>Estimated BMR: ${Math.round(bmr)} kcal/day.`;
                if (action === "deficit") {
                    const rawDeficit = document.getElementById("deficitAmount")?.value.trim();
                    const deficit = rawDeficit ? number("deficitAmount") : 500;
                    if (!(Number.isFinite(deficit) && deficit > 0 && deficit <= 500 && tdee - deficit >= bmr)) return void invalid("Choose a deficit up to 500 kcal/day that keeps the estimate at or above resting energy. Ask a clinician for a personal target.");
                    result.innerHTML = `<strong>Estimated daily target: ${Math.round(tdee - deficit)} kcal/day</strong><br>This uses a ${Math.round(deficit)} kcal/day deficit from an estimated maintenance of ${Math.round(tdee)} kcal/day.`;
                }
                if (action === "macro") {
                    const protein = Math.round((tdee * .25) / 4), carbs = Math.round((tdee * .45) / 4), fat = Math.round((tdee * .30) / 9);
                    result.innerHTML = `<strong>Illustrative daily macros for ${Math.round(tdee)} kcal</strong><br>Protein: ${protein} g · Carbohydrate: ${carbs} g · Fat: ${fat} g.`;
                }
                if (action === "weightloss") {
                    const pace = Number.parseFloat(document.getElementById("wlPace")?.value);
                    const dailyGap = (pace * 7700) / 7;
                    if (!(dailyGap > 0 && tdee - dailyGap >= bmr)) return void invalid("That pace would put the estimated target below resting energy. Please discuss weight goals with a clinician.");
                    result.innerHTML = `<strong>Estimated daily target: ${Math.round(tdee - dailyGap)} kcal/day</strong><br>That corresponds to about ${pace} kg/week from an estimated maintenance of ${Math.round(tdee)} kcal/day.`;
                }
            }
            if (action === "bodyfat") {
                const height = number("bfHeight"), waist = number("bfWaist"), neck = number("bfNeck"), hip = number("bfHip"), sex = document.getElementById("bfSex")?.value;
                const valid = sex === "male" ? height > 0 && waist > neck : height > 0 && waist + hip > neck;
                if (!valid || !inRange("bfHeight", 100, 250) || !inRange("bfWaist", 25, 250) || !inRange("bfNeck", 20, 100) || (sex !== "male" && !inRange("bfHip", 25, 250))) return void invalid("Enter plausible measurements: height 100–250 cm, waist/hip 25–250 cm, and neck 20–100 cm.");
                const inches = 0.393701;
                const value = sex === "male" ? 495 / (1.0324 - .19077 * Math.log10((waist - neck) * inches) + .15456 * Math.log10(height * inches)) - 450 : 495 / (1.29579 - .35004 * Math.log10((waist + hip - neck) * inches) + .221 * Math.log10(height * inches)) - 450;
                result.innerHTML = `<strong>Estimated body fat: ${value.toFixed(1)}%</strong><br>This circumference-based result is only a rough screening estimate.`;
            }
            if (action === "protein") {
                const weight = number("proteinWeight"), multiplier = Number.parseFloat(document.getElementById("proteinActivity")?.value);
                if (!(inRange("proteinWeight", 25, 300) && Number.isFinite(multiplier) && multiplier >= 0.8 && multiplier <= 1.2)) return void invalid("Enter weight from 25–300 kg and choose a listed activity level.");
                result.innerHTML = `<strong>General protein estimate: ${Math.round(weight * multiplier)} g/day</strong><br>Based on ${multiplier} g per kg of body weight.`;
            }
            if (action === "water") { const weight = number("waterWeight"); result.innerHTML = inRange("waterWeight", 25, 300) ? `<strong>General reminder: around ${(weight * 0.03).toFixed(1)} L of fluids daily</strong><br>Adjust for thirst, climate, activity, and any clinician-set fluid limits.` : "Please enter a valid weight."; }
        });
        toolMenuItems.forEach(item => item.addEventListener("click", () => showTool(item.dataset.tool)));
        if (toolPanel) showTool("bmi");

    };
