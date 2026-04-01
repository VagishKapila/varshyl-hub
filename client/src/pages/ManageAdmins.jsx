import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { DataTable } from '../components/common/DataTable';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

export const ManageAdmins = () => {
  const { data: admins, refetch: refetchAdmins } = useApi('/api/admins');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [resetPassword, setResetPassword] = useState('');
  const { addToast } = useToast();

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admins', formData);
      addToast('Admin added successfully', 'success');
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '' });
      refetchAdmins();
    } catch (err) {
      addToast(err.message || 'Failed to add admin', 'danger');
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!confirm('Delete this admin?')) return;
    try {
      await api.delete(`/api/admins/${id}`);
      addToast('Admin deleted', 'success');
      refetchAdmins();
    } catch (err) {
      addToast(err.message || 'Failed to delete admin', 'danger');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/admins/${selectedAdmin.id}/reset-password`, {
        password: resetPassword,
      });
      addToast('Password reset successfully', 'success');
      setShowResetModal(false);
      setResetPassword('');
      refetchAdmins();
    } catch (err) {
      addToast(err.message || 'Failed to reset password', 'danger');
    }
  };

  if (!admins?.data) {
    return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading admins...</div>;
  }

  return (
    <>
      <PageHeader
        title="Manage Admins"
        subtitle="Manage administrator accounts"
        actions={
          <Button size="sm" variant="primary" onClick={() => setShowAddModal(true)}>
            Add Admin
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'created', label: 'Created' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={admins.data}
        renderRow={(admin) => (
          <tr key={admin.id}>
            <td>{admin.name}</td>
            <td>{admin.email}</td>
            <td>
              {new Date(admin.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </td>
            <td style={{ display: 'flex', gap: '8px' }}>
              <Button
                size="xs"
                onClick={() => {
                  setSelectedAdmin(admin);
                  setShowResetModal(true);
                }}
              >
                Reset Password
              </Button>
              <Button
                size="xs"
                variant="danger"
                onClick={() => handleDeleteAdmin(admin.id)}
              >
                Delete
              </Button>
            </td>
          </tr>
        )}
      />

      {/* Add Admin Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Admin"
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleAddAdmin}>
              Add Admin
            </button>
          </>
        }
      >
        <form onSubmit={handleAddAdmin}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Admin name"
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title={`Reset Password for ${selectedAdmin?.name}`}
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowResetModal(false)}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleResetPassword}>
              Reset Password
            </button>
          </>
        }
      >
        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </form>
      </Modal>
    </>
  );
};
