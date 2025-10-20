import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Globe } from 'lucide-react';
import ChartComponent from './ChartComponent';
import './Chatbot.css';

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "👋 Hi there! I'm your AI assistant. How can I help you today? (You can ask in any language!)",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState('EN');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getLanguageName = (code) => {
    const languages = {
      'EN': 'English',
      'HI': 'हिन्दी (Hindi)',
      'ES': 'Español (Spanish)',
      'FR': 'Français (French)',
      'DE': 'Deutsch (German)',
      'IT': 'Italiano (Italian)',
      'PT': 'Português (Portuguese)',
      'RU': 'Русский (Russian)',
      'JA': '日本語 (Japanese)',
      'ZH': '中文 (Chinese)',
      'AR': 'العربية (Arabic)',
      'KO': '한국어 (Korean)',
    };
    return languages[code] || code;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const apiResponse = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentInput }),
      });
      const data = await apiResponse.json();

      console.log('Frontend received:', data);

      // Update detected language if provided
      if (data.userLanguage) {
        setDetectedLanguage(data.userLanguage);
      }

      // If backend returns a chart object
      if (data && !data.error) {
        const chartMessage = {
          id: Date.now() + 1,
          type: 'bot',
          contentType: 'chart',
          content: data, // send the entire data object to ChartComponent
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, chartMessage]);
      } else if (data.error) {
        // Handle error message
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 2,
            type: 'bot',
            content: `⚠️ ${data.error}`,
            timestamp: new Date()
          }
        ]);
      }

    } catch (err) {
      console.error('Error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 2,
          type: 'bot',
          content: '⚠️ Sorry, I encountered an error. Please try again later.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <div className="header-inner">
          <div className="bot-icon">
            <Bot size={30} />
          </div>
          <div>
            <h1>INGRES Chatbot</h1>
            {/* <p>Your personal data companion</p> */}
          </div>
          {detectedLanguage !== 'EN' && (
            <div className="language-indicator">
              <Globe size={18} />
              <span>{getLanguageName(detectedLanguage)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="chatbot-messages">
        <div className="messages-inner">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-row ${msg.type === 'user' ? 'user-row' : 'bot-row'}`}
            >
              {msg.type === 'bot' && <div className="avatar bot-avatar"><Bot size={20} /></div>}

              <div className={`message-bubble ${msg.type === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                {msg.contentType === 'chart' ? (
                  <ChartComponent chartInfo={msg.content} />
                ) : msg.contentType === 'image' ? (
                  <div className="image-message">
                    {msg.text && <p className="image-text">{msg.text}</p>}
                    <img src={msg.content} alt="Visualization" />
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
                <p className="timestamp">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              {msg.type === 'user' && <div className="avatar user-avatar"><User size={20} /></div>}
            </div>
          ))}

          {isLoading && (
            <div className="message-row bot-row">
              <div className="avatar bot-avatar"><Bot size={20} /></div>
              <div className="typing-indicator">
                <div className="dot dot1"></div>
                <div className="dot dot2"></div>
                <div className="dot dot3"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chatbot-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message in any language..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
          <Send size={20} /> Send
        </button>
      </div>
    </div>
  );
}