import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { ChartCard } from '../components/common/ChartCard';
import { LineChart } from '../components/charts/LineChart';
import { BarChart } from '../components/charts/BarChart';
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

  const formatChartData = (data) => {
    if (!data || !data.trend) return { labels: [], datasets: [] };
    return {
      labels: data.trend.map((t) => {
        const date = new Date(t.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: data.label || 'Revenue',
          data: data.trend.map((t) => t.value),
          color: data.color || '#6366f1',
        },
      ],
    };
  };

  if (!revenue?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading revenue data...</div>;
  }

  const r = revenue.data;
  const mrrTrend = details?.data?.mrr_trend || [];
  const drrTrend = details?.data?.drr_trend || [];
  const productDistribution = details?.data?.product_distribution || [];

  return (
    <>
      <PageHeader title="Revenue" subtitle="Detailed revenue metrics and trends" />

      <div className="kpi-grid">
        <KpiCard label="Total MRR" value={`$${formatNumber(r.total_mrr)}`} icon="💰" variant="highlight" />
        <KpiCard label="Total ARR" value={`$${formatNumber(r.total_arr)}`} icon="📈" />
        <KpiCard label="DRR (30 days)" value={`$${formatNumber(r.drr_30d)}`} icon="📊" />
        <KpiCard label="Top Product MRR" value={`$${formatNumber(r.top_product_mrr)}`} sub={r.top_product} />
      </div>

      <div className="chart-grid">
        {mrrTrend.length > 0 ? (
          <ChartCard title="MRR Trend" subtitle="Monthly recurring revenue over 12 months">
            <LineChart
              labels={mrrTrend.map((t) => {
                const date = new Date(t.date);
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
              })}
              datasets={[
                {
                  label: 'MRR',
                  data: mrrTrend.map((t) => t.value),
                  color: '#6366f1',
                },
              ]}
            />
          </ChartCard>
        ) : (
          <ChartCard title="MRR Trend" subtitle="Monthly recurring revenue over 12 months" empty={true} />
        )}

        {drrTrend.length > 0 ? (
          <ChartCard title="Daily Revenue (30 days)" subtitle="Daily recurring revenue over the past month">
            <LineChart
              labels={drrTrend.map((t) => {
                const date = new Date(t.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              })}
              datasets={[
                {
                  label: 'DRR',
                  data: drrTrend.map((t) => t.value),
                  color: '#8b5cf6',
                },
              ]}
            />
          </ChartCard>
        ) : (
          <ChartCard title="Daily Revenue (30 days)" subtitle="Daily recurring revenue over the past month" empty={true} />
        )}
      </div>

      <div className="chart-grid">
        {productDistribution.length > 0 ? (
          <ChartCard
            title="Revenue Distribution"
            subtitle="Current MRR distribution by product"
            style={{ gridColumn: '1 / -1', maxWidth: '450px' }}
          >
            <DoughnutChart
              labels={productDistribution.map((p) => p.product)}
              data={productDistribution.map((p) => p.mrr)}
            />
          </ChartCard>
        ) : (
          <ChartCard title="Revenue Distribution" subtitle="Current MRR distribution by product" empty={true} />
        )}
      </div>

      {/* Product Revenue Cards */}
      {r.products && r.products.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Product Revenue</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {r.products.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-header">
                  <div className="product-icon">{p.icon || '📦'}</div>
                  <div className="product-name">{p.name}</div>
                </div>
                <div className="product-metrics">
                  <div>
                    MRR: <strong>${formatNumber(p.mrr || 0)}</strong>
                  </div>
                  <div>
                    Users: <strong>{formatNumber(p.users || 0)}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                    ARR: <strong>${formatNumber((p.mrr || 0) * 12)}</strong>
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
