from fastapi import FastAPI

app = FastAPI(
    title="XRP Farmer Intelligence Layer",
    description="API for calculating agricultural insurance parameters and oracle logic",
    version="0.1.0"
)

@app.get("/")
async def root():
    return {"message": "XRP Farmer Intelligence Layer is running"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
