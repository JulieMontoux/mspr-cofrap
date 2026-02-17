import { useState } from "react";
import { api } from "../api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
      const res = await api.post("/authenticate", {
        username,
        password,
        otp,
      });
      setMessage(res.data.message || "Authenticated");
    } catch (err) {
      console.log(err);
      console.log(err.response);
      console.log(err.response?.data);
      setMessage(
        err.response?.data?.error ||
          JSON.stringify(err.response?.data) ||
          err.message,
      );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        className="p-2 rounded bg-slate-700"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="p-2 rounded bg-slate-700"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        className="p-2 rounded bg-slate-700"
        placeholder="OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="bg-blue-600 hover:bg-blue-700 p-2 rounded"
      >
        Authenticate
      </button>

      {message && <p className="text-center mt-2 text-sm">{message}</p>}
    </div>
  );
}
