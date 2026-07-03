import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { DataTable } from '../components/common/DataTable';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const ManageProducts = () => {
  const { data: products, refetch: refetchProducts } = useApi('/api/products');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    price: 0,
    url: '',
    staging_url: '',
    stripe_account_id: '',
    icon: '📦',
    color: '#6366f1',
    db_connection_string: '',
    broadcast_url: '',
  });
  const { addToast } = useToast();

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/products', formData);
      addToast('Product created successfully', 'success');
      setShowAddModal(false);
      setFormData({
        name: '',
        slug: '',
        price: 0,
        url: '',
        staging_url: '',
        stripe_account_id: '',
        icon: '📦',
        color: '#6366f1',
        db_connection_string: '',
        broadcast_url: '',
      });
      refetchProducts();
    } catch (err) {
      addToast(err.message || 'Failed to create product', 'danger');
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/products/${selectedProduct.slug}`, {
        name: formData.name,
        url: formData.url,
        staging_url: formData.staging_url,
        stripe_account_id: formData.stripe_account_id,
        icon: formData.icon,
        color: formData.color,
        broadcast_url: formData.broadcast_url || null,
      });
      addToast('Product updated successfully', 'success');
      setShowEditModal(false);
      refetchProducts();
    } catch (err) {
      addToast(err.message || 'Failed to update product', 'danger');
    }
  };

  const handleToggleProduct = async (slug, isActive) => {
    try {
      await api.post(`/api/products/${slug}/toggle`, {});
      addToast(`Product ${isActive ? 'deactivated' : 'activated'}`, 'success');
      refetchProducts();
    } catch (err) {
      addToast(err.message || 'Failed to toggle product', 'danger');
    }
  };

  const handleTestDb = async (slug) => {
    try {
      const result = await api.post(`/api/products/${slug}/test-db`, {});
      addToast('Database test successful', 'success');
    } catch (err) {
      addToast(err.message || 'Database test failed', 'danger');
    }
  };

  const handleRegenerateKey = async (slug, name) => {
    if (!confirm(`Regenerate API key for ${name}? The old key will stop working immediately.`)) return;
    try {
      const result = await api.post(`/api/products/${slug}/regenerate-key`, {});
      if (result.data) {
        navigator.clipboard.writeText(result.data);
        addToast('API key regenerated and copied to clipboard', 'success');
      }
      refetchProducts();
    } catch (err) {
      addToast(err.message || 'Failed to regenerate key', 'danger');
    }
  };

  if (!products?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading products...</div>;
  }

  return (
    <>
      <PageHeader
        title="Manage Products"
        subtitle="Configure products and their settings"
        actions={
          <Button size="sm" variant="primary" onClick={() => setShowAddModal(true)}>
            Add Product
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slug', label: 'Slug' },
          { key: 'status', label: 'Status' },
          { key: 'api_key', label: 'API Key' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={products.data}
        renderRow={(product) => (
          <tr key={product.id}>
            <td>{product.name}</td>
            <td>
              <code style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{product.slug}</code>
            </td>
            <td>{product.is_active ? '🟢 Active' : '⭕ Inactive'}</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  vhub_...{(product.api_key || '').slice(-12)}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(product.api_key);
                    addToast('API key copied!', 'success');
                  }}
                  className="btn"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Copy Key
                </button>
              </div>
            </td>
            <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                size="xs"
                onClick={() => {
                  setSelectedProduct(product);
                  setFormData({
                    name: product.name,
                    slug: product.slug,
                    price: product.price || 0,
                    url: product.url || '',
                    staging_url: product.staging_url || '',
                    stripe_account_id: product.stripe_account_id || '',
                    icon: product.icon || '📦',
                    color: product.color || '#6366f1',
                    db_connection_string: product.db_connection_string || '',
                    broadcast_url: product.broadcast_url || '',
                  });
                  setShowEditModal(true);
                }}
              >
                Edit
              </Button>
              <Button
                size="xs"
                onClick={() => handleTestDb(product.slug)}
              >
                Test DB
              </Button>
              <Button
                size="xs"
                onClick={() => handleRegenerateKey(product.slug, product.name)}
              >
                Regenerate Key
              </Button>
              <Button
                size="xs"
                onClick={() => handleToggleProduct(product.slug, product.is_active)}
              >
                {product.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </td>
          </tr>
        )}
      />

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product"
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleAddProduct}>
              Create Product
            </button>
          </>
        }
      >
        <form onSubmit={handleAddProduct}>
          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Product name"
              required
            />
          </div>
          <div className="form-group">
            <label>Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="product-slug"
              required
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Lowercase, no spaces. Used in URLs and API calls.
            </div>
          </div>
          <div className="form-group">
            <label>Price</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Production URL</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="form-group">
            <label>Broadcast URL (optional)</label>
            <input
              type="url"
              placeholder="https://your-product.com/api/push/broadcast"
              value={formData.broadcast_url || ''}
              onChange={(e) => setFormData({ ...formData, broadcast_url: e.target.value })}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Hub will POST to this URL to send push notifications.
              Leave empty to disable notifications for this product.
            </small>
          </div>
          <div className="form-group">
            <label>Staging URL</label>
            <input
              type="url"
              value={formData.staging_url}
              onChange={(e) => setFormData({ ...formData, staging_url: e.target.value })}
              placeholder="https://staging.example.com"
            />
          </div>
          <div className="form-group">
            <label>Stripe Account ID</label>
            <input
              type="text"
              value={formData.stripe_account_id}
              onChange={(e) => setFormData({ ...formData, stripe_account_id: e.target.value })}
              placeholder="acct_..."
            />
          </div>
          <div className="form-group">
            <label>Icon</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="📦"
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Database Connection String</label>
            <input
              type="text"
              value={formData.db_connection_string}
              onChange={(e) => setFormData({ ...formData, db_connection_string: e.target.value })}
              placeholder="postgresql://..."
            />
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit ${selectedProduct?.name}`}
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowEditModal(false)}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleEditProduct}>
              Save Changes
            </button>
          </>
        }
      >
        <form onSubmit={handleEditProduct}>
          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Product name"
              required
            />
          </div>
          <div className="form-group">
            <label>Production URL</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="form-group">
            <label>Broadcast URL (optional)</label>
            <input
              type="url"
              placeholder="https://your-product.com/api/push/broadcast"
              value={formData.broadcast_url || ''}
              onChange={(e) => setFormData({ ...formData, broadcast_url: e.target.value })}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Hub will POST to this URL to send push notifications.
              Leave empty to disable notifications for this product.
            </small>
          </div>
          <div className="form-group">
            <label>Staging URL</label>
            <input
              type="url"
              value={formData.staging_url}
              onChange={(e) => setFormData({ ...formData, staging_url: e.target.value })}
              placeholder="https://staging.example.com"
            />
          </div>
          <div className="form-group">
            <label>Stripe Account ID</label>
            <input
              type="text"
              value={formData.stripe_account_id}
              onChange={(e) => setFormData({ ...formData, stripe_account_id: e.target.value })}
              placeholder="acct_..."
            />
          </div>
          <div className="form-group">
            <label>Icon</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="📦"
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>API Key (read-only)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                value={selectedProduct?.api_key || ''}
                readOnly
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  background: 'var(--bg)',
                  color: 'var(--text-muted)',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedProduct?.api_key || '');
                  addToast('API key copied!', 'success');
                }}
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Copy
              </button>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Use this as VARSHYL_HUB_API_KEY in your product&apos;s Railway env vars
            </small>
          </div>
        </form>
      </Modal>
    </>
  );
};
