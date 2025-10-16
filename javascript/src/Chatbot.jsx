import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import ChartComponent from './ChartComponent';
import './Chatbot.css';

export default function Chatbot() {
  //const chatbot = new cb();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "👋 Hi there! I'm your AI assistant. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessageToBackend = async (userMessage) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (
          userMessage.toLowerCase().includes('chart') ||
          userMessage.toLowerCase().includes('graph') ||
          userMessage.toLowerCase().includes('visualization')
        ) {
          resolve({
            type: 'image',
            content: 'https://via.placeholder.com/700x400/6366F1/FFFFFF?text=Data+Visualization',
            text: "Here's the data visualization you requested 📊:"
          });
        } else {
          resolve({
            type: 'text',
            content: `You said: "${userMessage}". This is a mock response. Connect your backend API to get real responses!`
          });
        }
      }, 1000);
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setChartData(null);
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: currentInput }),
      });
      const data = await apiResponse.json();
      console.log('Frontend received this data:', data);
      const botMessage = {
                id: Date.now() + 1,
                type: 'bot',
                content: data.title || "Here's what I found:",
                timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setChartData(data);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'bot',
          content: '⚠️ Sorry, I encountered an error. Please try again later.',
          contentType: 'text',
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
            <h1>AI Assistant</h1>
            <p>Your personal data companion</p>
          </div>
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
                {msg.contentType === 'image' ? (
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

          {chartData && (
                        <div className="message-row bot-row">
                             <div className="avatar bot-avatar"><Bot size={20} /></div>
                             <div className="message-bubble bot-bubble chart-bubble">
                                <ChartComponent chartInfo={chartData} />
                             </div>
                        </div>
          )}

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
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
          <Send size={20} /> Send
        </button>
      </div>
    </div>
  );
}
