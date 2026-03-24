from dotenv import load_dotenv

load_dotenv() # Uvicorn HOT-RELOAD TRIGGER
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.chat import router as chat_router
from routers.auth import router as auth_router
from routers.healthCheck import router as health_router

app = FastAPI(title="Fullstack AI Search API")

# Setup CORS to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(health_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Welcome to the Fullstack AI Search API"}


if __name__ == "__main__":
    uvicorn.run("app:app", reload=True)