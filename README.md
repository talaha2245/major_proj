# EchoMind AI Assistant 🧠⚡

EchoMind is an elite, full-stack AI assistant featuring an advanced web interface and a powerful reasoning backend. Built with real-time streaming and modular tool access at its core, EchoMind acts as a comprehensive research and productivity companion.

## 🌟 Key Features

- **Real-Time Streaming Responses (SSE):** Near-instantaneous text generation using FastAPI streaming and Langchain's `astream_events`.
- **Integrated Voice Assistant:** Native Speech-to-Text (STT) for hands-free queries and Text-to-Speech (TTS) for spoken playback of full responses.
- **Dynamic Reasoning Modes:** Switch seamlessly between **Quick Reply**, **Standard Chat**, and **Deep Research** depending on task complexity.
- **Live Tool Ecosystem:** The AI leverages real-time functions:
  - ☔ Global Weather
  - 📰 Live News & Web Scraping
  - 🌐 DuckDuckGo Search
  - 📈 Finance / Crypto Tracker
  - 🎓 ArXiv Academic Papers
  - 📧 Gmail Integration (Read/Send emails securely)
- **Modern UI/UX:** Built with React, TypeScript, and Vite, featuring smooth Framer Motion animations, dark mode aesthetics, and Markdown/GFM support.

---

## 🏗️ Architecture

The application is split into two primary segments:

### Frontend
- **Framework:** React 18, TypeScript, Vite
- **Styling UI:** Tailwind CSS, Framer Motion, Lucide React icons
- **State Management:** Jotai
- **Speech API:** Web Speech API (`SpeechRecognition` & `speechSynthesis`)

### Backend
- **Framework:** FastAPI
- **AI Core:** Langchain (`langchain-groq`, `ToolsAgentOutputParser`)
- **LLM:** Groq ecosystem (e.g., Llama-3 / GPT models via OSS wrapper)
- **Hot-Reload:** Uvicorn

---

## 🚀 Getting Started

### 1. Backend Setup
1. Navigate to the `backend` directory: `cd backend`
2. Create a virtual environment and activate it.
3. Install dependencies: `pip install -r requirements.txt`
4. Set up your `.env` file with necessary keys (e.g., `GROQ_API_KEY`).
5. Run the server:
   ```bash
   python app.py
   # Or directly: uvicorn app:app --reload
   ```

### 2. Frontend Setup
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Usage
Open the local frontend URL (usually `http://localhost:5173`). EchoMind will automatically connect to the FastAPI backend running on port `8000`. You can type messages, click the Mic icon to speak, and toggle the voice replies using the Volume icon!

---

## 🛠️ Recent Updates
- **Voice Integration:** Added fully front-end STT/TTS with visual pulse animations.
- **Streaming Stability:** Resolved Pydantic AsyncStream LLM parsing errors for robust chunk delivery.

---
*Built for speed, depth, and seamless AI interactions.*
