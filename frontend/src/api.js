import axios from "axios";

const API_BASE = "";

export const api = axios.create({
  baseURL: "/function",
});

