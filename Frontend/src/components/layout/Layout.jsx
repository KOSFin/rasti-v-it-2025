import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = ({ children, user, employee }) => {
  return (
    <div className="layout">
      <Header user={user} employee={employee} />
      <div className="layout-container">
        <Sidebar employee={employee} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
