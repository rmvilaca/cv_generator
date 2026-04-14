import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) config.headers["Authorization"] = token;
  return config;
});

export default client;
