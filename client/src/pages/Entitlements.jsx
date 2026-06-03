import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { DataTable } from '../components/common/DataTable';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

const OVERRIDE_TYPES = [
  { value: 'free_forever', label: 'Free Forever' },
  { value: 'pro_override', label: 'Pro Override' },
  { value: 'discount', label: 'Discount' },
  { value: 'trial_extension', label: 'Trial Extension' },
];

const formatOverrideType = (type) => {
  const found = OVERRIDE_TYPES.find((t) => t.value === type);
  return found ? found.label : type;
};

export const Entitlements = () => {
  const { data, refetch } = useApi('/api/entitlements');
  const { data: productsData } = useApi('/api/products');
  const [activeTab, setActiveTab] = useState('overrides');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [grantForm, setGrantForm] = useState({
    email: '',
    product_slug: '',
    override_type: 'free_forever',
    discount_pct: 0,
    trial_days: 0,
    note: '',
    expires_at: '',
  });
  const [promoForm, setPromoForm] = useState({
    code: '',
    product_slug: '',
    discount_pct: 0,
    trial_days: 0,
    max_uses: '',
    valid_until: '',
  });
  const { addToast } = useToast();

  const products = productsData?.data || [];

  const handleGrantOverride = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/entitlements', {
        ...grantForm,
        expires_at: grantForm.expires_at || null,
        discount_pct: grantForm.override_type === 'discount' ? grantForm.discount_pct : 0,
        trial_days: grantForm.override_type === 'trial_extension' ? grantForm.trial_days : 0,
      });
      addToast('Entitlement granted', 'success');
      setShowGrantModal(false);
      setGrantForm({
        email: '',
        product_slug: '',
        override_type: 'free_forever',
        discount_pct: 0,
        trial_days: 0,
        note: '',
        expires_at: '',
      });
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to grant entitlement', 'danger');
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this entitlement?')) return;
    try {
      await api.delete(`/api/entitlements/${id}`);
      addToast('Entitlement revoked', 'success');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to revoke entitlement', 'danger');
    }
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/entitlements/promo-codes', {
        ...promoForm,
        product_slug: promoForm.product_slug || null,
        max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses, 10) : null,
        valid_until: promoForm.valid_until || null,
      });
      addToast('Promo code created', 'success');
      setShowPromoModal(false);
      setPromoForm({
        code: '',
        product_slug: '',
        discount_pct: 0,
        trial_days: 0,
        max_uses: '',
        valid_until: '',
      });
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to create promo code', 'danger');
    }
  };

  const handleTogglePromo = async (id) => {
    try {
      await api.post(`/api/entitlements/promo-codes/${id}/toggle`, {});
      addToast('Promo code updated', 'success');
      refetch();
    } catch (err) {
      addToast(err.message || 'Failed to toggle promo code', 'danger');
    }
  };

  if (!data?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading entitlements...</div>;
  }

  const { entitlements = [], promo_codes = [] } = data.data;

  return (
    <>
      <PageHeader
        title="Entitlements"
        subtitle="User overrides & promo codes"
        actions={
          activeTab === 'overrides' ? (
            <Button size="sm" variant="primary" onClick={() => setShowGrantModal(true)}>
              Grant Override
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setShowPromoModal(true)}>
              Create Promo Code
            </Button>
          )
        }
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'overrides' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('overrides')}
        >
          User Overrides
        </button>
        <button
          className={`btn ${activeTab === 'promos' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('promos')}
        >
          Promo Codes
        </button>
      </div>

      {activeTab === 'overrides' && (
        <DataTable
          columns={[
            { key: 'email', label: 'Email' },
            { key: 'product', label: 'Product' },
            { key: 'type', label: 'Type' },
            { key: 'note', label: 'Note' },
            { key: 'expires', label: 'Expires' },
            { key: 'status', label: 'Status' },
            { key: 'granted', label: 'Granted At' },
            { key: 'actions', label: 'Actions' },
          ]}
          data={entitlements}
          renderRow={(row) => (
            <tr key={row.id}>
              <td>{row.email}</td>
              <td><code style={{ fontSize: '11px' }}>{row.product_slug}</code></td>
              <td>{formatOverrideType(row.override_type)}</td>
              <td>{row.note || '—'}</td>
              <td>
                {row.expires_at
                  ? new Date(row.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Never'}
              </td>
              <td><span className="badge success">Active</span></td>
              <td>
                {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
              <td>
                <Button size="xs" variant="danger" onClick={() => handleRevoke(row.id)}>
                  Revoke
                </Button>
              </td>
            </tr>
          )}
        />
      )}

      {activeTab === 'promos' && (
        <DataTable
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'product', label: 'Product' },
            { key: 'discount', label: 'Discount%' },
            { key: 'trial', label: 'Trial Days' },
            { key: 'uses', label: 'Uses' },
            { key: 'valid', label: 'Valid Until' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: 'Actions' },
          ]}
          data={promo_codes}
          renderRow={(row) => (
            <tr key={row.id}>
              <td><code>{row.code}</code></td>
              <td>{row.product_slug || 'All'}</td>
              <td>{row.discount_pct}%</td>
              <td>{row.trial_days}</td>
              <td>{row.uses_count}{row.max_uses ? `/${row.max_uses}` : ''}</td>
              <td>
                {row.valid_until
                  ? new Date(row.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'No expiry'}
              </td>
              <td>
                <span className={`badge ${row.is_active ? 'success' : 'warning'}`}>
                  {row.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <Button size="xs" onClick={() => handleTogglePromo(row.id)}>
                  {row.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </td>
            </tr>
          )}
        />
      )}

      {/* Grant Override Modal */}
      <Modal
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        title="Grant Override"
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowGrantModal(false)}>Cancel</button>
            <button className="btn-submit" onClick={handleGrantOverride}>Grant Override</button>
          </>
        }
      >
        <form onSubmit={handleGrantOverride}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={grantForm.email}
              onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Product</label>
            <select
              value={grantForm.product_slug}
              onChange={(e) => setGrantForm({ ...grantForm, product_slug: e.target.value })}
              required
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Override Type</label>
            <select
              value={grantForm.override_type}
              onChange={(e) => setGrantForm({ ...grantForm, override_type: e.target.value })}
            >
              {OVERRIDE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {grantForm.override_type === 'discount' && (
            <div className="form-group">
              <label>Discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={grantForm.discount_pct}
                onChange={(e) => setGrantForm({ ...grantForm, discount_pct: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          )}
          {grantForm.override_type === 'trial_extension' && (
            <div className="form-group">
              <label>Trial Days</label>
              <input
                type="number"
                min="1"
                value={grantForm.trial_days}
                onChange={(e) => setGrantForm({ ...grantForm, trial_days: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          )}
          <div className="form-group">
            <label>Note</label>
            <input
              type="text"
              value={grantForm.note}
              onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
              placeholder="Optional note"
            />
          </div>
          <div className="form-group">
            <label>Expires At (optional)</label>
            <input
              type="date"
              value={grantForm.expires_at}
              onChange={(e) => setGrantForm({ ...grantForm, expires_at: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Create Promo Code Modal */}
      <Modal
        isOpen={showPromoModal}
        onClose={() => setShowPromoModal(false)}
        title="Create Promo Code"
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowPromoModal(false)}>Cancel</button>
            <button className="btn-submit" onClick={handleCreatePromo}>Create Promo Code</button>
          </>
        }
      >
        <form onSubmit={handleCreatePromo}>
          <div className="form-group">
            <label>Code</label>
            <input
              type="text"
              value={promoForm.code}
              onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })}
              placeholder="PROMO2024"
              required
            />
          </div>
          <div className="form-group">
            <label>Product</label>
            <select
              value={promoForm.product_slug}
              onChange={(e) => setPromoForm({ ...promoForm, product_slug: e.target.value })}
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Discount %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={promoForm.discount_pct}
              onChange={(e) => setPromoForm({ ...promoForm, discount_pct: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="form-group">
            <label>Trial Days</label>
            <input
              type="number"
              min="0"
              value={promoForm.trial_days}
              onChange={(e) => setPromoForm({ ...promoForm, trial_days: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="form-group">
            <label>Max Uses (optional)</label>
            <input
              type="number"
              min="1"
              value={promoForm.max_uses}
              onChange={(e) => setPromoForm({ ...promoForm, max_uses: e.target.value })}
              placeholder="Unlimited"
            />
          </div>
          <div className="form-group">
            <label>Valid Until (optional)</label>
            <input
              type="date"
              value={promoForm.valid_until}
              onChange={(e) => setPromoForm({ ...promoForm, valid_until: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
};
