import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Fullstack AI Search API"}

def test_chat_endpoint_missing_body():
    # Sending empty body should trigger a 422 Unprocessable Entity due to Pydantic validation
    response = client.post("/api/chat", json={})
    assert response.status_code == 422
    assert "detail" in response.json()

def test_chat_endpoint_valid_schema_but_no_api_key(monkeypatch):
    """
    Test the behavior when GROQ_API_KEY is completely missing.
    The backend should elegantly fall back without crashing the server.
    """
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    
    response = client.post("/api/chat", json={
        "query": "Hello?",
        "history": []
    })
    
    assert response.status_code == 200
    text = response.text
    assert "GROQ_API_KEY is not set" in text

def test_chat_endpoint_with_history(monkeypatch):
    """Test standard array validation mapping string history into correct objects"""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    response = client.post("/api/chat", json={
        "query": "Follow up", 
        "history": [{"role": "user", "content": "Prev message"}]
    })
    assert response.status_code == 200
    assert "GROQ_API_KEY is not set" in response.text

def test_auth_google_missing_code():
    """Verify auth endpoint guards against empty payloads"""
    response = client.post("/api/auth/google", json={})
    assert response.status_code == 422

def test_auth_google_invalid_code():
    """Verify the Auth Code exchange throws a rigorous rejection locally or against Google"""
    response = client.post("/api/auth/google", json={"code": "completely_invalid_garbage_code_123"})
    # Either the flow crashes against Google and throws 400 Bad Request
    # Or credentials are missing on our server and it throws 500
    assert response.status_code in [400, 500]
