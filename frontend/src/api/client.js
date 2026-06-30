import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:8000" });

export const uploadReport = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/api/reports/upload", form).then((r) => r.data);
};

export const getPeriods = () => api.get("/api/reports/periods").then((r) => r.data);

export const deletePeriod = (id) => api.delete(`/api/reports/periods/${id}`).then((r) => r.data);

export const getDynamics = (params) =>
  api.get("/api/analytics/dynamics", { params }).then((r) => r.data);

export const getFilters = (periodId) =>
  api.get(`/api/analytics/periods/${periodId}/filters`).then((r) => r.data);

export const getTuRows = (periodId, params) =>
  api.get(`/api/analytics/periods/${periodId}/tu`, { params }).then((r) => r.data);

export default api;
