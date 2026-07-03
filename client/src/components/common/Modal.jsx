export const Modal = ({ isOpen, onClose, title, children, actions = null }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
          </div>
        )}
        <div className="modal-content" style={{ maxHeight: '80vh', overflowY: 'auto' }}>{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
};
