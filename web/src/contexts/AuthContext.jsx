import { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    const stored = localStorage.getItem("user");
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  async function login(email, password) {
    const response = await client.post("/login", { user: { email, password } });
    const token = response.headers["authorization"];
    const userData = response.data.data;

    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  async function register(email, password) {
    const response = await client.post("/signup", {
      user: { email, password, password_confirmation: password },
    });
    const token = response.headers["authorization"];
    const userData = response.data.data;

    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  function logout() {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user");
    setUser(null);
  }

  function refreshUser(updated) {
    const merged = { ...user, ...updated };
    localStorage.setItem("user", JSON.stringify(merged));
    setUser(merged);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
