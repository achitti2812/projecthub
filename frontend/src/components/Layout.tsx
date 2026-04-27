import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>ProjectHub</h2>
        </div>
        <div className="nav-links">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/ai">AI Assistant</NavLink>
        </div>
        <div className="sidebar-footer">
          <span className="user-name">{user?.name}</span>
          <button onClick={logout} className="btn btn-sm">
            Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
