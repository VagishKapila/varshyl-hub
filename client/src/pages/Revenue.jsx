import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { ChartCard } from '../components/common/ChartCard';
import { LineChart } from '../components/charts/LineChart';
import { DoughnutChart } from '../components/charts/DoughnutChart';
import { useApi } from '../hooks/useApi';

export const Revenue = () => {
  const { data: revenue } = useApi('/api/revenue');
  const { data: details } = useApi('/api/revenue/details');

  const formatNumber = (n) => {
    if (n == null || isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Number(n).toFixed(0);
  };

  if (!revenue?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading revenue data...</div>;
  }

  const { monthly = [], byProduct = [] } = revenue.data;
  const productCards = details?.data?.product_cards || [];
  const dailyRevenue = details?.data?.daily_revenue || [];

  // Compute KPIs from byProduct (latest snapshots)
  const totalMrrCents = byProduct.reduce((sum, p) => sum + (p.mrr_cents || 0), 0);
  const totalMrr = totalMrrCents / 100;
  const totalArr = totalMrr * 12;
  const topProduct = byProduct.reduce((top, p) => (p.mrr_cents || 0) > (top.mrr_cents || 0) ? p : top, { name: '-', mrr_cents: 0 });

  // Daily revenue for DRR calculation (sum of last 30 days / 30)
  const totalDailyMrr = dailyRevenue.reduce((sum, d) => sum + (d.mrr_cents || 0), 0);
  const drr30d = dailyRevenue.length > 0 ? (totalDailyMrr / dailyRevenue.length) / 100 : 0;

  // Build MRR trend chart from monthly data
  const monthlyAgg = {};
  monthly.forEach((m) => {
    const key = m.month;
    if (!monthlyAgg[key]) monthlyAgg[key] = 0;
    monthlyAgg[key] += (m.mrr_cents || 0);
  });
  const mrrTrendLabels = Object.keys(monthlyAgg).sort().map((d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });
  const mrrTrendData = Object.keys(monthlyAgg).sort().map((k) => monthlyAgg[k] / 100);

  // Daily revenue chart
  const dailyAgg = {};
  dailyRevenue.forEach((d) => {
    const key = d.date;
    if (!dailyAgg[key]) dailyAgg[key] = 0;
    dailyAgg[key] += (d.mrr_cents || 0);
  });
  const drrLabels = Object.keys(dailyAgg).sort().map((d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const drrData = Object.keys(dailyAgg).sort().map((k) => dailyAgg[k] / 100);

  return (
    <>
      <PageHeader title="Revenue" subtitle="Detailed revenue metrics and trends" />

      <div className="kpi-grid">
        <KpiCard label="Total MRR" value={`$${formatNumber(totalMrr)}`} icon="💰" variant="highlight" />
        <KpiCard label="Total ARR" value={`$${formatNumber(totalArr)}`} icon="📈" />
        <KpiCard label="Avg DRR (30d)" value={`$${formatNumber(drr30d)}`} icon="📊" />
        <KpiCard label="Top Product MRR" value={`$${formatNumber((topProduct.mrr_cents || 0) / 100)}`} sub={topProduct.name} />
      </div>

      <div className="chart-grid">
        {mrrTrendLabels.length > 0 ? (
          <ChartCard title="MRR Trend" subtitle="Monthly recurring revenue over 12 months">
            <LineChart
              labels={mrrTrendLabels}
              datasets={[{ label: 'MRR', data: mrrTrendData, color: '#6366f1' }]}
            />
          </ChartCard>
        ) : (
          <ChartCard title="MRR Trend" subtitle="Monthly recurring revenue over 12 months" empty={true} />
        )}

        {drrLabels.length > 0 ? (
          <ChartCard title="Daily Revenue (30 days)" subtitle="Daily recurring revenue over the past month">
            <LineChart
              labels={drrLabels}
              datasets={[{ label: 'DRR', data: drrData, color: '#8b5cf6' }]}
            />
          </ChartCard>
        ) : (
          <ChartCard title="Daily Revenue (30 days)" subtitle="Daily recurring revenue over the past month" empty={true} />
        )}
      </div>

      {/* Revenue Distribution */}
      {byProduct.length > 0 && (
        <div className="chart-grid">
          <ChartCard
            title="Revenue Distribution"
            subtitle="Current MRR distribution by product"
            style={{ gridColumn: '1 / -1', maxWidth: '450px' }}
          >
            <DoughnutChart
              labels={byProduct.map((p) => p.name)}
              data={byProduct.map((p) => (p.mrr_cents || 0) / 100)}
            />
          </ChartCard>
        </div>
      )}

      {/* Product Revenue Cards */}
      {productCards.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Product Revenue</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {productCards.map((p) => (
              <div key={p.slug} className="product-card">
                <div className="product-header">
                  <div className="product-icon">{p.icon || '📦'}</div>
                  <div className="product-name">{p.name}</div>
                </div>
                <div className="product-metrics">
                  <div>
                    MRR: <strong>${formatNumber((p.mrr || 0) / 100)}</strong>
                  </div>
                  <div>
                    Pro Users: <strong>{formatNumber(p.pro_users || 0)}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                    ARR: <strong>${formatNumber((p.mrr || 0) * 12 / 100)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
