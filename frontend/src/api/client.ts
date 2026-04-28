import axios from "axios";

const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const credMatch = RAW_API_URL.match(/^(https?:\/\/)([^:]+):([^@]+)@(.+)$/);
const API_URL = credMatch ? `${credMatch[1]}${credMatch[4]}` : RAW_API_URL;

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  ...(credMatch
    ? { auth: { username: credMatch[2], password: credMatch[3] } }
    : {}),
});

const tokenHeader = credMatch ? "X-Authorization" : "Authorization";

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers[tokenHeader] = `Bearer ${token}`;
  }
  return config;
});

export default client;
