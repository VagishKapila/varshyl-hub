import { Sidebar } from './Sidebar';
import { Toast } from './Toast';

export const Layout = ({ currentPage, onNavigate, children }) => {
  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <div className="main-content">{children}</div>
      <Toast />
    </div>
  );
};
