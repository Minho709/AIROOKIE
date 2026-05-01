from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JobRequest(BaseModel):
    job: str
    company: str
    count: int = 5

class FeedbackRequest(BaseModel):
    question: str
    answer: str
    job: str

async def call_gemini(prompt: str):
    for attempt in range(3):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.5-flash",
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"오류 발생 (시도 {attempt+1}/3): {str(e)}")
            if "429" in str(e) and attempt < 2:
                await asyncio.sleep(15)
                continue
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-questions")
async def generate_questions(req: JobRequest):
    prompt = f"""
당신은 {req.company} 회사의 {req.job} 포지션 면접관입니다.
실제 면접에서 나올 법한 질문 {req.count}개를 생성해주세요.

조건:
- 직무 관련 기술 질문 3개
- 인성/경험 질문 2개
- 각 질문은 번호 없이 한 줄씩, 질문만 출력

출력 형식:
질문1
질문2
"""
    text = await call_gemini(prompt)
    questions = [q.strip() for q in text.strip().split("\n") if q.strip()]
    return {"questions": questions}

@app.post("/get-feedback")
async def get_feedback(req: FeedbackRequest):
    prompt = f"""
당신은 {req.job} 포지션 면접관입니다.
아래 면접 질문과 답변을 분석해서 피드백을 주세요.

질문: {req.question}
답변: {req.answer}

아래 형식으로 정확히 출력해주세요:
[강점]
강점 내용

[약점]
약점 내용

[개선 답변]
더 나은 답변 예시
"""
    text = await call_gemini(prompt)
    return {"feedback": text}
