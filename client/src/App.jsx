import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Revenue } from './pages/Revenue';
import { Alerts } from './pages/Alerts';
import { ProductDetail } from './pages/ProductDetail';
import { ActivityLog } from './pages/ActivityLog';
import { ManageAdmins } from './pages/ManageAdmins';
import { ManageProducts } from './pages/ManageProducts';
import { Entitlements } from './pages/Entitlements';
import { NightlyDigest } from './pages/NightlyDigest';
import { Webhooks } from './pages/Webhooks';
import './styles/globals.css';

function App() {
  const { token, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedProduct, setSelectedProduct] = useState(null);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  if (!token) {
    return <Login />;
  }

  const handleNavigate = (page, product = null) => {
    setCurrentPage(page);
    setSelectedProduct(product);
  };

  const renderPage = () => {
    if (currentPage === 'dashboard') return <Dashboard />;
    if (currentPage === 'revenue') return <Revenue />;
    if (currentPage === 'alerts') return <Alerts />;
    if (currentPage === 'nightly-digest') return <NightlyDigest />;
    if (currentPage === 'activity') return <ActivityLog />;
    if (currentPage === 'admins') return <ManageAdmins />;
    if (currentPage === 'entitlements') return <Entitlements />;
    if (currentPage === 'webhooks') return <Webhooks />;
    if (currentPage === 'products-manage') return <ManageProducts />;
    if (currentPage.startsWith('product-')) {
      const slug = currentPage.replace('product-', '');
      return <ProductDetail productSlug={slug} product={selectedProduct} />;
    }
    return <Dashboard />;
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}

export default App;
