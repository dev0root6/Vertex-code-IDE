import React, { useState, useRef } from "react";

const parseMarkdown = (text) => {
  if (!text) return text;
  
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\n/g, '<br />');
  
  return html;
};

const ChatBot = ({ 
  aiBackend, 
  onGenerateCode, 
  position, 
  size, 
  isMinimized, 
  onPositionChange, 
  onSizeChange,
  onToggleMinimize 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const chatRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your code generator. Ask me to generate minimalist code. E.g., 'add two numbers' or 'print hello world'",
      sender: "bot"
    }
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.chat-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    } else if (isResizing) {
      onSizeChange({
        width: Math.max(300, e.clientX - position.x),
        height: Math.max(400, e.clientY - position.y)
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeStart = (e) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, position, size]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: input,
      sender: "user"
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    try {
      const { generateCodeFromPrompt } = await import("./code-generator.js");
      const result = await generateCodeFromPrompt(input, aiBackend);
      
      console.log("Generation result:", result);

      setIsGenerating(false);

      if (!result?.code && result?.explanation) {
        setMessages((prev) => [
          ...prev,
          { id: messages.length + 2, text: result.explanation, sender: "bot" }
        ]);
        return;
      }

      if (result?.code && result.code.length > 3) {
        onGenerateCode(result);
        
        const botMessage = {
          id: messages.length + 2,
          text: result.explanation || "Code generated successfully",
          sender: "bot",
          code: result.code,
          language: result.language
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        const errorMessage = {
          id: messages.length + 2,
          text: result?.explanation || "No code was generated. Try a simpler coding request.",
          sender: "bot"
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Generation error:", error);
      setIsGenerating(false);
      const errorMessage = {
        id: messages.length + 2,
        text: "Error generating code. Try a simpler prompt.",
        sender: "bot"
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div 
      ref={chatRef}
      className={`chatbot-floating ${isMinimized ? 'minimized' : ''}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? 'auto' : `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
        zIndex: 1000
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="chat-header" style={{ cursor: 'move' }}>
        <h3>Code Generator</h3>
        <div className="chat-controls">
          <span className="ai-badge">
            {aiBackend === "ollama" ? "🔗 Ollama" : "⚙️ Local"}
          </span>
          <button className="minimize-btn" onClick={onToggleMinimize}>
            {isMinimized ? '□' : '_'}
          </button>
        </div>
      </div>
      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender}`}>
                <div className="message-content">
                  <div 
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }}
                  />
                  {msg.code && (
                    <pre className="code-block">
                      {msg.code}
                    </pre>
                  )}
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="chat-message bot">
                <div className="message-content">Generating...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-box">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask for code..."
              disabled={isGenerating}
            />
            <button onClick={handleSendMessage} disabled={isGenerating || !input.trim()}>
              Send
            </button>
          </div>
          <div 
            className="resize-handle"
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '16px',
              height: '16px',
              cursor: 'nwse-resize'
            }}
          />
        </>
      )}
    </div>
  );
};

export default ChatBot;
