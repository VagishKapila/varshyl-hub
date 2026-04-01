import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { ChartCard } from '../components/common/ChartCard';
import { Badge } from '../components/common/Badge';
import { DataTable } from '../components/common/DataTable';
import { Button } from '../components/common/Button';
import { LineChart } from '../components/charts/LineChart';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const ProductDetail = ({ productSlug, product }) => {
  const { data: metrics } = useApi(`/api/products/${productSlug}/metrics`);
  const { data: activity } = useApi(`/api/activity?product=${productSlug}&limit=10`);
  const { data: users, refetch: refetchUsers } = useApi(
    `/api/products/${productSlug}/users?search=&limit=50`
  );
  const [userSearch, setUserSearch] = useState('');
  const { addToast } = useToast();

  const handleUserAction = async (userId, action, extra = {}) => {
    try {
      await api.post(`/api/products/${productSlug}/users/${userId}/action`, { action, ...extra });
      addToast(`User ${action} successful`, 'success');
      refetchUsers();
    } catch (err) {
      addToast(err.message || 'Action failed', 'danger');
    }
  };

  if (!metrics?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading product data...</div>;
  }

  const m = metrics.data;
  const healthPercent = m.health_score || 100;
  const healthStatus = healthPercent >= 80 ? 'healthy' : healthPercent >= 50 ? 'warning' : 'critical';

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

  const mrrChart = formatChartData(m.mrr_trend);
  const usersChart = formatChartData(m.users_trend);
  const signupsChart = formatChartData(m.signups_trend);
  const activityChart = formatChartData(m.activity_trend);

  return (
    <>
      <PageHeader
        title={product?.name || productSlug}
        subtitle={`Health Status: ${healthStatus}`}
        actions={<Badge status={healthStatus}>{healthPercent}% Healthy</Badge>}
      />

      {/* Health Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
          System Health
        </div>
        <div className="health-bar">
          <div
            className={`health-bar-fill ${healthStatus === 'healthy' ? '' : healthStatus === 'warning' ? 'warning' : 'danger'}`}
            style={{ width: `${healthPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="MRR" value={`$${(m.mrr || 0).toFixed(0)}`} icon="💰" variant="highlight" />
        <KpiCard label="Total Users" value={(m.total_users || 0).toFixed(0)} icon="👥" />
        <KpiCard label="Signups (30d)" value={(m.signups_30d || 0).toFixed(0)} icon="📈" />
        <KpiCard label="Churn Rate" value={`${(m.churn_rate || 0).toFixed(1)}%`} icon="📊" />
      </div>

      {/* Charts */}
      <div className="chart-grid">
        {mrrChart.datasets.length > 0 ? (
          <ChartCard title="MRR Trend" subtitle="Daily recurring revenue over the past month">
            <LineChart labels={mrrChart.labels} datasets={mrrChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="MRR Trend" subtitle="Daily recurring revenue over the past month" empty={true} />
        )}

        {usersChart.datasets.length > 0 ? (
          <ChartCard title="User Growth" subtitle="Total registered users over the past month">
            <LineChart labels={usersChart.labels} datasets={usersChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="User Growth" subtitle="Total registered users over the past month" empty={true} />
        )}

        {signupsChart.datasets.length > 0 ? (
          <ChartCard title="Signups" subtitle="New signups over the past month">
            <LineChart labels={signupsChart.labels} datasets={signupsChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="Signups" subtitle="New signups over the past month" empty={true} />
        )}

        {activityChart.datasets.length > 0 ? (
          <ChartCard title="Activity" subtitle="Daily active users over the past month">
            <LineChart labels={activityChart.labels} datasets={activityChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="Activity" subtitle="Daily active users over the past month" empty={true} />
        )}
      </div>

      {/* Activity Timeline */}
      {activity?.data && activity.data.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Recent Activity</h2>
          <div className="activity-timeline">
            {activity.data.map((act, idx) => (
              <div key={idx} className="activity-item">
                <div className="activity-time">
                  {new Date(act.timestamp).toLocaleTimeString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="activity-text">{act.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      {users?.data && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Users ({users.count || 0})</h2>
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="search-input"
            />
          </div>

          <DataTable
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' },
              { key: 'created', label: 'Joined' },
              { key: 'actions', label: 'Actions' },
            ]}
            data={users.data}
            renderRow={(user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td>
                  <Badge status="success">{user.status || 'active'}</Badge>
                </td>
                <td>
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td>
                  <Button
                    size="xs"
                    onClick={() => handleUserAction(user.id, 'email')}
                    style={{ marginRight: '4px' }}
                  >
                    Email
                  </Button>
                </td>
              </tr>
            )}
          />
        </div>
      )}
    </>
  );
};
