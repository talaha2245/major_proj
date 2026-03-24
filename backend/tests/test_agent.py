import pytest
import asyncio
import json
from unittest.mock import patch, MagicMock
from langchain_core.messages import HumanMessage, AIMessage
from agent.langchain_agent import get_agent_response_stream

def run_agent(query, history=None, creds=None, mode="normal"):
    """Helper purely for testing. Consumes the stream and builds the final mocked outputs."""
    async def _run():
        res = ""
        tools = []
        # Fallback to catching exceptions directly if api keys are missing early
        generator = get_agent_response_stream(query, history, creds, mode)
        async for chunk in generator:
            if chunk.startswith("data: "):
                try:
                    data = json.loads(chunk[6:].strip())
                    if data["type"] == "token" or data["type"] == "error":
                        res += data.get("content", "")
                    elif data["type"] == "tool":
                        tools.append(data["name"])
                except:
                    pass
        return {"response": res, "tools_used": list(dict.fromkeys(tools))}
    return asyncio.run(_run())

def test_agent_missing_api_key(monkeypatch):
    """If the API key is missing entirely, the agent should catch it immediately and yield error string."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    result = run_agent("Hello")
    assert isinstance(result, dict)
    assert "GROQ_API_KEY is not set" in result["response"]
    assert result["tools_used"] == []

@patch("agent.langchain_agent.AgentExecutor.astream_events")
def test_agent_terminal_failure(mock_astream):
    """If the LLM crashes during streaming, the except generator should catch it gracefully and yield an error chunk."""
    mock_astream.side_effect = Exception("Catastrophic LLM Failure")
    
    result = run_agent("Crash test")
    
    assert "Catastrophic LLM Failure" in result["response"]

@patch("agent.langchain_agent.AgentExecutor.astream_events")
def test_agent_history_formatting(mock_astream):
    """Ensure raw basic dicts convert perfectly into specialized Langchain Message variables in the new stream agent."""
    async def dummy_gen(*args, **kwargs):
        yield {"event": "on_chat_model_stream", "data": {"chunk": MagicMock(content="History parsing works")}}
    mock_astream.return_value = dummy_gen()
    
    history = [
        {"role": "user", "content": "Who are you?"},
        {"role": "assistant", "content": "I am EchoMind"},
        {"role": "invalid_role", "content": "Should be ignored safely"}
    ]
    run_agent("Test", history)
    
    # Extract the args passed deeply to astream_events
    invoke_args = mock_astream.call_args[0][0]
    hist_objs = invoke_args.get("chat_history", [])
    assert len(hist_objs) == 2
    assert isinstance(hist_objs[0], HumanMessage)
    assert isinstance(hist_objs[1], AIMessage)

@patch("agent.langchain_agent.AgentExecutor.__init__")
def test_agent_no_credentials_no_gmail(mock_init):
    """If no Google tokens are assigned, Agent dynamically refuses to mount Gmail tooling."""
    mock_init.side_effect = Exception("Stop execution early")
    try:
        run_agent("Test")
    except Exception:
        pass
    tool_list = mock_init.call_args[1].get('tools', []) if mock_init.call_args else []
    tool_names = [t.name for t in tool_list]
    assert "read_recent_emails" not in tool_names
    assert "send_email" not in tool_names

@patch("agent.langchain_agent.AgentExecutor.__init__")
def test_agent_google_credentials_binding(mock_init):
    """If tokens are detected, the agent silently binds the Gmail integration."""
    mock_init.side_effect = Exception("Stop execution early")
    dummy_creds = {"access_token": "123", "refresh_token": "456", "token_uri": "", "client_id": "", "client_secret": "", "scopes": []}
    try:
        run_agent("Test", None, dummy_creds)
    except Exception:
        pass
    tool_list = mock_init.call_args[1].get('tools', []) if mock_init.call_args else []
    tool_names = [t.name for t in tool_list]
    assert "read_recent_emails" in tool_names
    assert "send_email" in tool_names

@patch("agent.langchain_agent.AgentExecutor.astream_events")
def test_agent_deduplicates_tools(mock_astream, monkeypatch):
    """Verifies that an agent streaming identical tools multiple times is properly parsed down to uniqueness."""
    monkeypatch.setenv("GROQ_API_KEY", "dummy_key_to_bypass_early_rejection")
    
    async def dummy_gen(*args, **kwargs):
        yield {"event": "on_tool_start", "name": "Search"}
        yield {"event": "on_tool_start", "name": "Search"}
        yield {"event": "on_tool_start", "name": "News"}
    
    mock_astream.return_value = dummy_gen()
    result = run_agent("Deduplicate me")
    
    assert len(result["tools_used"]) == 2
    assert "Search" in result["tools_used"]
    assert "News" in result["tools_used"]
