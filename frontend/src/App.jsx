import { useState } from "react";
import Register from "./pages/Register";
import Login from "./pages/Login";

export default function App() {
  const [page, setPage] = useState("login");

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl w-96">
        <h1 className="text-2xl font-bold text-center mb-6">
          MSPR Secure Auth
        </h1>

        <div className="flex justify-center mb-6 gap-4">
          <button
            onClick={() => setPage("login")}
            className={`px-4 py-2 rounded ${
              page === "login" ? "bg-blue-600" : "bg-slate-700"
            }`}
          >
            Login
          </button>

          <button
            onClick={() => setPage("register")}
            className={`px-4 py-2 rounded ${
              page === "register" ? "bg-blue-600" : "bg-slate-700"
            }`}
          >
            Register
          </button>
        </div>

        {page === "login" && <Login />}
        {page === "register" && <Register />}
      </div>
    </div>
  );
}
