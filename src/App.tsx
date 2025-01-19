import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, ThumbsUp, ThumbsDown, Cloud } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  feedback?: 'like' | 'dislike';
}

interface WeatherData {
  main: {
    temp: number;
    humidity: number;
    feels_like: number;
  };
  weather: Array<{
    description: string;
    main: string;
  }>;
  name: string;
}

// Knowledge base for the chatbot
const knowledgeBase = {
  greetings: {
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
    responses: [
      "Hello! How can I help you today?",
      "Hi there! What can I assist you with?",
      "Hey! Feel free to ask me any questions."
    ]
  },
  about: {
    patterns: ['who are you', 'what are you', 'what can you do'],
    responses: [
      "I'm a friendly chatbot that can help you with:\n- Weather information\n- Math calculations\n- Telling jokes\n- Unit conversions\n- Time information\n- General chat\nFeel free to ask me anything!",
      "I'm your AI assistant! I can help with weather, math, tell jokes, convert units, and more. What would you like to know?"
    ]
  },
  weather: {
    patterns: ['weather', 'temperature', 'forecast'],
    responses: [
      "To check the weather, please provide a city name. For example: 'weather in London' or 'what's the temperature in Tokyo'",
      "I can check the weather for you! Just tell me which city you're interested in."
    ]
  },
  time: {
    patterns: ['time', 'what time', 'current time'],
    responses: [() => `The current time is ${new Date().toLocaleTimeString()}`]
  },
  jokes: {
    patterns: ['tell me a joke', 'joke', 'make me laugh', 'funny'],
    responses: [
      "Why don't programmers like nature? It has too many bugs!",
      "Why did the JavaScript developer wear glasses? Because he couldn't C#!",
      "What do you call a fake noodle? An impasta!",
      "Why did the scarecrow win an award? Because he was outstanding in his field!",
      "What do you call a bear with no teeth? A gummy bear!"
    ]
  },
  default: {
    responses: [
      "I'm not sure I understand. Could you rephrase your question?",
      "I'm still learning! Could you try asking in a different way?",
      "I don't have information about that yet. Is there something else I can help you with?"
    ]
  }
};

const unitConversions = {
  // Length
  'm to ft': (value: number) => ({ result: value * 3.28084, unit: 'ft' }),
  'ft to m': (value: number) => ({ result: value / 3.28084, unit: 'm' }),
  'km to mi': (value: number) => ({ result: value * 0.621371, unit: 'mi' }),
  'mi to km': (value: number) => ({ result: value * 1.60934, unit: 'km' }),
  // Weight
  'kg to lb': (value: number) => ({ result: value * 2.20462, unit: 'lb' }),
  'lb to kg': (value: number) => ({ result: value / 2.20462, unit: 'kg' }),
  // Temperature
  'c to f': (value: number) => ({ result: (value * 9/5) + 32, unit: '°F' }),
  'f to c': (value: number) => ({ result: (value - 32) * 5/9, unit: '°C' })
};

