import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password);
      navigate("/profile");
    } catch (err) {
      setError(err.response?.data?.errors?.join(", ") ?? "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Create account</h1>
      <form onSubmit={handleSubmit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
      </form>
      <p>Already have an account? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
