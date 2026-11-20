# HealMeal

A voice-enabled health information demo with a Node.js/Express backend, Groq AI chat, and ElevenLabs text-to-speech. The backend keeps all API keys out of frontend code.

## ElevenLabs AI voice

HealMeal speaks replies with an ElevenLabs voice. The default voice is **Sarah** ("Mature, Reassuring, Confident"), a free premade voice (voice ID `EXAVITQu4vr4xnSDxMaL`). Add your ElevenLabs API key to `.env`:

```env
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
ELEVENLABS_MODEL=eleven_multilingual_v2
```

The key stays on the server. If the key or voice ID is absent, or the service is unavailable, HealMeal falls back to the device's built-in browser voice. Voice Library voices may require a paid ElevenLabs account for API use; the configured Sarah voice is a free premade voice compatible with the account's API.

## Requirements

- Node.js 20 or newer
- A Groq API key from [Groq Console](https://console.groq.com/keys)

## Run locally

1. Open a terminal in this project folder.
2. Install the server dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your key to `GROQ_API_KEY`.
4. Start the app with `npm start`.
5. Open [http://localhost:8080](http://localhost:8080). Use this address so the browser can reach `/api/chat`.

The model can be changed with `GROQ_MODEL` in `.env`. The default is `openai/gpt-oss-120b`. Check your Groq account's current model availability and limits in Groq Console.

## Backend endpoints

- `GET /api/health` confirms the server is running.
- `POST /api/chat` accepts `{ "question": "...", "history": [] }` and returns `{ "answer": "..." }`.
- `POST /api/meal-plan` creates four meal ideas and condition-specific nutrition notes from a free-text health concern or goal. Meal ideas are designed for an Indian audience, favouring practical, affordable, locally available foods and familiar home cooking. Macro values are approximate estimates, not measured nutrition data.

The server validates input, limits request size and rate, and sends prompts to Groq using the server-side key. Conversation history is kept in this browser's local storage. This version does not use Qdrant: the old implementation generated random vectors, which cannot provide meaningful retrieval.

## Voice

Speech output uses ElevenLabs text-to-speech by default. If ElevenLabs is unavailable, the app falls back to the browser's built-in Web Speech synthesis. Speech input uses Web Speech recognition where available; typed questions remain supported.

## Important

This is a health information demo, not a medical device or a substitute for a licensed clinician. Meal suggestions are general information, not treatment; estimated macros can vary by ingredients and portions. The app does not identify nutrient deficiencies or prescribe supplements. People with allergies, kidney disease, pregnancy, medication interactions, or multiple conditions should get individualized clinician or dietitian advice. Do not use it for emergencies or diagnosis. Keep your Groq API key private in `.env`; do not place it in frontend code.

## Meal-plan references

Meal-plan reference links are selected on the server, not supplied by the model. The default sources are the [ICMR–National Institute of Nutrition Dietary Guidelines for Indians (2024)](https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf) and [FSSAI Eat Right India](https://fssai.gov.in/eat-right-india). Diabetes, hypertension and obesity use topic-specific National Centre for Disease Control (India) resources. For specialised topics without an equivalent Indian public resource in the app, an additional international government source is retained; unrecognised topics also receive a MedlinePlus search link.

