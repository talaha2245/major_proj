# System Architecture - EchoMind AI Assistant

## Overview
EchoMind is a full-stack AI-powered search and assistant application that combines a **FastAPI backend** with a **React TypeScript frontend**, leveraging the **LangChain framework** to create an intelligent agent with real-time tool access and streaming responses.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                          │
│                     (React + TypeScript + Vite)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  LandingPage │    │   ChatPage   │    │   DocsPage   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                              │                                    │
│                              ▼                                    │
│                    ┌──────────────────┐                          │
│                    │  User Interface  │                          │
│                    │   - Input Field  │                          │
│                    │   - Chat Display │                          │
│                    │   - Tool Badges  │                          │
│                    │   - Voice I/O    │                          │
│                    └──────────────────┘                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP POST /api/chat
                            │ (JSON Payload: query, history, mode)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND LAYER                           │
│                        (FastAPI + Python)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    FastAPI Application                      │ │
│  │  - CORS Middleware                                          │ │
│  │  - Routers: /api/chat, /api/auth, /api/healthCheck         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Chat Router (routers/chat.py)                  │ │
│  │  - Validates incoming ChatRequest                           │ │
│  │  - Returns StreamingResponse (SSE)                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         LangChain Agent (agent/langchain_agent.py)          │ │
│  │  - Initializes Groq LLM (openai/gpt-oss-120b)              │ │
│  │  - Binds Tools to LLM                                       │ │
│  │  - Creates Agent Executor with Tool Calling                │ │
│  │  - Streams tokens and tool usage via SSE                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     TOOL ECOSYSTEM                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │ Weather Tool │  │  News Tool   │  │ Search Tool  │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │  Time Tool   │  │ Scrape Tool  │  │ Finance Tool │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  │  ┌──────────────┐  ┌──────────────┐                        │ │
│  │  │  ArXiv Tool  │  │  Gmail Tool  │                        │ │
│  │  └──────────────┘  └──────────────┘                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│  • Groq API (LLM Provider)                                       │
│  • DuckDuckGo Search API                                         │
│  • News API                                                      │
│  • Weather API                                                   │
│  • Finance/Crypto APIs                                           │
│  • ArXiv API                                                     │
│  • Gmail API (OAuth2)                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Frontend Layer

**Technology Stack:**
- React 18 with TypeScript
- Vite (Build Tool)
- TailwindCSS (Styling)
- Framer Motion (Animations)
- Jotai (State Management)

**Key Components:**

#### ChatPage.tsx
- **Purpose**: Main chat interface
- **Features**:
  - Real-time message streaming
  - Tool usage visualization
  - Voice input/output (Speech Recognition & Synthesis)
  - Three conversation modes: Fast, Normal, Deep
  - Message history management
  - Server-Sent Events (SSE) handling

#### Message Flow:
1. User inputs query
2. Frontend sends POST request to `/api/chat`
3. Receives SSE stream from backend
4. Parses events: `token`, `tool`, `error`
5. Updates UI in real-time

---

### 2. Backend Layer

**Technology Stack:**
- FastAPI (Web Framework)
- LangChain (Agent Framework)
- Groq (LLM Provider)
- Python 3.x

**Key Modules:**

#### app.py
- Main FastAPI application
- CORS middleware configuration
- Router registration
- API entry point


#### routers/chat.py
- **Endpoint**: `POST /api/chat`
- **Input**: 
  ```json
  {
    "query": "string",
    "history": [{"role": "user|assistant", "content": "string"}],
    "google_credentials": {},
    "mode": "fast|normal|deep"
  }
  ```
- **Output**: Server-Sent Events (SSE) stream
- Validates requests and initiates streaming response

#### agent/langchain_agent.py
- **Core Agent Logic**
- Creates LangChain agent with tool binding
- Handles three modes:
  - **Fast Mode**: Quick responses, minimal tool usage (5 iterations)
  - **Normal Mode**: Balanced responses with context (15 iterations)
  - **Deep Mode**: Comprehensive research with multiple tools (30 iterations)
- Streams responses via SSE

---

### 3. Tool Ecosystem

The agent has access to 9+ specialized tools:

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| **search_tool** | DuckDuckGo web search | Query string | Search results |
| **weather_tool** | Global weather data | Location | Weather info |
| **news_tool** | Live news headlines | Topic/query | News articles |
| **time_tool** | System time/date | None | Current time |
| **scrape_webpage** | Web page scraping | URL | Page content |
| **finance_tool** | Stock/crypto prices | Symbol | Financial data |
| **arxiv_tool** | Academic paper search | Query | Research papers |
| **read_recent_emails** | Gmail inbox access | Credentials | Email list |
| **send_email** | Send emails via Gmail | To, subject, body | Confirmation |

---

## Data Flow

### Request Flow (User → AI)
```
User Input → ChatPage Component → fetch() POST Request 
→ FastAPI Router → langchain_agent.py → LLM (Groq) 
→ Tool Selection → Tool Execution → Response Generation
```

### Response Flow (AI → User)
```
LLM Tokens → SSE Stream → EventSource Reader → State Update 
→ React Re-render → Markdown Display → User Sees Response
```

---

## Key Features

### 1. Streaming Responses
- Uses Server-Sent Events (SSE) for real-time token streaming
- Progressive UI updates as tokens arrive
- Better user experience than traditional request-response

### 2. Tool Calling Agent
- LangChain's `AgentExecutor` with `ToolsAgentOutputParser`
- Automatic tool selection based on query
- Multi-tool orchestration for complex queries

### 3. Conversation Modes
- **Fast**: Minimal context, quick answers
- **Normal**: 2 previous messages for context
- **Deep**: 10 previous messages for deep research

### 4. Context-Aware Chat
- Message history sent with each request
- Maintains conversation coherence
- Mode-dependent context window

### 5. Voice Interaction
- Speech-to-text input
- Text-to-speech output
- Enhances accessibility

---

## Security Features

1. **CORS Configuration**: Controls allowed origins
2. **Environment Variables**: Sensitive keys stored in `.env`
3. **OAuth2 for Gmail**: Secure credential handling
4. **Input Validation**: Pydantic models validate requests
5. **Error Handling**: Graceful error responses

---

## Deployment Architecture

- **Frontend**: Vite build → Static hosting (Vercel/Netlify)
- **Backend**: FastAPI → Render/Railway/AWS
- **Environment**: Docker support via `dockerfile`
- **CI/CD**: Automated deployments

---

## Technology Rationale

| Technology | Reason |
|------------|--------|
| **FastAPI** | High performance, async support, auto docs |
| **LangChain** | Modular agent framework, tool abstraction |
| **Groq** | Fast inference, cost-effective LLM hosting |
| **React** | Component-based UI, rich ecosystem |
| **TypeScript** | Type safety, better developer experience |
| **SSE** | Real-time streaming without WebSocket complexity |

---

## Future Enhancements

1. **Database Integration**: Persistent chat history
2. **User Authentication**: Multi-user support
3. **Custom Tool Creation**: User-defined tools
4. **Enhanced Analytics**: Usage tracking, metrics
5. **Multi-model Support**: Switch between different LLMs
6. **Memory System**: Long-term conversation memory
7. **File Upload**: Document analysis capabilities
