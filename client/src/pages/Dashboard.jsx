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
  const { data: healthData } = useApi('/api/charts/product-health');
  const { data: growthData } = useApi('/api/charts/growth-rate');
  const { data: funnelData } = useApi('/api/charts/funnel');

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

  if (dashLoading || !dashboard?.data?.kpis) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading dashboard...</div>;
  }

  const k = dashboard.data.kpis;
  const mrrDollars = (k.mrr_cents || 0) / 100;
  const convRate = k.total_users > 0 ? (((k.pro_users || 0) / k.total_users) * 100).toFixed(1) : '0.0';
  const churnRate = k.total_users > 0 ? (((k.churned_users || 0) / k.total_users) * 100).toFixed(1) : '0.0';
  const productsList = dashboard.data.products || [];

  const revenueChartData = formatChartData(revenueTrend?.data);
  const userChartData = formatChartData(userGrowth?.data);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of all products and metrics" />

      <div className="kpi-grid">
        <KpiCard label="Total MRR" value={`$${formatNumber(mrrDollars)}`} icon="💰" variant="highlight" />
        <KpiCard label="Total Users" value={formatNumber(k.total_users)} icon="👥" />
        <KpiCard label="Conversion Rate" value={`${convRate}%`} icon="📈" />
        <KpiCard
          label="Active Products"
          value={k.product_count || 0}
          sub={`${k.signups_24h || 0} signups today`}
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

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Product Health</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '16px' }}>
          {(healthData?.data || []).map((p) => (
            <div key={p.slug} className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>{p.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>{p.name}</div>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ margin: '0 auto', display: 'block' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="var(--card-border)" strokeWidth="8" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke={p.health_color}
                  strokeWidth="8"
                  strokeDasharray={`${(p.health_score / 100) * 201} 201`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)"
                />
                <text x="40" y="45" textAnchor="middle" fontSize="18" fontWeight="700" fill={p.health_color}>
                  {p.health_score}
                </text>
              </svg>
              <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '600', color: p.health_color }}>
                {p.health_label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Week over Week</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px' }}>
          {(growthData?.data || []).map((p) => (
            <div key={p.slug} className="card" style={{ padding: '16px' }}>
              <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>{p.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Users</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: p.user_growth_pct >= 0 ? '#059669' : '#dc2626' }}>
                  {p.user_growth_pct >= 0 ? '+' : ''}{p.user_growth_pct}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MRR</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: p.mrr_growth_pct >= 0 ? '#059669' : '#dc2626' }}>
                  {p.mrr_growth_pct >= 0 ? '+' : ''}{p.mrr_growth_pct}%
                </span>
              </div>
              {!p.has_prior_data && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Needs 7 days of data</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Conversion Funnel</h2>
        <div className="card" style={{ padding: '24px' }}>
          {(funnelData?.data || []).length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
              Funnel data will appear once products report metrics
            </div>
          )}
          {(funnelData?.data || []).map((p) => (
            <div key={p.slug} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span>{p.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: '600' }}>{p.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ background: p.color, borderRadius: '6px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                  {p.total_users} total
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
                <div style={{ background: p.color + '99', borderRadius: '6px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                  {p.trial_users} trial <span style={{ opacity: 0.8 }}>({p.trial_rate}%)</span>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
                <div style={{ background: 'var(--card-border)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text)', fontSize: '12px', fontWeight: '600' }}>
                  {p.pro_users} pro <span style={{ opacity: 0.6 }}>({p.pro_rate}%)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          {productsList.map(({ product: p, metrics: m }) => (
            <div key={p.id} className="product-card">
              <div className="product-header">
                <div className="product-icon">{p.icon || '📦'}</div>
                <div className="product-name">{p.name}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <Badge status={p.is_active ? 'success' : 'warning'}>{p.is_active ? 'active' : 'inactive'}</Badge>
              </div>
              <div className="product-metrics">
                <div>
                  Users: <strong>{formatNumber(m?.total_users || 0)}</strong>
                </div>
                <div>
                  MRR: <strong>${formatNumber((m?.mrr_cents || 0) / 100)}</strong>
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
