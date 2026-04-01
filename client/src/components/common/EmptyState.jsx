export const EmptyState = ({ icon = '📦', title = 'No data', message = 'There is nothing to display yet' }) => {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
};