async function getWeather(city: string): Promise<string> {
  try {
    const API_KEY = 'f9af23a58bc2a9a29943bd95d5dc53af';
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`
    );
    
    if (!response.ok) {
      throw new Error('City not found');
    }
    
    const data: WeatherData = await response.json();
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const description = data.weather[0].description;
    const humidity = data.main.humidity;
    
    return `Current weather in ${data.name}:\n` +
           `🌡️ Temperature: ${temp}°C (feels like ${feelsLike}°C)\n` +
           `💧 Humidity: ${humidity}%\n` +
           `🌥️ Conditions: ${description.charAt(0).toUpperCase() + description.slice(1)}`;
  } catch (error) {
    return "I couldn't find the weather for that location. Please check the city name and try again.";
  }
}

function evaluateMathExpression(input: string): number | null {
  const cleanInput = input.toLowerCase().replace(/\s/g, '');
  const mathPattern = /(?:whatis|what's)?(\d+[\+\-\*\/]\d+)/;
  const match = cleanInput.match(mathPattern);
  
  if (!match) return null;
  
  try {
    const expression = match[1];
    const [num1, operator, num2] = expression.match(/(\d+)([\+\-\*\/])(\d+)/)?.slice(1) || [];
    
    if (!num1 || !operator || !num2) return null;
    
    switch (operator) {
      case '+': return parseInt(num1) + parseInt(num2);
      case '-': return parseInt(num1) - parseInt(num2);
      case '*': return parseInt(num1) * parseInt(num2);
      case '/': return parseInt(num2) === 0 ? null : parseInt(num1) / parseInt(num2);
      default: return null;
    }
  } catch {
    return null;
  }
}

function handleUnitConversion(input: string): string | null {
  const conversionPattern = /(\d+(?:\.\d+)?)\s*(m|ft|km|mi|kg|lb|c|f)\s+(?:to|in)\s+(m|ft|km|mi|kg|lb|c|f)/i;
  const match = input.match(conversionPattern);
  
  if (!match) return null;
  
  const [_, value, fromUnit, toUnit] = match;
  const conversionKey = `${fromUnit.toLowerCase()} to ${toUnit.toLowerCase()}`;
  const conversion = unitConversions[conversionKey as keyof typeof unitConversions];
  
  if (!conversion) return null;
  
  const { result, unit } = conversion(parseFloat(value));
  return `${value}${fromUnit.toUpperCase()} is equal to ${result.toFixed(2)}${unit}`;
}

async function findBestResponse(input: string): Promise<string> {
  const lowercaseInput = input.toLowerCase();
  
  // Check for weather queries
  const weatherPattern = /weather|temperature|forecast|how'?s?\s+the\s+weather\s+in\s+(\w+)|weather\s+in\s+(\w+)/i;
  const weatherMatch = input.match(weatherPattern);
  if (weatherMatch) {
    const city = weatherMatch[1] || weatherMatch[2];
    if (city) {
      return await getWeather(city);
    } else {
      return "Please specify a city name. For example: 'weather in London' or 'how's the weather in Tokyo'";
    }
  }
  
  // Check for unit conversions
  const conversionResult = handleUnitConversion(input);
  if (conversionResult) {
    return conversionResult;
  }
  
  // Check for math expressions
  const mathResult = evaluateMathExpression(input);
  if (mathResult !== null) {
    return `The answer is ${mathResult}`;
  }
  
  // Check knowledge base
  for (const [category, data] of Object.entries(knowledgeBase)) {
    if (category === 'default') continue;
    
    const patterns = (data as any).patterns;
    if (patterns?.some((pattern: string) => lowercaseInput.includes(pattern))) {
      const responses = (data as any).responses;
      const response = responses[Math.floor(Math.random() * responses.length)];
      return typeof response === 'function' ? response() : response;
    }
  }
  
  const defaultResponses = knowledgeBase.default.responses;
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your friendly chatbot. I can help with:\n- Weather information\n- Math calculations\n- Unit conversions\n- Telling jokes\n- Time information\nWhat would you like to know?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFeedback = (messageId: number, feedback: 'like' | 'dislike') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const botResponse = await findBestResponse(userMessage.text);
      const botMessage: Message = {
        id: messages.length + 2,
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "I'm sorry, I encountered an error. Please try again.",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Friendly Chatbot</h1>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-indigo-700 rounded-full transition-colors"
              title="Reset conversation"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {message.sender === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="text-sm opacity-75">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="whitespace-pre-line">{message.text}</p>
                {message.sender === 'bot' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleFeedback(message.id, 'like')}
                      className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                        message.feedback === 'like' ? 'text-green-500' : 'text-gray-500'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'dislike')}
                      className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                        message.feedback === 'dislike' ? 'text-red-500' : 'text-gray-500'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 p-3 rounded-lg rounded-bl-none">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="text-sm">typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-200 bg-gray-50"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;