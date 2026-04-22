# Design Flow: Query Processing Example

## Query: "how is war in iran"

This document provides a complete technical walkthrough of what happens when a user types the query **"how is war in iran"** in the EchoMind AI Assistant, from the moment they press send to receiving the final AI-generated response.

---

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Step-by-Step Flow](#step-by-step-flow)
4. [Tool Execution Details](#tool-execution-details)
5. [Response Generation](#response-generation)
6. [Timeline & Performance](#timeline--performance)
7. [Mode Comparison](#mode-comparison)

---

## Overview

### Query Information
- **User Input**: "how is war in iran"
- **Query Type**: Current events / News
- **Expected Tools**: News API, Search API, possibly Web Scraper
- **Conversation Mode**: Can be Fast, Normal, or Deep
- **Response Format**: Markdown-formatted comprehensive answer

### High-Level Flow
```
User Types Query → Frontend Capture → HTTP POST → Backend Router 
→ LangChain Agent Init → LLM Analysis → Tool Selection → Tool Execution 
→ Result Synthesis → Token Streaming → Real-Time UI Update
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + TypeScript)                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                        ChatPage Component                       │ │
│  │  • User Input: "how is war in iran"                            │ │
│  │  • Mode Selector: Fast / Normal / Deep                         │ │
│  │  • Message Display with Real-time Streaming                    │ │
│  │  • Tool Usage Badges                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│                                  │ HTTP POST /api/chat               │
│                                  │ Body: {query, history, mode}      │
│                                  ▼                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI + Python)                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     FastAPI Router (/api/chat)                  │ │
│  │  • Validates Request (Pydantic)                                │ │
│  │  • Returns StreamingResponse (SSE)                             │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                          │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              LangChain Agent (langchain_agent.py)               │ │
│  │  • Initializes Groq LLM (gpt-oss-120b)                         │ │
│  │  • Loads Tools: news, search, scrape, weather, etc.            │ │
│  │  • Creates Agent Executor                                      │ │
│  │  • Processes Query with Tools                                  │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      TOOL ECOSYSTEM                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │  news_tool   │  │ search_tool  │  │scrape_webpage│      │   │
│  │  │ (DuckDuckGo) │  │ (DuckDuckGo) │  │(BeautifulSoup│      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                              │
│  • Groq API (LLM Inference)                                         │
│  • DuckDuckGo Search API                                            │
│  • Web Pages (for scraping)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### **STEP 1: User Input Capture** (0-50ms)

#### Location: `frontend/src/pages/ChatPage.tsx`

```typescript
// User types "how is war in iran" and clicks send
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: "how is war in iran",
  };

  // Immediately update UI - user sees their message
  setMessages((prev) => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);
```

**What Happens:**
- User message instantly appears in chat
- Input field clears
- Loading state activates
- Send button disables

**UI State:**
```
┌─────────────────────────────────────────┐
│ [User Avatar]  "how is war in iran"     │
│                                         │
│ [AI Avatar]    ⚫⚫⚫ (loading dots)     │
└─────────────────────────────────────────┘
```

---

### **STEP 2: History Preparation** (50-100ms)

```typescript
// Prepare conversation context based on mode
let historyToSend: { role: string, content: string }[] = [];

if (chatMode === 'fast') {
  historyToSend = []; // No context for speed
} 
else if (chatMode === 'normal') {
  historyToSend = messages.slice(-2).map(m => 
    ({ role: m.role, content: m.content })
  ); // Last 2 messages
} 
else if (chatMode === 'deep') {
  historyToSend = messages.slice(-10).map(m => 
    ({ role: m.role, content: m.content })
  ); // Last 10 messages for deep context
}
```

**Example History (Normal Mode):**
```json
[
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi! How can I help you today?"}
]
```

---

### **STEP 3: HTTP Request to Backend** (100-200ms)

```typescript
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "how is war in iran",
    history: historyToSend,
    google_credentials: googleCredentials,
    mode: chatMode  // 'fast' | 'normal' | 'deep'
  }),
});
```

**Request Payload:**
```json
{
  "query": "how is war in iran",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help you today?"}
  ],
  "google_credentials": null,
  "mode": "normal"
}
```

**Network Traffic:**
```
Client (localhost:5173) → Server (localhost:8000)
Method: POST
Endpoint: /api/chat
Content-Type: application/json
Accept: text/event-stream  ← Important for SSE
```

---

### **STEP 4: Backend Router Processing** (200-300ms)

#### Location: `backend/routers/chat.py`

```python
@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Pydantic validation
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Return Server-Sent Events stream
    return StreamingResponse(
        get_agent_response_stream(
            request.query,        # "how is war in iran"
            request.history,      # [previous messages]
            request.google_credentials,  # None
            request.mode          # "normal"
        ),
        media_type="text/event-stream"
    )
```

**Validation:**
- ✅ Query is not empty
- ✅ Request matches ChatRequest schema
- ✅ Valid mode ('fast' | 'normal' | 'deep')

**Response Type:**
- `StreamingResponse` with `text/event-stream` 
- Keeps connection open for real-time streaming
- No timeout on long responses

---

### **STEP 5: Agent Initialization** (300-500ms)

#### Location: `backend/agent/langchain_agent.py`

#### 5.1: LLM Setup
```python
async def get_agent_response_stream(
    query: str,              # "how is war in iran"
    history: list = None,    # Previous messages
    google_credentials: dict = None,
    mode: str = "normal"
):
    # Get API key from environment
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    # Initialize Groq LLM
    llm = ChatGroq(
        groq_api_key=groq_api_key,
        model_name="openai/gpt-oss-120b",  # Groq-hosted model
        streaming=True,  # Enable token streaming
        temperature=1.0  # Creative responses
    )
```

#### 5.2: Tool Loading
```python
# Load all available tools
tools = [
    weather_tool,      # Get weather for locations
    news_tool,         # ← WILL BE USED for "war in iran"
    search_tool,       # ← WILL BE USED for context
    time_tool,         # Current time/date
    scrape_webpage,    # ← MIGHT BE USED for detailed articles
    finance_tool,      # Stock/crypto prices
    arxiv_tool         # Academic papers
]

# Add Gmail tools if authenticated
if google_credentials:
    tools.append(create_read_emails_tool(google_credentials))
    tools.append(create_send_email_tool(google_credentials))
```

**Total Tools Available**: 7 (or 9 with Gmail)

#### 5.3: Mode Configuration
```python
if mode == "fast":
    SYSTEM_PROMPT = "You are EchoMind, a lightning-fast assistant. Answer as concisely as possible. Only use tools if strictly necessary."
    max_iters = 5
    
elif mode == "deep":
    SYSTEM_PROMPT = "You are DeepSearch AI, an elite research assistant. Execute comprehensive multi-step reasoning using multiple tools. Synthesize data into a comprehensive report."
    max_iters = 30
    
else:  # normal mode
    SYSTEM_PROMPT = "You are EchoMind, an elite AI assistant with access to real-time tools. For complex queries you MUST use MULTIPLE tools to gather deep context. Synthesize data into a comprehensive Markdown response."
    max_iters = 15
```

**For "how is war in iran" with Normal Mode:**
- System Prompt: Balanced approach
- Max Iterations: 15 tool calls allowed
- Expected Behavior: Use 2-4 tools

#### 5.4: Prompt Template Creation
```python
prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])
```

**Rendered Prompt:**
```
System: You are EchoMind, an elite AI assistant...

Chat History:
User: Hello
Assistant: Hi! How can I help you today?