export const Badge = ({ status, children }) => {
  let variant = 'info';
  let icon = 'ℹ️';

  if (status === 'healthy' || status === 'success') {
    variant = 'success';
    icon = '✓';
  } else if (status === 'warning') {
    variant = 'warning';
    icon = '⚠';
  } else if (status === 'critical' || status === 'error' || status === 'danger') {
    variant = 'danger';
    icon = '⚠';
  }

  return (
    <span className={`badge ${variant}`}>
      {icon} {children || status}
    </span>
  );
};
