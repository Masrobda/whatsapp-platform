// lib/api/templates.ts
import apiClient from '@/lib/api';   // ← ou '../api' si tu préfères relatif

export const templatesAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
  }) => {
    const response = await apiClient.get('/templates', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/templates/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await apiClient.post('/templates', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await apiClient.put(`/templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/templates/${id}`);
    return response.data;
  },

  submitToMeta: async (id: string) => {
    const response = await apiClient.post(`/templates/${id}/submit`);
    return response.data;
  },

  refreshStatus: async (id: string) => {
    const response = await apiClient.post(`/templates/${id}/refresh`);
    return response.data;
  },

  duplicate: async (id: string) => {
    const response = await apiClient.post(`/templates/${id}/duplicate`);
    return response.data;
  },

  preview: async (id: string, variables: any) => {
    const response = await apiClient.post(`/templates/${id}/preview`, { variables });
    return response.data;
  }
};
