import { useRef, useState } from "react";
import "./App.css";

export default function App() {
  const [job, setJob] = useState("");
  const [company, setCompany] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(null);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const recognitionRef = useRef(null);

  const generateQuestions = async () => {
    if (!job) return;
    setLoading(true);
    setQuestions([]);
    setCurrentQ(null);
    setFeedback(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, company, count: 5 }),
      });
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (e) {
      alert("서버 오류! 백엔드 실행 중인지 확인해주세요.");
    }
    setLoading(false);
  };

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(v => v.lang === "ko-KR");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = koreanVoice ? "ko-KR" : "en-US";
    if (koreanVoice) utterance.voice = koreanVoice;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const selectQuestion = (q, idx) => {
    setCurrentQ({ text: q, idx });
    setAnswer("");
    setFeedback(null);
    speak(q);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("크롬 브라우저를 사용해주세요!");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join("");
      setAnswer(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  };

  const getFeedback = async () => {
    if (!answer || !currentQ) return;
    setFeedbackLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/get-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentQ.text, answer, job }),
      });
      const data = await res.json();
      setFeedback(data.feedback);
    } catch (e) {
      alert("피드백 오류! 다시 시도해주세요.");
    }
    setFeedbackLoading(false);
  };

  const parseFeedback = (text) => {
    const sections = { strength: "", weakness: "", improved: "" };
    const s = text.match(/\[강점\]([\s\S]*?)(?=\[약점\]|$)/);
    const w = text.match(/\[약점\]([\s\S]*?)(?=\[개선 답변\]|$)/);
    const i = text.match(/\[개선 답변\]([\s\S]*?)$/);
    if (s) sections.strength = s[1].trim();
    if (w) sections.weakness = w[1].trim();
    if (i) sections.improved = i[1].trim();
    return sections;
  };

  return (
    <div>
      <div className="header">
        <div className="header-inner">
          <h1>🎤 AI 면접 코치</h1>
          <p>AI가 면접관이 되어 질문하고 피드백을 드려요</p>
        </div>
      </div>

      <div className="container">
        {!currentQ && (
          <div className="card">
            <h3>직무 설정</h3>
            <input className="input" placeholder="직무 (예: 백엔드 개발자)"
              value={job} onChange={(e) => setJob(e.target.value)} />
            <input className="input" placeholder="회사 유형 (예: 스타트업, 대기업)"
              value={company} onChange={(e) => setCompany(e.target.value)} />
            <button className="btn btn-primary" onClick={generateQuestions}
              disabled={loading || !job}>
              {loading ? "질문 생성 중..." : "면접 질문 생성"}
            </button>
          </div>
        )}

        {questions.length > 0 && !currentQ && (
          <div className="card">
            <h3>면접 질문 목록</h3>
            <p className="card-subtitle">질문을 클릭하면 AI 면접관이 읽어드려요</p>
            {questions.map((q, i) => (
              <div key={i} className="question-item" onClick={() => selectQuestion(q, i)}>
                <span className="question-num">Q{i + 1}</span>{q}
              </div>
            ))}
          </div>
        )}

        {currentQ && (
          <div>
            <div className="progress-bar">
              <button className="btn btn-ghost"
                onClick={() => { setCurrentQ(null); setFeedback(null); }}>
                ← 목록으로
              </button>
              <span className="progress-divider">|</span>
              <span>Q{currentQ.idx + 1} / {questions.length}</span>
            </div>

            <div className="question-card">
              <div className="label">면접관 질문</div>
              <p>{currentQ.text}</p>
              <button className="btn-replay" onClick={() => speak(currentQ.text)}>
                🔊 다시 듣기
              </button>
            </div>

            <div className="card">
              <h3>내 답변</h3>
              <div className="answer-controls">
                <button className={`btn ${listening ? "btn-red" : "btn-green"}`}
                  onClick={listening ? stopListening : startListening}>
                  {listening ? "⏹ 중지" : "🎙 음성 답변"}
                </button>
                {listening && <span className="recording-indicator">● 녹음 중...</span>}
              </div>
              <textarea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)}
                placeholder="음성으로 답변하거나 직접 입력하세요" />
              <button className="btn btn-primary" style={{ marginTop: 12 }}
                onClick={getFeedback} disabled={!answer || feedbackLoading}>
                {feedbackLoading ? "AI 분석 중..." : "피드백 받기"}
              </button>
            </div>

            {feedback && (() => {
              const f = parseFeedback(feedback);
              return (
                <div>
                  <h3 className="feedback-title">📊 AI 피드백</h3>
                  <div className="feedback-card feedback-strength">
                    <strong>✅ 강점</strong>
                    <p>{f.strength}</p>
                  </div>
                  <div className="feedback-card feedback-weakness">
                    <strong>⚠️ 약점</strong>
                    <p>{f.weakness}</p>
                  </div>
                  <div className="feedback-card feedback-improved">
                    <strong>💡 개선 답변</strong>
                    <p>{f.improved}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}