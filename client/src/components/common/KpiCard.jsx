export const KpiCard = ({ label, value, sub, trend, icon, variant = '' }) => {
  const trendClass = trend ? `kpi-trend ${trend.direction}` : '';
  const classNames = `kpi-card ${variant}`;

  return (
    <div className={classNames}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && (
        <div className="kpi-sub">
          {trend && <span className={trendClass}>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}</span>}
          {!trend && sub}
        </div>
      )}
      {icon && <div className="kpi-icon">{icon}</div>}
    </div>
  );
};
