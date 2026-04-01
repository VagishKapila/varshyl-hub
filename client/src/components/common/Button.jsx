export const Button = ({ children, variant = 'primary', size = 'md', onClick, disabled = false, type = 'button', ...props }) => {
  let className = '';

  if (size === 'sm') {
    className = `btn-sm ${variant === 'primary' ? 'primary' : ''}`;
  } else if (size === 'xs') {
    className = `btn-xs ${variant === 'danger' ? 'danger' : ''}`;
  } else {
    className = 'btn-primary';
  }

  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  );
};
