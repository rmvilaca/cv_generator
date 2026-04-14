import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Briefcase, User, CreditCard, LogOut } from "lucide-react";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/job-postings" className="text-lg font-bold tracking-tight">
          CV Generator
        </Link>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/job-postings">
              <Briefcase className="h-4 w-4" />
              Jobs
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profile">
              <User className="h-4 w-4" />
              Profile
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/billing">
              <CreditCard className="h-4 w-4" />
              {user.token_balance} tokens
            </Link>
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
