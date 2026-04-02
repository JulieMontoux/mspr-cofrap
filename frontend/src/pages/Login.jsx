import { useState } from "react";
import { api } from "../api";

export default function Login({ onRenew }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setMessage("");
    setError("");

    try {
      const res = await api.post("/authenticate", {
        username,
        password,
        otp,
      });
      setMessage(res.data.message || "Authentication successful");
    } catch (err) {
      const data = err.response?.data;

      if (data?.action === "renew") {
        onRenew(username);
        return;
      }

      setError(data?.error || data?.message || "Authentication failed");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <input
        className="p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        className="p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        className="p-3 rounded-xl bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
        placeholder="OTP Code"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="py-3 rounded-full bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 text-black font-medium tracking-wide hover:scale-[1.02] active:scale-[0.98] transition"
      >
        Authenticate
      </button>
      {message && (
        <div className="p-3 rounded-xl bg-green-400/10 border border-green-400/30 text-green-300 text-sm text-center">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/30 text-red-300 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}