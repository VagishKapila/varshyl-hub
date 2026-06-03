import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { DataTable } from '../components/common/DataTable';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

const EVENT_OPTIONS = [
  { value: 'user_action', label: 'User Action' },
  { value: 'flag_toggled', label: 'Flag Toggled' },
  { value: 'entitlement_granted', label: 'Entitlement Granted' },
  { value: 'alert_created', label: 'Alert Created' },
  { value: '*', label: 'All Events (*)' },
];

const emptyForm = {
  name: '',
  endpoint_url: '',
  secret: '',
  product_slug: '',
  events: [],
};

export const Webhooks = () => {
  const { data, refetch } = useApi('/api/webhooks');
  const { data: productsData } = useApi('/api/products');
  const [showModal, setShowModal] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const { addToast } = useToast();

  const products = productsData?.data || [];

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing && selectedWebhook) {
        await api.put(`/api/webhooks/${selectedWebhook.id}`, {
          ...formData,
          product_slug: formData.product_slug || null,
        });
        addToast('Webhook updated', 'success');
      } else {
        await api.post('/api/webhooks', {
          ...formData,
          product_slug: formData.product_slug || null,
        });
        addToast('Webhook registered', 'success');
      }
      setShowModal(false);
      setFormData(emptyForm);
      setIsEditing(false);
      setSelectedWebhook(null);
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to save webhook', 'danger');
    }
  };

  const handleEdit = (webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      endpoint_url: webhook.endpoint_url,
      secret: webhook.secret || '',
      product_slug: webhook.product_slug || '',
      events: webhook.events || [],
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleToggle = async (id) => {
    try {
      await api.post(`/api/webhooks/${id}/toggle`, {});
      addToast('Webhook updated', 'success');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to toggle webhook', 'danger');
    }
  };

  const handleTest = async (id) => {
    try {
      await api.post(`/api/webhooks/${id}/test`, {});
      addToast('Test event fired', 'success');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to fire test', 'danger');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete webhook "${name}"?`)) return;
    try {
      await api.delete(`/api/webhooks/${id}`);
      addToast('Webhook deleted', 'success');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to delete webhook', 'danger');
    }
  };

  const handleShowDeliveries = async (webhook) => {
    setSelectedWebhook(webhook);
    setShowDeliveriesModal(true);
    setDeliveriesLoading(true);
    try {
      const result = await api.get(`/api/webhooks/${webhook.id}/deliveries`);
      setDeliveries(result.data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load deliveries', 'danger');
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const toggleEvent = (eventValue) => {
    setFormData((prev) => {
      const events = prev.events.includes(eventValue)
        ? prev.events.filter((e) => e !== eventValue)
        : [...prev.events, eventValue];
      return { ...prev, events };
    });
  };

  const truncateUrl = (url) => (url.length > 40 ? url.slice(0, 40) + '...' : url);

  if (!data?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading webhooks...</div>;
  }

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Outbound event delivery"
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setFormData(emptyForm);
              setIsEditing(false);
              setSelectedWebhook(null);
              setShowModal(true);
            }}
          >
            Register Endpoint
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'product', label: 'Product' },
          { key: 'url', label: 'Endpoint URL' },
          { key: 'events', label: 'Events' },
          { key: 'status', label: 'Status' },
          { key: 'last', label: 'Last Triggered' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={data.data}
        renderRow={(webhook) => (
          <tr key={webhook.id}>
            <td>{webhook.name}</td>
            <td>{webhook.product_slug || 'All'}</td>
            <td>
              <code style={{ fontSize: '11px' }} title={webhook.endpoint_url}>
                {truncateUrl(webhook.endpoint_url)}
              </code>
            </td>
            <td>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(webhook.events || []).map((ev) => (
                  <span key={ev} className="badge info" style={{ fontSize: '10px' }}>{ev}</span>
                ))}
              </div>
            </td>
            <td>
              <span className={`badge ${webhook.is_active ? 'success' : 'warning'}`}>
                {webhook.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td>
              {webhook.last_triggered_at
                ? new Date(webhook.last_triggered_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })
                : 'Never'}
            </td>
            <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Button size="xs" onClick={() => handleEdit(webhook)}>Edit</Button>
              <Button size="xs" onClick={() => handleToggle(webhook.id)}>
                {webhook.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="xs" onClick={() => handleTest(webhook.id)}>Test</Button>
              <Button size="xs" onClick={() => handleShowDeliveries(webhook)}>Deliveries</Button>
              <Button size="xs" variant="danger" onClick={() => handleDelete(webhook.id, webhook.name)}>
                Delete
              </Button>
            </td>
          </tr>
        )}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setIsEditing(false); }}
        title={isEditing ? `Edit ${selectedWebhook?.name}` : 'Register Endpoint'}
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-submit" onClick={handleSave}>
              {isEditing ? 'Save Changes' : 'Register'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Webhook"
              required
            />
          </div>
          <div className="form-group">
            <label>Endpoint URL</label>
            <input
              type="url"
              value={formData.endpoint_url}
              onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
              placeholder="https://example.com/webhook"
              required
            />
          </div>
          <div className="form-group">
            <label>Secret (optional, for HMAC signing)</label>
            <input
              type="text"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              placeholder="whsec_..."
            />
          </div>
          <div className="form-group">
            <label>Product</label>
            <select
              value={formData.product_slug}
              onChange={(e) => setFormData({ ...formData, product_slug: e.target.value })}
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Events</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {EVENT_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={formData.events.includes(opt.value)}
                    onChange={() => toggleEvent(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Deliveries Modal */}
      <Modal
        isOpen={showDeliveriesModal}
        onClose={() => setShowDeliveriesModal(false)}
        title={`Deliveries — ${selectedWebhook?.name}`}
        actions={
          <button className="btn-cancel" onClick={() => setShowDeliveriesModal(false)}>Close</button>
        }
      >
        {deliveriesLoading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading deliveries...</div>
        ) : deliveries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No deliveries yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Success</th>
                  <th>Duration</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontSize: '12px' }}>
                      {new Date(d.attempted_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td><code style={{ fontSize: '11px' }}>{d.event_type}</code></td>
                    <td>{d.response_status || '—'}</td>
                    <td>{d.success ? '✅' : '❌'}</td>
                    <td>{d.duration_ms != null ? `${d.duration_ms}ms` : '—'}</td>
                    <td style={{ fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.response_body || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
};
