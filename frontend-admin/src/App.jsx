import { useState, useRef, useEffect } from 'react';
import './App.css';

// CONFIG: Variables de entorno (Vite requiere prefijo VITE_)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/chat';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

function App() {
  // ESTADOS: mensajes, input, carga
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // REF: para auto-scroll al último mensaje
  const messagesEndRef = useRef(null);

  // EFECTO: baja al último mensaje cuando hay nuevo contenido
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ENVÍO: maneja lógica de mensaje + llamada a API/mock + errores
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      let botResponse;

      if (USE_MOCK) {
        // MODO PRUEBA: respuesta simulada sin backend
        await new Promise(res => setTimeout(res, 600));
        botResponse = { response: `🌸 Gracias por escribirme. ¿Cómo te sientes hoy? (Modo prueba)` };
      } else {
        // MODO REAL: llamada al backend de Dev 3
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage }) // Contrato API
        });

        if (!res.ok) throw new Error(`Error ${res.status}`);
        
        const data = await res.json();
        // Dev 3 devuelve { response: "..." }, con fallback por seguridad
        botResponse = { response: data.response || data.reply || data.message || 'Sin contenido' };
      }

      setMessages(prev => [...prev, { role: 'bot', content: botResponse.response }]);

    } catch (error) {
      // MANEJO DE ERRORES: muestra mensaje claro al usuario
      console.error('Error:', error);
      const errorMsg = error.message.includes('Failed to fetch') 
        ? '⚠️ No se pudo conectar al backend. Verifica que esté corriendo.' 
        : `⚠️ Error: ${error.message}`;
      setMessages(prev => [...prev, { role: 'bot', content: errorMsg }]);
    } finally {
      setIsLoading(false); // libera el input tras respuesta/error
    }
  };

  // ENTER: envía con Enter (sin Shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="admin-chat-container">
      {/* HEADER: título + estado */}
      <header className="chat-header">
        <div>
          <h2>🌸 Panel Admin - Chatbot Blossom</h2>
          <small>{API_URL}</small>
        </div>
        <span className={`status ${isLoading ? 'loading' : 'ready'}`}>
          {isLoading ? '⏳' : '✓ Listo'}
        </span>
      </header>

      {/* MENSAJES: lista con scroll */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Escribe un mensaje para probar el chatbot.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'Tú:' : 'Blossom:'}</strong>
            <p>{msg.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT: campo + botón */}
      <div className="input-area">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe y presiona Enter..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
          {isLoading ? '⏳' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
export default App;