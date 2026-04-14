import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <nav className="main-nav">
      <span className="nav-brand">CV Generator</span>
      <div className="nav-links">
        <Link to="/job-postings">Job Postings</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/billing">Billing ({user.token_balance} tokens)</Link>
        <button onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}
