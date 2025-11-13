import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="layout">
      <Header onMenuToggle={toggleMobileMenu} />
      <div className="layout-container">
        <Sidebar isOpen={mobileMenuOpen} onClose={closeMobileMenu} />
        <main className="main-content">
          {children}
        </main>
      </div>
      {mobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu} />}
    </div>
  );
};

export default Layout;
