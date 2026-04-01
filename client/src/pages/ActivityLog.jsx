import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { useApi } from '../hooks/useApi';

export const ActivityLog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: activity } = useApi('/api/activity?limit=50');

  if (!activity?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading activity log...</div>;
  }

  const filtered = activity.data.filter((a) =>
    searchTerm === '' || a.description.toLowerCase().includes(searchTerm.toLowerCase()) || a.product.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedByDate = {};
  filtered.forEach((act) => {
    const date = new Date(act.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(act);
  });

  return (
    <>
      <PageHeader
        title="Activity Log"
        subtitle="Track all system activities and changes"
        actions={
          <input
            type="text"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        }
      />

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          No activities found
        </div>
      ) : (
        <div>
          {Object.entries(groupedByDate).map(([date, activities]) => (
            <div key={date} style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {date}
              </h3>

              <div className="activity-timeline">
                {activities.map((act, idx) => (
                  <div key={idx} className="activity-item">
                    <div className="activity-time">
                      {new Date(act.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                    <div className="activity-text">
                      <strong>{act.product}</strong> — {act.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
