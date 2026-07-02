import axios from "axios";

// In production the frontend is served behind the same nginx host as the
// API (see deploy/nginx-gvs.conf), so requests can stay relative ("").
// VITE_API_BASE_URL can override this for local dev against a remote backend.
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || "" });

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

export const getAllTuRows = (params) =>
  api.get("/api/analytics/tu", { params }).then((r) => r.data);

export const getWeeklySummary = (params) =>
  api.get("/api/analytics/weekly-summary", { params }).then((r) => r.data);

export const getObjectComparison = (params) =>
  api.get("/api/analytics/object-comparison", { params }).then((r) => r.data);

// Приборные (почасовые) данные — отдельная БД
export const getDeviceSummary = (tuUuid) =>
  api.get(`/api/device/points/${tuUuid}/summary`).then((r) => r.data);

export const getDeviceHourly = (tuUuid, params) =>
  api.get(`/api/device/points/${tuUuid}/hourly`, { params }).then((r) => r.data);

export const getDeviceUpload = (id) =>
  api.get(`/api/device/uploads/${id}`).then((r) => r.data);

export const getDevicePointOutages = (tuUuid) =>
  api.get(`/api/device/points/${tuUuid}/outages`).then((r) => r.data);

export const getObjectOutages = (objectId) =>
  api.get(`/api/device/objects/${objectId}/outages`).then((r) => r.data);

export const getPointHierarchy = (tuUuid) =>
  api.get(`/api/device/points/${tuUuid}/hierarchy`).then((r) => r.data);

export const getGvsQuality = (params) =>
  api.get("/api/analytics/gvs-quality", { params }).then((r) => r.data);

export const getDashboard = () => api.get("/api/dashboard").then((r) => r.data);

export const clearDeviceData = () => api.delete("/api/device/data").then((r) => r.data);

export default api;
