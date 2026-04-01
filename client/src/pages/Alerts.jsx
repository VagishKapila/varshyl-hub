import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const Alerts = () => {
  const { data: alerts, refetch: refetchAlerts } = useApi('/api/alerts');
  const { data: summary } = useApi('/api/alerts/summary');
  const [filter, setFilter] = useState('all');
  const { addToast } = useToast();

  const handleResolve = async (id) => {
    try {
      await api.post(`/api/alerts/${id}/resolve`, {});
      addToast('Alert resolved', 'success');
      refetchAlerts();
    } catch (err) {
      addToast(err.message || 'Failed to resolve alert', 'danger');
    }
  };

  const handleResolveAll = async () => {
    if (!confirm('Resolve all alerts?')) return;
    try {
      await api.post('/api/alerts/resolve-all', {});
      addToast('All alerts resolved', 'success');
      refetchAlerts();
    } catch (err) {
      addToast(err.message || 'Failed to resolve alerts', 'danger');
    }
  };

  if (!alerts?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading alerts...</div>;
  }

  const allAlerts = alerts.data;
  const filtered = filter === 'all' ? allAlerts : allAlerts.filter((a) => a.severity === filter);

  const groupedAlerts = {};
  filtered.forEach((alert) => {
    if (!groupedAlerts[alert.product]) {
      groupedAlerts[alert.product] = [];
    }
    groupedAlerts[alert.product].push(alert);
  });

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle={`${filtered.length} ${filter === 'all' ? '' : filter} alert${filtered.length !== 1 ? 's' : ''}`}
        actions={
          filtered.length > 0 && (
            <Button onClick={handleResolveAll} size="sm" variant="primary">
              Resolve All
            </Button>
          )
        }
      />

      <div className="alert-filters">
        <button
          className={`alert-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({allAlerts.length})
        </button>
        <button
          className={`alert-filter-btn ${filter === 'critical' ? 'active' : ''}`}
          onClick={() => setFilter('critical')}
        >
          Critical ({allAlerts.filter((a) => a.severity === 'critical').length})
        </button>
        <button
          className={`alert-filter-btn ${filter === 'warning' ? 'active' : ''}`}
          onClick={() => setFilter('warning')}
        >
          Warning ({allAlerts.filter((a) => a.severity === 'warning').length})
        </button>
        <button
          className={`alert-filter-btn ${filter === 'info' ? 'active' : ''}`}
          onClick={() => setFilter('info')}
        >
          Info ({allAlerts.filter((a) => a.severity === 'info').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--success)' }}>All good!</div>
          <div>No {filter === 'all' ? '' : filter + ' '} alerts</div>
        </div>
      ) : (
        <div>
          {Object.entries(groupedAlerts).map(([product, productAlerts]) => (
            <div key={product} style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {product}
              </h3>
              {productAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`alert-item ${alert.severity}`}
                  style={{
                    borderLeftColor:
                      alert.severity === 'critical'
                        ? 'var(--danger)'
                        : alert.severity === 'warning'
                          ? 'var(--warning)'
                          : 'var(--info)',
                  }}
                >
                  <span className="alert-icon">
                    {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                  <div className="alert-text">
                    <div style={{ fontWeight: '500', color: 'var(--text)', marginBottom: '4px' }}>
                      {alert.title}
                    </div>
                    {alert.message && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{alert.message}</div>
                    )}
                  </div>
                  <button
                    className="alert-dismiss"
                    onClick={() => handleResolve(alert.id)}
                    title="Resolve alert"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
