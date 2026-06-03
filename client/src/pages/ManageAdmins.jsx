import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { DataTable } from '../components/common/DataTable';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

const getRoleBadgeStyle = (role) => {
  if (role === 'owner') {
    return { background: '#E6A96C22', color: '#E6A96C', border: '1px solid #E6A96C44' };
  }
  if (role === 'admin') {
    return { background: '#6366f122', color: '#6366f1' };
  }
  return { background: '#88888822', color: '#888' };
};

export const ManageAdmins = () => {
  const { user: currentUser } = useAuth();
  const { data: admins, refetch: refetchAdmins } = useApi('/api/admins');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'admin' });
  const [newRole, setNewRole] = useState('admin');
  const [resetPassword, setResetPassword] = useState('');
  const { addToast } = useToast();

  const isOwner = currentUser?.role === 'owner';

  const handleInviteUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admins/invite', inviteForm);
      addToast('User invited successfully', 'success');
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', role: 'admin' });
      refetchAdmins();
    } catch (err) {
      addToast(err.message || 'Failed to invite user', 'danger');
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

  const handleChangeRole = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/api/admins/${selectedAdmin.id}/role`, { role: newRole });
      addToast('Role updated successfully', 'success');
      setShowRoleModal(false);
      refetchAdmins();
    } catch (err) {
      addToast(err.message || 'Failed to update role', 'danger');
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
          isOwner ? (
            <Button size="sm" variant="primary" onClick={() => setShowInviteModal(true)}>
              Invite User
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'created', label: 'Created' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={admins.data}
        renderRow={(admin) => (
          <tr key={admin.id}>
            <td>{admin.name}</td>
            <td>{admin.email}</td>
            <td>
              <span
                style={{
                  ...getRoleBadgeStyle(admin.role || 'admin'),
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {admin.role || 'admin'}
              </span>
            </td>
            <td>
              {new Date(admin.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </td>
            <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isOwner && admin.id !== currentUser?.id && admin.role !== 'owner' && (
                <Button
                  size="xs"
                  onClick={() => {
                    setSelectedAdmin(admin);
                    setNewRole(admin.role === 'viewer' ? 'viewer' : 'admin');
                    setShowRoleModal(true);
                  }}
                >
                  Change Role
                </Button>
              )}
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

      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite User"
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowInviteModal(false)}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleInviteUser}>
              Send Invite
            </button>
          </>
        }
      >
        <form onSubmit={handleInviteUser}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              placeholder="User name"
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={`Change Role for ${selectedAdmin?.name}`}
        actions={
          <>
            <button className="btn-cancel" onClick={() => setShowRoleModal(false)}>
              Cancel
            </button>
            <button className="btn-submit" onClick={handleChangeRole}>
              Update Role
            </button>
          </>
        }
      >
        <form onSubmit={handleChangeRole}>
          <div className="form-group">
            <label>Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
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
