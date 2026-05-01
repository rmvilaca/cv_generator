import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage on every request, except for auth endpoints
// where a stale token can cause Devise/Warden to authenticate via JWT and
// ignore the credentials being submitted.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  const isAuthRoute = config.url === "/login" || config.url === "/signup";
  if (token && !isAuthRoute) config.headers["Authorization"] = token;
  return config;
});

export default client;
