import { useState } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  const [page, setPage] = useState("login");

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#020617] text-white overflow-hidden">

      {/* Decorative blurred shapes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-400 opacity-20 blur-3xl rounded-full"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-400 opacity-20 blur-3xl rounded-full"></div>

      <div className="relative w-full max-w-md p-10 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">

        {/* Title */}
        <h1 className="text-4xl font-light tracking-wide mb-10 text-center">
          MSPR{" "}
          <span className="font-semibold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Secure Auth
          </span>
        </h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-10">
          <button
            onClick={() => setPage("login")}
            className={`flex-1 py-2 rounded-full transition duration-300 ${
              page === "login"
                ? "bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 text-black"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Login
          </button>

          <button
            onClick={() => setPage("register")}
            className={`flex-1 py-2 rounded-full transition duration-300 ${
              page === "register"
                ? "bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-black"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Register
          </button>
        </div>

        {/* Content */}
        {page === "login" && <Login />}
        {page === "register" && <Register />}

      </div>
    </div>
  );
}
