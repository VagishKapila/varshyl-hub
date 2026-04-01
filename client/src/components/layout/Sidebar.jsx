import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';

export const Sidebar = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();
  const { data: products } = useApi('/api/products');

  const handleLogout = () => {
    logout();
    // App.jsx re-renders to Login when token is cleared
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h2>
          <div className="s-icon">📊</div>
          Varshyl Hub
        </h2>
        <small>Business Hub</small>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section">Overview</div>
        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-icon">📊</span> Dashboard
        </button>
        <button
          className={`nav-item ${currentPage === 'revenue' ? 'active' : ''}`}
          onClick={() => onNavigate('revenue')}
        >
          <span className="nav-icon">💰</span> Revenue
        </button>
        <button
          className={`nav-item ${currentPage === 'alerts' ? 'active' : ''}`}
          onClick={() => onNavigate('alerts')}
        >
          <span className="nav-icon">🔔</span> Alerts
        </button>

        {products && products.data && products.data.length > 0 && (
          <>
            <div className="nav-divider"></div>
            <div className="nav-section">Products</div>
            {products.data.map((product) => (
              <button
                key={product.id}
                className={`nav-item ${currentPage === `product-${product.slug}` ? 'active' : ''}`}
                onClick={() => onNavigate(`product-${product.slug}`, product)}
                title={product.name}
              >
                <span className="nav-icon">{product.icon || '📦'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product.name}
                </span>
              </button>
            ))}
          </>
        )}

        <div className="nav-divider"></div>
        <div className="nav-section">Settings</div>
        <button
          className={`nav-item ${currentPage === 'admins' ? 'active' : ''}`}
          onClick={() => onNavigate('admins')}
        >
          <span className="nav-icon">🛡️</span> Manage Admins
        </button>
        <button
          className={`nav-item ${currentPage === 'products-manage' ? 'active' : ''}`}
          onClick={() => onNavigate('products-manage')}
        >
          <span className="nav-icon">⚙️</span> Manage Products
        </button>
        <button
          className={`nav-item ${currentPage === 'activity' ? 'active' : ''}`}
          onClick={() => onNavigate('activity')}
        >
          <span className="nav-icon">📋</span> Activity Log
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{getInitials(user?.name)}</div>
          <div>
            <div className="user-name">{user?.name || 'Admin'}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </nav>
  );
};
