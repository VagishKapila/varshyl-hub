import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const NightlyDigest = () => {
  const { data, refetch } = useApi('/api/digest');
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi Vagish, I'm Soren. Ask me anything about your portfolio." },
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleRunDigest = async () => {
    setRunning(true);
    try {
      await api.post('/api/digest/run', {});
      addToast('Digest generated and sent', 'success');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to run digest', 'danger');
    } finally {
      setRunning(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setChatLoading(true);

    try {
      const history = newMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await api.post('/api/digest/chat', {
        message: userMessage,
        history,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: result.data.reply }]);
    } catch (err) {
      addToast(err.message || 'Failed to get reply', 'danger');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const digests = data?.data || [];

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      {/* Left Column — Digest History */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PageHeader
          title="Nightly Digest"
          subtitle="Soren AI Portfolio Analyst"
          actions={
            <Button size="sm" variant="primary" onClick={handleRunDigest} disabled={running}>
              {running ? 'Running...' : 'Run Digest Now'}
            </Button>
          }
        />

        {!data?.data ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading digests...</div>
        ) : digests.length === 0 ? (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No digests yet. Click "Run Digest Now" to generate the first one.
          </div>
        ) : (
          digests.map((digest) => {
            const bullets = Array.isArray(digest.bullets) ? digest.bullets : [];
            return (
              <div key={digest.id} className="card" style={{ padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '15px' }}>
                    {new Date(digest.digest_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </strong>
                  <span className={`badge ${digest.email_sent ? 'success' : 'warning'}`}>
                    {digest.email_sent ? 'Sent' : 'Not Sent'}
                  </span>
                </div>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
                  {bullets.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ol>
              </div>
            );
          })
        )}
      </div>

      {/* Right Column — Soren Chat */}
      <div className="card" style={{ flex: 1, minWidth: 0, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Ask Soren</h3>

        <div
          style={{
            flex: 1,
            height: '400px',
            overflowY: 'auto',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--card)',
                color: msg.role === 'user' ? '#fff' : 'var(--text)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--card-border)',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              {msg.content}
            </div>
          ))}
          {chatLoading && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
              Soren is thinking...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your portfolio..."
            style={{ flex: 1 }}
            disabled={chatLoading}
          />
          <Button size="sm" variant="primary" type="submit" disabled={chatLoading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};
