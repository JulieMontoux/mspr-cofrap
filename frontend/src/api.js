import axios from "axios";

export const api = axios.create({
  baseURL: "/function",
  headers: {
    "Content-Type": "application/json",
  },
});
