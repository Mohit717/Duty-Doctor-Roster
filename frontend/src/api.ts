import axios from "axios";
import type { Assignment, Doctor, Leave } from "./utils/types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

export interface RosterData { month: string; assignments: Assignment[]; leaves: Leave[]; }
export async function getDoctors() { return (await api.get<{ data: Doctor[] }>("/doctors")).data.data; }
export async function getRoster(month: string) { return (await api.get<{ data: RosterData }>(`/roster?month=${month}`)).data.data; }
export async function generateRoster(month: string) { await api.post("/roster/generate", { month }); return getRoster(month); }
export async function updateAssignment(id: string, doctorId: string | null, isActive = true) { return (await api.patch(`/assignments/${id}`, { doctorId, isActive })).data; }