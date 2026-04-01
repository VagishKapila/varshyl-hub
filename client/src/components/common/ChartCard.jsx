export const ChartCard = ({ title, subtitle, children, empty = false, emptyIcon = '📊', emptyText = 'No data available' }) => {
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {subtitle && <div className="chart-subtitle">{subtitle}</div>}
      {empty ? (
        <div className="chart-empty">
          <span>{emptyIcon}</span>
          {emptyText}
        </div>
      ) : (
        children
      )}
    </div>
  );
};
