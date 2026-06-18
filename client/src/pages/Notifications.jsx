import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const Notifications = () => {
  const { data: productsData } = useApi('/api/notifications/products');
  const { data: historyData, refetch } = useApi('/api/notifications/broadcasts');
  const { addToast } = useToast();

  const [form, setForm] = useState({
    product_slug: '',
    title: '',
    body: '',
    dry_run: false,
  });
  const [sending, setSending] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const products = productsData?.data || [];
  const history = historyData?.data || [];

  const handleDryRun = async () => {
    if (!form.product_slug || !form.title || !form.body) {
      addToast('Fill in all fields first', 'warning');
      return;
    }
    setSending(true);
    setDryRunResult(null);
    try {
      const result = await api.post('/api/notifications/send', { ...form, dry_run: true });
      setDryRunResult(result.data);
      addToast(result.message, 'success');
    } catch (err) {
      addToast(err.message || 'Dry run failed', 'danger');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!form.product_slug || !form.title || !form.body) {
      addToast('Fill in all fields before sending', 'warning');
      return;
    }
    if (!confirm(`Send "${form.title}" to all opted-in users of ${
      products.find((p) => p.slug === form.product_slug)?.name || form.product_slug
    }?`)) return;

    setSending(true);
    setLastResult(null);
    try {
      const result = await api.post('/api/notifications/send', { ...form, dry_run: false });
      setLastResult(result.data);
      addToast(result.message, 'success');
      setForm((f) => ({ ...f, title: '', body: '' }));
      setDryRunResult(null);
      refetch();
    } catch (err) {
      addToast(err.message || 'Send failed', 'danger');
    } finally {
      setSending(false);
    }
  };

  if (!productsData || !historyData) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading notifications...</div>;
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Broadcast push notifications to product users"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px', color: 'var(--text)' }}>
            Compose Broadcast
          </h3>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: '500',
              color: 'var(--text-muted)', marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Product
            </label>
            <select
              value={form.product_slug}
              onChange={(e) => setForm((f) => ({ ...f, product_slug: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
            {products.length === 0 && (
              <small style={{ color: 'var(--warning)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                No products have a broadcast URL configured yet.
                Add one in Manage Products.
              </small>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)',
              marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <span>Title</span>
              <span style={{ color: form.title.length > 45 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {form.title.length}/50
              </span>
            </label>
            <input
              type="text"
              placeholder="New feature available!"
              maxLength={50}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)',
              marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <span>Message</span>
              <span style={{ color: form.body.length > 130 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {form.body.length}/150
              </span>
            </label>
            <textarea
              placeholder="Check out what's new in your project management dashboard..."
              maxLength={150}
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              style={{ width: '100%', resize: 'vertical', minHeight: '90px' }}
            />
          </div>

          {dryRunResult && (
            <div style={{
              background: 'var(--info-bg)', border: '1px solid var(--info)',
              borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px',
              fontSize: '13px', color: 'var(--info)',
            }}>
              📊 Dry run: <strong>{dryRunResult.estimated_recipients ?? 0} estimated recipients</strong>
            </div>
          )}

          {lastResult && lastResult.status === 'sent' && (
            <div style={{
              background: 'var(--success-bg)', border: '1px solid var(--success)',
              borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px',
              fontSize: '13px', color: 'var(--success)',
            }}>
              ✅ Sent: <strong>{lastResult.sent_count}</strong> delivered
              {lastResult.failed_count > 0 && `, ${lastResult.failed_count} failed`}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDryRun}
              disabled={sending || !form.product_slug || !form.title || !form.body}
              className="btn"
              style={{
                flex: 1, padding: '10px', fontSize: '13px',
                background: 'var(--primary-bg)', color: 'var(--primary)',
                border: '1px solid var(--primary)', borderRadius: '8px',
                cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? 'Running...' : '🔍 Dry Run'}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !form.product_slug || !form.title || !form.body}
              className="btn btn-primary"
              style={{
                flex: 2, padding: '10px', fontSize: '13px',
                cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? 'Sending...' : '📣 Send Broadcast'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '20px' }}>
            Broadcast History
          </h3>

          {history.length === 0 ? (
            <div style={{
              textAlign: 'center', color: 'var(--text-muted)',
              padding: '40px 20px', fontSize: '13px',
            }}>
              No broadcasts sent yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((b) => (
                <div key={b.id} style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: '4px',
                  }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                        {b.title}
                      </span>
                      {b.dry_run && (
                        <span style={{
                          marginLeft: '8px', fontSize: '11px',
                          background: 'var(--info-bg)', color: 'var(--info)',
                          padding: '2px 6px', borderRadius: '4px', fontWeight: '500',
                        }}>
                          DRY RUN
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(b.sent_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    {b.body.length > 80 ? `${b.body.slice(0, 80)}…` : b.body}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{b.product_name}</span>
                    {!b.dry_run && (
                      <>
                        <span style={{ color: b.status === 'sent' ? 'var(--success)' : 'var(--danger)' }}>
                          {b.status === 'sent'
                            ? `✓ ${b.sent_count} sent`
                            : `✗ ${b.error_message?.slice(0, 60) || 'Failed'}`}
                        </span>
                        {b.failed_count > 0 && (
                          <span style={{ color: 'var(--warning)' }}>{b.failed_count} failed</span>
                        )}
                      </>
                    )}
                    {b.dry_run && (
                      <span style={{ color: 'var(--info)' }}>
                        ~{b.estimated_recipients} estimated
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
