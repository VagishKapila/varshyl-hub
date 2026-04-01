export const DataTable = ({ columns, data, renderRow }) => {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data && data.length > 0 ? (
          data.map((row, idx) => renderRow(row, idx))
        ) : (
          <tr>
            <td colSpan={columns.length} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              No data
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};
