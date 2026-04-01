import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/common/Badge';

describe('Badge', () => {
  it('renders with success status', () => {
    const { container } = render(<Badge status="success">active</Badge>);
    expect(screen.getByText(/active/)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('badge', 'success');
  });

  it('renders with warning status', () => {
    const { container } = render(<Badge status="warning">inactive</Badge>);
    expect(container.firstChild).toHaveClass('badge', 'warning');
    expect(screen.getByText(/⚠/)).toBeInTheDocument();
  });

  it('renders with danger status for critical', () => {
    const { container } = render(<Badge status="critical">down</Badge>);
    expect(container.firstChild).toHaveClass('badge', 'danger');
  });

  it('renders with danger status for error', () => {
    const { container } = render(<Badge status="error" />);
    expect(container.firstChild).toHaveClass('badge', 'danger');
  });

  it('falls back to info variant for unknown status', () => {
    const { container } = render(<Badge status="unknown" />);
    expect(container.firstChild).toHaveClass('badge', 'info');
  });

  it('shows status text when no children provided', () => {
    render(<Badge status="healthy" />);
    expect(screen.getByText(/healthy/)).toBeInTheDocument();
  });
});
