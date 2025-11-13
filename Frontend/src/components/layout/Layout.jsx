import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    if (mobileMenuOpen) {
      body.classList.add('no-scroll');
    } else {
      body.classList.remove('no-scroll');
    }

    return () => {
      body.classList.remove('no-scroll');
    };
  }, [mobileMenuOpen]);

  return (
    <div className={`layout ${mobileMenuOpen ? 'menu-open' : ''}`}>
      <Header onMenuToggle={toggleMobileMenu} />
      <div className="layout-container">
        <Sidebar isOpen={mobileMenuOpen} onClose={closeMobileMenu} />
        <main className="main-content" role="main">
          {children}
        </main>
      </div>
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu} role="presentation" />
      )}
    </div>
  );
};

export default Layout;
