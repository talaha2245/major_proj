# How Queries are Sent to AI Model & LLM Response Generation

This document provides a detailed technical walkthrough of how user queries are processed and how LLM responses are generated and streamed back to the user.

---

## Table of Contents
1. [Frontend Query Submission](#1-frontend-query-submission)
2. [Backend Request Processing](#2-backend-request-processing)
3. [LangChain Agent Initialization](#3-langchain-agent-initialization)
4. [LLM Query Processing](#4-llm-query-processing)
5. [Tool Execution Flow](#5-tool-execution-flow)
6. [Response Streaming](#6-response-streaming)
7. [Frontend Response Handling](#7-frontend-response-handling)

---

## 1. Frontend Query Submission

### Step 1.1: User Input Capture
**File**: `frontend/src/pages/ChatPage.tsx`

```typescript
// User submits a message
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() || isLoading) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: input.trim(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);
```

**What Happens:**
- User types a message and clicks send
- Message is added to local state immediately
- UI shows the message instantly
- Loading state is activated

### Step 1.2: History Preparation
```typescript
// Prepare conversation history based on mode
let historyToSend: { role: string, content: string }[] = [];

if (chatMode === 'fast') {
  historyToSend = []; // No context
} else if (chatMode === 'normal') {
  historyToSend = messages.slice(-2).map(m => 
    ({ role: m.role, content: m.content })
  ); // Last 2 messages
} else if (chatMode === 'deep') {
  historyToSend = messages.slice(-10).map(m => 
    ({ role: m.role, content: m.content })
  ); // Last 10 messages
}
```

**What Happens:**
- System determines how much context to send based on selected mode
- Fast mode: No history (fastest, no context)
- Normal mode: Last 2 messages (balanced)
- Deep mode: Last 10 messages (most context-aware)

### Step 1.3: HTTP Request
```typescript
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: userMessage.content,
    history: historyToSend,
    google_credentials: googleCredentials,
    mode: chatMode
  }),
});
```

**Request Payload Example:**
```json
{
  "query": "What's the weather in London?",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help?"}
  ],
  "google_credentials": null,
  "mode": "normal"
}
```

---

## 2. Backend Request Processing

### Step 2.1: FastAPI Router Reception
**File**: `backend/routers/chat.py`

```python
@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Return a StreamingResponse that consumes the async generator
    return StreamingResponse(
        get_agent_response_stream(
            request.query, 
            request.history, 
            request.google_credentials, 
            request.mode
        ),
        media_type="text/event-stream"
    )
```

**What Happens:**
- FastAPI receives POST request at `/api/chat`
- Validates the query is not empty using Pydantic model
- Creates a `StreamingResponse` with Server-Sent Events (SSE)
- Calls the agent function to start processing

**Pydantic Model:**
```python
class ChatRequest(BaseModel):
    query: str
    history: List[Dict[str, str]] = []
    google_credentials: Optional[Dict[str, Any]] = None
    mode: str = "normal"
```

---

## 3. LangChain Agent Initialization

### Step 3.1: LLM Initialization
**File**: `backend/agent/langchain_agent.py`

```python
async def get_agent_response_stream(query: str, history: list = None, 
                                   google_credentials: dict = None, 
                                   mode: str = "normal"):
    # Get Groq API key from environment
    groq_api_key = os.getenv("GROQ_API_KEY")
    
    # Initialize the Groq LLM with streaming enabled
    llm = ChatGroq(
        groq_api_key=groq_api_key, 
        model_name="openai/gpt-oss-120b",
        streaming=True,
        temperature=1.0
    )
```

**What Happens:**
- Retrieves Groq API key from environment variables
- Creates ChatGroq instance with streaming enabled
- Model: `openai/gpt-oss-120b` (Groq-hosted model)
- Temperature: 1.0 (creative responses)

### Step 3.2: Tool Loading
```python
# Load all available tools
tools = [
    weather_tool, 
    news_tool, 
    search_tool, 
    time_tool, 
    scrape_webpage, 
    finance_tool, 
    arxiv_tool
]

# Add Gmail tools if credentials provided
if google_credentials:
    tools.append(create_read_emails_tool(google_credentials))
    tools.append(create_send_email_tool(google_credentials))
```

**What Happens:**
- Loads 7 base tools
- Conditionally adds Gmail tools if OAuth credentials exist
- Each tool is a LangChain `@tool` decorated function

**Example Tool:**
```python
@tool
def search_tool(query: str) -> str:
    """
    A search engine for general queries. 
    Use this when you need general information.
    """
    try:
        return ddg_search.run(query)
    except Exception as e:
        return f"Search failed: {str(e)}"
```

### Step 3.3: System Prompt Configuration
```python
if mode == "fast":
    SYSTEM_PROMPT = "You are EchoMind, a lightning-fast assistant..."
    max_iters = 5
elif mode == "deep":
    SYSTEM_PROMPT = "You are DeepSearch AI, an elite research assistant..."
    max_iters = 30
else:  # normal
    SYSTEM_PROMPT = "You are EchoMind, an elite AI assistant..."
    max_iters = 15
```

**What Happens:**
- System prompt changes based on mode
- Iteration limits prevent infinite loops
- Fast mode: Minimal reasoning (5 iterations)
- Deep mode: Extensive research (30 iterations)

### Step 3.4: Prompt Template Creation
```python
prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])
```

**What Happens:**
- Creates structured prompt with 4 sections:
  1. System instruction
  2. Chat history (previous conversation)
  3. Current user input
  4. Agent scratchpad (tool results)

### Step 3.5: Agent Chain Construction
```python
# Fix for Llama-3 dropping null arguments
def fix_null_args(ai_message: AIMessage) -> AIMessage:
    if hasattr(ai_message, "tool_calls"):
        for tc in ai_message.tool_calls:
            if tc.get("args") is None:
                tc["args"] = {}
    return ai_message

llm_with_tools = llm.bind_tools(tools)

agent = (
    RunnablePassthrough.assign(
        agent_scratchpad=lambda x: format_to_tool_messages(x["intermediate_steps"])
    )
    | prompt
    | llm_with_tools
    | fix_null_args
    | ToolsAgentOutputParser()
)
```

**What Happens:**
- Binds tools to LLM (tool calling capability)
- Creates processing pipeline:
  1. Format tool results from previous steps
  2. Insert into prompt template
  3. Send to LLM with tool definitions
  4. Fix null arguments (Llama-3 specific bug)
  5. Parse tool calls from response

### Step 3.6: Agent Executor Setup
```python
agent_executor = AgentExecutor(
    agent=agent, 
    tools=tools, 
    verbose=True,
    return_intermediate_steps=True,
    max_iterations=max_iters,
    handle_parsing_errors=True
)
```

**What Happens:**
- Wraps agent in executor for orchestration
- `return_intermediate_steps=True`: Captures tool usage
- `handle_parsing_errors=True`: Graceful error handling
- Ready to process queries

---

## 4. LLM Query Processing

### Step 4.1: History Formatting
```python
formatted_history = []
if history:
    for msg in history:
        if msg.get("role") == "user":
            formatted_history.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            formatted_history.append(AIMessage(content=msg.get("content", "")))
```

**What Happens:**
- Converts JSON history to LangChain message objects
- `HumanMessage`: User messages
- `AIMessage`: Assistant messages

### Step 4.2: Agent Execution Stream
```python
async for event in agent_executor.astream_events(
    {"input": query, "chat_history": formatted_history},
    version="v2"
):
    kind = event.get("event")
    # Process different event types...
```

**What Happens:**
- Starts async streaming execution
- Yields events as they occur
- Version "v2" for latest event format

**Event Flow Diagram:**
```
Input → LLM decides action → Tool call (if needed) → LLM receives result 
→ LLM generates response → Tokens stream → Repeat until done
```

---

## 5. Tool Execution Flow

### Step 5.1: Tool Decision
When the LLM receives a query like "What's the weather in London?", it:

1. **Analyzes the query**: Identifies need for weather data
2. **Selects tool**: Chooses `weather_tool` from available tools
3. **Generates tool call**:
```python
{
  "name": "weather_tool",
  "args": {"location": "London"}
}
```

### Step 5.2: Tool Execution
```python
elif kind == "on_tool_start":
    tool_name = event.get("name")
    if tool_name and tool_name not in ["_Exception"]:
        yield f"data: {json.dumps({'type': 'tool', 'name': tool_name})}\n\n"
```

**What Happens:**
- Agent executor calls the actual tool function
- Tool executes (API call, web scrape, etc.)
- Returns result as string
- Frontend receives tool usage notification

**Example Tool Execution:**
```python
# weather_tool might call an API
result = requests.get(f"https://api.weather.com?location=London")
return f"Temperature: 15°C, Cloudy"
```

### Step 5.3: Result Integration
- Tool result is added to agent scratchpad
- LLM receives tool output in next iteration
- LLM synthesizes final response using tool data

---

## 6. Response Streaming

### Step 6.1: Token Streaming
```python
if kind == "on_chat_model_stream":
    chunk_msg = event.get("data", {}).get("chunk")
    if chunk_msg and chunk_msg.content and isinstance(chunk_msg.content, str):
        yield f"data: {json.dumps({'type': 'token', 'content': chunk_msg.content})}\n\n"
```

**What Happens:**
- LLM generates response token by token
- Each token is immediately yielded as SSE event
- No waiting for full response

**SSE Event Format:**
```
data: {"type": "token", "content": "The"}
data: {"type": "token", "content": " weather"}
data: {"type": "token", "content": " in"}
data: {"type": "token", "content": " London"}
```

### Step 6.2: Error Handling
```python
elif kind == "on_tool_error" or parsed.type == 'error':
    yield f"data: {json.dumps({'type': 'error', 'content': error_message})}\n\n"
```

**What Happens:**
- Errors are caught and streamed to frontend
- User sees error message in chat
- Graceful degradation

---

## 7. Frontend Response Handling

### Step 7.1: SSE Reader Setup
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder('utf-8');
let done = false;
let buffer = '';

// Seed empty assistant message
setMessages((prev) => [
  ...prev,
  { id: assistantId, role: 'assistant', content: '', tools_used: [] }
]);
```

**What Happens:**
- Creates stream reader for response body
- Initializes empty assistant message
- Prepares to accumulate tokens

### Step 7.2: Stream Processing Loop
```typescript
while (!done) {
  const { value, done: readerDone } = await reader.read();
  done = readerDone;
  
  if (value) {
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        const parsed = JSON.parse(dataStr);

        if (parsed.type === 'token') {
          // Append token to message
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + parsed.content }
              : msg
          ));
        } else if (parsed.type === 'tool') {
          // Add tool badge
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, tools_used: [...(msg.tools_used || []), parsed.name] }
              : msg
          ));
        }
      }
    }
  }
}
```

**What Happens:**
1. Reads chunks from stream
2. Decodes bytes to text
3. Splits by newlines to get individual events
4. Parses JSON from each event
5. Updates React state based on event type
6. UI re-renders with each update

### Step 7.3: Real-Time UI Update
```typescript
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {message.content}
</ReactMarkdown>
```

**What Happens:**
- Each token update triggers React re-render
- Markdown is parsed and displayed
- User sees response appear word by word
- Tool badges appear when tools are used

**Visual Flow:**
```
Token arrives → State updates → React re-renders → User sees new text
```

---

## Complete Flow Example

Let's trace a complete query: **"What's the weather in London and latest tech news?"**

### 1. Frontend Submission
```typescript
POST /api/chat
{
  "query": "What's the weather in London and latest tech news?",
  "history": [],
  "mode": "normal"
}
```

### 2. Agent Initialization
- Groq LLM created
- 9 tools loaded
- System prompt: "You are EchoMind..."
- Max iterations: 15

### 3. First LLM Call
**LLM analyzes query:**
- Identifies 2 tasks: weather + news
- Decides to call tools

**Tool Calls Generated:**
```json
[
  {"name": "weather_tool", "args": {"location": "London"}},
  {"name": "news_tool", "args": {"query": "tech news"}}
]
```

**SSE Events Sent:**
```
data: {"type": "tool", "name": "weather_tool"}
data: {"type": "tool", "name": "news_tool"}
```

### 4. Tool Execution
- `weather_tool` → API call → "15°C, Cloudy"
- `news_tool` → API call → "Latest: AI breakthroughs..."

### 5. Second LLM Call
**LLM receives tool results:**
```
Agent Scratchpad:
- weather_tool returned: "15°C, Cloudy"
- news_tool returned: "Latest: AI breakthroughs..."
```

**LLM generates response:**
```
data: {"type": "token", "content": "Based"}
data: {"type": "token", "content": " on"}
data: {"type": "token", "content": " the"}
data: {"type": "token", "content": " latest"}
data: {"type": "token", "content": " data"}
data: {"type": "token", "content": ":\n\n"}
data: {"type": "token", "content": "**Weather"}
data: {"type": "token", "content": " in"}
data: {"type": "token", "content": " London**"}
...
```

### 6. Frontend Display
- Tool badges appear: "Used Global Weather" "Used Live News"
- Response streams in character by character
- Markdown renders in real-time

### 7. Complete Response
```markdown
Based on the latest data:

**Weather in London**
Currently 15°C and cloudy

**Latest Tech News**
- AI breakthroughs in language models
- New semiconductor technology
- Tech stock market updates
```

---

## Performance Optimizations

1. **Streaming**: No waiting for complete response
2. **SSE vs WebSocket**: Simpler protocol, HTTP-based
3. **Token-by-token**: Perceived performance boost
4. **Tool Parallelization**: LangChain can call multiple tools simultaneously
5. **Async Operations**: Non-blocking I/O throughout stack

---

## Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| **Invalid API Key** | Immediate error SSE event |
| **Tool Failure** | Try-catch in tool, return error string |
| **Network Error** | Frontend catches, displays error message |
| **Parse Error** | `handle_parsing_errors=True` in executor |
| **Timeout** | FastAPI timeout + frontend timeout |

---

## Key Takeaways

1. **Query → LLM**: User query + history + tools → Groq API
2. **LLM → Tools**: Model decides which tools to use
3. **Tools → LLM**: Results fed back to model
4. **LLM → User**: Response streamed token-by-token via SSE
5. **Real-time**: Every event updates UI immediately
6. **Modular**: Easy to add new tools or change LLM provider
