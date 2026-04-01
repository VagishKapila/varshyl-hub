import { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { ChartCard } from '../components/common/ChartCard';
import { LineChart } from '../components/charts/LineChart';
import { Badge } from '../components/common/Badge';
import { useApi } from '../hooks/useApi';

export const Dashboard = () => {
  const { data: dashboard, loading: dashLoading } = useApi('/api/dashboard');
  const { data: revenueTrend } = useApi('/api/charts/revenue-trend');
  const { data: userGrowth } = useApi('/api/charts/user-growth');
  const { data: alerts } = useApi('/api/alerts/summary');

  const formatNumber = (n) => {
    if (n == null || isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Number(n).toFixed(0);
  };

  const getAlertColor = (severity) => {
    if (severity === 'critical') return '#dc2626';
    if (severity === 'warning') return '#d97706';
    return '#0284c7';
  };

  const formatChartData = (data) => {
    if (!data || !data.trend) return { labels: [], datasets: [] };
    return {
      labels: data.trend.map((t) => {
        const date = new Date(t.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: data.label || 'Value',
          data: data.trend.map((t) => t.value),
          color: data.color || '#6366f1',
        },
      ],
    };
  };

  if (dashLoading || !dashboard?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading dashboard...</div>;
  }

  const k = dashboard.data;
  const convRate = k.total_users > 0 ? (((k.pro_users || 0) / k.total_users) * 100).toFixed(1) : '0.0';
  const churnRate = k.total_users > 0 ? (((k.churned_users || 0) / k.total_users) * 100).toFixed(1) : '0.0';

  const revenueChartData = formatChartData(revenueTrend?.data);
  const userChartData = formatChartData(userGrowth?.data);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of all products and metrics" />

      <div className="kpi-grid">
        <KpiCard label="Total Revenue" value={`$${formatNumber(k.total_mrr)}`} icon="💰" variant="highlight" />
        <KpiCard label="Total Users" value={formatNumber(k.total_users)} icon="👥" />
        <KpiCard label="Conversion Rate" value={`${convRate}%`} icon="📈" />
        <KpiCard
          label="Active Products"
          value={k.active_products}
          sub={`${k.total_products} total`}
          icon="📦"
        />
      </div>

      <div className="chart-grid">
        {revenueChartData.datasets.length > 0 ? (
          <ChartCard title="Revenue Trend" subtitle="Monthly recurring revenue across all products">
            <LineChart labels={revenueChartData.labels} datasets={revenueChartData.datasets} />
          </ChartCard>
        ) : (
          <ChartCard
            title="Revenue Trend"
            subtitle="Monthly recurring revenue across all products"
            empty={true}
            emptyIcon="📈"
            emptyText="Revenue data will appear once products report metrics"
          />
        )}

        {userChartData.datasets.length > 0 ? (
          <ChartCard title="User Growth" subtitle="Total user count over the last 30 days">
            <LineChart labels={userChartData.labels} datasets={userChartData.datasets} />
          </ChartCard>
        ) : (
          <ChartCard
            title="User Growth"
            subtitle="Total user count over the last 30 days"
            empty={true}
            emptyIcon="👥"
            emptyText="User growth data will appear once products report metrics"
          />
        )}
      </div>

      {/* Products Grid */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Product Overview</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {dashboard.products && dashboard.products.map((p) => (
            <div key={p.id} className="product-card">
              <div className="product-header">
                <div className="product-icon">{p.icon || '📦'}</div>
                <div className="product-name">{p.name}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <Badge status={p.status === 'active' ? 'success' : 'warning'}>{p.status}</Badge>
              </div>
              <div className="product-metrics">
                <div>
                  Users: <strong>{formatNumber(p.users || 0)}</strong>
                </div>
                <div>
                  MRR: <strong>${formatNumber(p.mrr || 0)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      {alerts?.data && alerts.data.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Recent Alerts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alerts.data.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${alert.severity}`}
                style={{ borderLeftColor: getAlertColor(alert.severity) }}
              >
                <span className="alert-icon">
                  {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div className="alert-text">
                  <div style={{ fontWeight: '500', color: 'var(--text)' }}>{alert.title}</div>
                  <div className="alert-product">{alert.product}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
