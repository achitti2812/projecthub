import { useState, useRef, useEffect } from "react";
import client from "../api/client";
import { AIResponse } from "../types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        'Hi! I\'m your AI task assistant. I can help you manage tasks using natural language. Try:\n\n- "Create a high priority task to fix login bug"\n- "Move payment task to In Progress"\n- "Delete the task related to UI bug"',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await client.post<AIResponse>("/ai/command", {
        message: userMsg,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.message },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-page">
      <h1>AI Task Assistant</h1>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="message-bubble">
                {msg.content.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    <br />
                  </span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant">
              <div className="message-bubble typing">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a command (e.g., Create a task to fix navbar)"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            className="btn btn-primary"
            disabled={loading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
