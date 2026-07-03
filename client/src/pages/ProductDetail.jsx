import { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { KpiCard } from '../components/common/KpiCard';
import { ChartCard } from '../components/common/ChartCard';
import { Badge } from '../components/common/Badge';
import { DataTable } from '../components/common/DataTable';
import { LineChart } from '../components/charts/LineChart';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const ProductDetail = ({ productSlug, product, onNavigate }) => {
  const { data: metricsData } = useApi(`/api/products/${productSlug}/metrics`);
  const { data: activity } = useApi(`/api/activity?product=${productSlug}&limit=10`);
  const [userSearch, setUserSearch] = useState('');
  const [usersUrl, setUsersUrl] = useState(
    `/api/products/${productSlug}/users?limit=50`
  );
  const { data: users, refetch: refetchUsers } = useApi(usersUrl);
  const { addToast } = useToast();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setUsersUrl(
        `/api/products/${productSlug}/users?search=${encodeURIComponent(userSearch)}&limit=50`
      );
    }, 400);
    return () => clearTimeout(timeout);
  }, [userSearch, productSlug]);

  const handleUserAction = async (userId, action, extra = {}) => {
    try {
      await api.post(`/api/products/${productSlug}/users/${userId}/action`, { action, ...extra });
      addToast(`User ${action} successful`, 'success');
      refetchUsers();
    } catch (err) {
      addToast(err.message || 'Action failed', 'danger');
    }
  };

  const handleGrantFree = async (email) => {
    try {
      await api.post('/api/entitlements', {
        product_slug: productSlug,
        email,
        override_type: 'free_forever',
        note: 'Granted from Hub user list',
      });
      addToast(`Free access granted to ${email}`, 'success');
      refetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed to grant access', 'danger');
    }
  };

  if (!metricsData) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading product data...</div>;
  }

  const latest = metricsData?.data?.latest;
  const trend = metricsData?.data?.trend || [];

  let score = 100;
  if (!latest) score = 0;
  else {
    if ((latest.errors_24h || 0) > 50) score -= 30;
    else if ((latest.errors_24h || 0) > 10) score -= 15;
    if (latest.total_users > 0 && (latest.active_users_24h || 0) / latest.total_users < 0.05) score -= 20;
    if ((latest.signups_24h || 0) === 0) score -= 10;
    if ((latest.avg_response_ms || 0) > 2000) score -= 15;
    else if ((latest.avg_response_ms || 0) > 500) score -= 5;
  }
  const healthPercent = Math.max(0, score);
  const healthStatus = healthPercent >= 80 ? 'healthy' : healthPercent >= 50 ? 'warning' : 'critical';

  const mrr = (latest?.mrr_cents || 0) / 100;
  const totalUsers = latest?.total_users || 0;
  const signups30d = trend.reduce((sum, t) => sum + (t.signups_24h || 0), 0);
  const churnRate =
    latest?.total_users > 0
      ? ((latest?.churned_users || 0) / latest.total_users * 100).toFixed(1)
      : 0;

  const formatChartData = (arr, label, color) => ({
    labels: arr.map((t) =>
      new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [{ label, data: arr.map((t) => t.value), color }],
  });

  const mrrChart = formatChartData(
    trend.map((t) => ({ date: t.date, value: (t.mrr_cents || 0) / 100 })),
    'MRR ($)',
    '#6366f1'
  );
  const usersChart = formatChartData(
    trend.map((t) => ({ date: t.date, value: t.total_users || 0 })),
    'Total Users',
    '#059669'
  );
  const signupsChart = formatChartData(
    trend.map((t) => ({ date: t.date, value: t.signups_24h || 0 })),
    'Daily Signups',
    '#d97706'
  );
  const activityChart = formatChartData(
    trend.map((t) => ({ date: t.date, value: t.active_users_24h || 0 })),
    'Active Users',
    '#0284c7'
  );

  const hasTrend = trend.length > 0;

  return (
    <>
      <PageHeader
        title={product?.name || productSlug}
        subtitle={`Health Status: ${healthStatus}`}
        actions={<Badge status={healthStatus}>{healthPercent}% Healthy</Badge>}
      />

      {!latest && (
        <div
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--warning)', marginBottom: '4px' }}>
              No data received yet
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              This product hasn&apos;t reported any metrics yet. Make sure VARSHYL_HUB_API_KEY is set in
              this product&apos;s Railway environment and the reporter is running.
            </div>
          </div>
        </div>
      )}

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
        <KpiCard label="MRR" value={`$${mrr.toFixed(0)}`} icon="💰" variant="highlight" />
        <KpiCard label="Total Users" value={totalUsers.toFixed(0)} icon="👥" />
        <KpiCard label="Signups (30d)" value={signups30d.toFixed(0)} icon="📈" />
        <KpiCard label="Churn Rate" value={`${churnRate}%`} icon="📊" />
      </div>

      {latest && (
        <div className="kpi-grid" style={{ marginTop: '16px' }}>
          <KpiCard label="Active Today" value={latest.active_users_24h || 0} icon="⚡" />
          <KpiCard label="Trial Users" value={latest.trial_users || 0} icon="🔬" />
          <KpiCard label="Pro Users" value={latest.pro_users || 0} icon="⭐" />
          <KpiCard
            label="Errors (24h)"
            value={latest.errors_24h || 0}
            icon="🚨"
            variant={latest.errors_24h > 10 ? 'danger' : ''}
          />
          <KpiCard label="Signups Today" value={latest.signups_24h || 0} icon="✨" />
          <KpiCard label="Free Override" value={latest.free_override_users || 0} icon="🎁" />
          <KpiCard
            label="Avg Response"
            value={latest.avg_response_ms ? `${latest.avg_response_ms}ms` : 'N/A'}
            icon="⏱️"
          />
          <KpiCard
            label="Last Report"
            value={
              latest.recorded_at
                ? new Date(latest.recorded_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Never'
            }
            icon="🕐"
          />
        </div>
      )}

      {/* Charts */}
      <div className="chart-grid">
        {hasTrend ? (
          <ChartCard title="MRR Trend" subtitle="Daily recurring revenue over the past month">
            <LineChart labels={mrrChart.labels} datasets={mrrChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="MRR Trend" subtitle="Daily recurring revenue over the past month" empty={true} />
        )}

        {hasTrend ? (
          <ChartCard title="User Growth" subtitle="Total registered users over the past month">
            <LineChart labels={usersChart.labels} datasets={usersChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="User Growth" subtitle="Total registered users over the past month" empty={true} />
        )}

        {hasTrend ? (
          <ChartCard title="Signups" subtitle="New signups over the past month">
            <LineChart labels={signupsChart.labels} datasets={signupsChart.datasets} />
          </ChartCard>
        ) : (
          <ChartCard title="Signups" subtitle="New signups over the past month" empty={true} />
        )}

        {hasTrend ? (
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
      {users && (
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

          {users?.no_db_connection && (
            <div
              style={{
                background: 'var(--info-bg)',
                border: '1px solid var(--info)',
                borderRadius: 'var(--radius)',
                padding: '16px 20px',
                marginBottom: '16px',
              }}
            >
              <strong>👥 {users.count} users total</strong> — Add the DATABASE_URL in{' '}
              <button
                style={{
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
                onClick={() => onNavigate && onNavigate('products-manage')}
              >
                Manage Products
              </button>{' '}
              to see individual user records.
            </div>
          )}

          {users?.data && (
            <div
              style={{
                display: 'flex',
                gap: '20px',
                marginBottom: '16px',
                fontSize: '13px',
                color: 'var(--text-muted)',
              }}
            >
              <span>
                <strong style={{ color: 'var(--text)' }}>{users.count || 0}</strong> total
              </span>
              <span>
                <strong style={{ color: 'var(--success)' }}>
                  {
                    users.data.filter((u) => {
                      const days =
                        (Date.now() - new Date(u.updated_at || u.created_at)) / 86400000;
                      return days <= 7;
                    }).length
                  }
                </strong>{' '}
                active this week
              </span>
              <span>
                <strong style={{ color: 'var(--primary)' }}>
                  {
                    users.data.filter((u) => {
                      const days = (Date.now() - new Date(u.created_at)) / 86400000;
                      return days <= 30;
                    }).length
                  }
                </strong>{' '}
                new this month
              </span>
            </div>
          )}

          {users?.data && users.data.length > 0 && (
            <DataTable
              columns={[
                { key: 'email', label: 'Email' },
                { key: 'name', label: 'Name' },
                { key: 'plan', label: 'Plan' },
                { key: 'activity', label: 'Last Active' },
                { key: 'joined', label: 'Joined' },
                { key: 'actions', label: 'Actions' },
              ]}
              data={users.data}
              renderRow={(user) => {
                const lastActive = user.updated_at || user.created_at;
                const daysSince = (Date.now() - new Date(lastActive)) / 86400000;
                const activityStatus =
                  daysSince <= 7 ? 'success' : daysSince <= 30 ? 'warning' : 'default';
                const activityLabel =
                  daysSince <= 1
                    ? 'Today'
                    : daysSince <= 7
                      ? `${Math.floor(daysSince)}d ago`
                      : daysSince <= 30
                        ? `${Math.floor(daysSince)}d ago`
                        : '30d+ ago';

                const plan = user.subscription_status || user.plan_type || 'free';
                const planColor =
                  plan === 'active' || plan === 'pro'
                    ? 'var(--success)'
                    : plan === 'trial' || plan === 'free_trial'
                      ? 'var(--warning)'
                      : plan === 'free_override'
                        ? 'var(--primary)'
                        : 'var(--text-muted)';

                return (
                  <tr key={user.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{user.email}</td>
                    <td>{user.name || '—'}</td>
                    <td>
                      <span
                        style={{
                          color: planColor,
                          fontWeight: '600',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {plan}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color:
                            activityStatus === 'success'
                              ? 'var(--success)'
                              : activityStatus === 'warning'
                                ? 'var(--warning)'
                                : 'var(--text-muted)',
                          fontSize: '13px',
                        }}
                      >
                        {activityLabel}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          className="btn"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => handleGrantFree(user.email)}
                        >
                          🎁 Free
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => handleUserAction(user.id, 'block')}
                        >
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }}
            />
          )}
        </div>
      )}
    </>
  );
};
