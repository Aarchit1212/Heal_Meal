# 💙 HealMeal – Voice-Powered Health Companion

### Practical nutrition and health information for everyday use

## 🌿 About HealMeal

HealMeal is a voice-enabled health information and nutrition demo designed with Indian users in mind. It brings conversational guidance, meal ideas, nutrition estimates, medication reminders, and health calculators together in one responsive web app.

Meal ideas focus on affordable, familiar Indian foods and seasonal produce. The app can use Groq for AI-generated responses and meal suggestions, with optional ElevenLabs text-to-speech and browser speech features where supported.

HealMeal provides general educational information. It does not diagnose conditions or prescribe treatment, medicines, or diets.

---

## ✨ Features

### 🎙️ Voice interaction

Ask questions using speech where browser speech recognition is supported, or type them into the chat. Spoken responses can use optional ElevenLabs text-to-speech, with the browser's built-in speech synthesis as a fallback.

### 🤖 Health information chat and meal ideas

Groq powers the health-information chat and meal-plan suggestions. The backend keeps API credentials out of browser code. Meal ideas include approximate nutrition estimates and relevant health-reference links.

### 🇮🇳 Localized food suggestions

Suggestions emphasize practical, affordable choices, familiar Indian foods, and seasonal produce.

### ⏰ Medication reminders

Add reminders with a medication name, time, optional short note, and alarm sound. Reminder data is saved in this browser's local storage. Alarms and notifications are best effort and depend on the page being open and browser notification permission.

### 📊 Health calculators

HealMeal includes ten calculators for general estimates:

| Calculator | Purpose |
| --- | --- |
| BMI | Estimates Body Mass Index. |
| Calorie | Estimates daily calorie needs. |
| TDEE | Estimates Total Daily Energy Expenditure. |
| Calorie deficit | Estimates a calorie deficit. |
| Body fat | Estimates body fat percentage. |
| Macro | Estimates macronutrient needs. |
| Protein | Estimates protein needs. |
| Water intake | Estimates daily water intake. |
| Weight loss | Estimates weight-loss timelines. |
| BMR | Estimates Basal Metabolic Rate. |

### 🔐 Privacy and security

- Chat history and medication reminders are stored locally in the browser and can be removed with **Clear Saved Data**.
- Groq processes chat and meal-plan requests. ElevenLabs processes text for speech only when configured and used.
- API keys are kept on the server and should be configured as environment variables.
- The backend applies request limits and security headers. Upstash Redis can provide shared rate limits across Vercel instances.

### 📚 Health references

Meal-plan responses can link to sources including ICMR–National Institute of Nutrition, FSSAI, and the National Centre for Disease Control.

---

## 🛠️ Technologies

| Technology | Purpose |
| --- | --- |
| HTML, CSS, browser JavaScript | Frontend and interactive features |
| Node.js and Express | Backend and API routes |
| Groq API | AI chat and meal ideas |
| ElevenLabs API | Optional speech generation |
| Browser Speech APIs | Voice input and speech fallback where supported |
| Upstash Redis | Optional shared rate limiting |
| Helmet and Express rate limiting | Backend security headers and request limits |
| Playwright and Node.js test runner | Automated checks |
| Vercel | Hosting |

---

## 🚀 Run locally

### Requirements

- Node.js 20 or newer
- npm
- A Groq API key for AI chat and meal-plan features
- ElevenLabs API key and voice ID for ElevenLabs speech (optional)
- Upstash Redis REST credentials for shared rate limiting on Vercel (optional)

### Setup

Clone your repository and move into the project directory:

```powershell
git clone https://github.com/Aarchit1212/Heal_Meal.git
cd Heal_Meal
npm install
Copy-Item .env.example .env
```

Edit `.env` and add your private keys. Start the server:

```powershell
npm start
```

Open the local address shown in the terminal. The default is [http://localhost:3000](http://localhost:3000). Keep the terminal open while using the local app; press `Ctrl+C` there to stop the server.

---

## ⚙️ Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | For AI features | Private Groq API key for chat and meal-plan requests. |
| `GROQ_MODEL` | Optional | Groq model name; defaults to `openai/gpt-oss-120b`. Availability depends on your Groq account. |
| `ELEVENLABS_API_KEY` | For ElevenLabs speech | Private API key for speech generation. |
| `ELEVENLABS_VOICE_ID` | For ElevenLabs speech | Voice used for generated speech. |
| `ELEVENLABS_MODEL` | Optional | Speech model; defaults to `eleven_multilingual_v2`. |
| `PORT` | Optional | Local server port; defaults to `3000`. Vercel provides its own runtime port. |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL for shared rate limits. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Private Upstash Redis token. Keep it server-side. |

Never commit `.env` or put API keys in browser code. `.gitignore` excludes `.env`. On Vercel, configure environment variables in the project settings and redeploy after changing them. Without both Upstash values, the app uses per-instance in-memory rate limits, which do not coordinate across Vercel instances.

If ElevenLabs is not configured or unavailable, speech output can fall back to the browser's built-in voice. Speech recognition depends on browser support and permissions.

---

## 🔗 API endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Checks whether the backend is responding. |
| `/api/chat` | POST | Answers a general health-information question. |
| `/api/meal-plan` | POST | Generates meal ideas, approximate nutrition estimates, and references. |
| `/api/voice` | POST | Generates speech audio when ElevenLabs is configured. |

---

## 🧪 Automated checks

Run the automated checks with:

```powershell
npm test
```

This runs Node.js backend tests and Playwright browser checks. The browser checks cover calculators, medication reminders and saved-data clearing, chat behavior, simulated AI and voice outages, keyboard access, responsive layouts, and accessibility rules. Tests do not make real requests to Groq or ElevenLabs.

To install Chromium for browser checks:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = ".playwright-browsers"
npx playwright install chromium
npm test
```

---

## 🌐 Deployment

HealMeal is configured for Vercel, where the backend runs remotely. Import the GitHub repository into Vercel, set the required environment variables in the Vercel project settings, and deploy. Redeploy after changing environment variables. For shared rate limits across serverless instances, configure both Upstash Redis REST values.

Live site: [https://heal-meal.vercel.app/](https://heal-meal.vercel.app/)

---

## ⚠️ Health and nutrition notice

HealMeal provides general educational information. It is not a medical device and does not provide diagnoses, treatment, prescriptions, or individualized medical advice. Calculator outputs and meal nutrition estimates are approximate and should not replace advice from a qualified healthcare professional or registered dietitian. Seek individualized advice before making dietary changes if you have allergies, kidney disease, are pregnant, take medicines that may interact with foods, or have multiple health conditions. Do not use HealMeal for emergencies.

---

## 📖 References

- [ICMR–National Institute of Nutrition: Dietary Guidelines for Indians (2024)](https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf)
- [FSSAI Eat Right India](https://fssai.gov.in/eat-right-india)
- [National Centre for Disease Control](https://ncdc.mohfw.gov.in/)
- [MedlinePlus](https://medlineplus.gov/)

---

## 🔗 Project links

- [GitHub repository](https://github.com/Aarchit1212/Heal_Meal)
- [Live website](https://heal-meal.vercel.app/)
