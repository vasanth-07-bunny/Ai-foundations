/**
 * Typed API functions.
 * All API calls go through this module — never call apiClient directly from components.
 */

import { apiClient } from './client.js';
import type {
  Farm, Field, CropCycle, Advisory, DiagnosticResult,
  FarmerProfile, AuthTokens, UserPublic, PaginatedResponse,
} from '@brics-agrin/shared';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { email: string; password: string; language: string; country: string }) =>
    apiClient.post<{ data: { user: UserPublic; tokens: AuthTokens } }>('/auth/register', body),

  login: (body: { email: string; password: string }) =>
    apiClient.post<{ data: { user: UserPublic; tokens: AuthTokens } }>('/auth/login', body),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),
};

// ── Profile ───────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () =>
    apiClient.get<{ data: FarmerProfile }>('/profile'),

  update: (body: Partial<FarmerProfile>) =>
    apiClient.patch<{ data: FarmerProfile }>('/profile', body),
};

// ── Farms ─────────────────────────────────────────────────────────────────────

export const farmApi = {
  list: (page = 1, pageSize = 20) =>
    apiClient.get<{ data: PaginatedResponse<Farm> }>(`/farms?page=${page}&pageSize=${pageSize}`),

  get: (farmId: string) =>
    apiClient.get<{ data: Farm }>(`/farms/${farmId}`),

  create: (body: Partial<Farm>) =>
    apiClient.post<{ data: Farm }>('/farms', body),

  update: (farmId: string, body: Partial<Farm>) =>
    apiClient.patch<{ data: Farm }>(`/farms/${farmId}`, body),

  delete: (farmId: string) =>
    apiClient.delete(`/farms/${farmId}`),

  listFields: (farmId: string) =>
    apiClient.get<{ data: Field[] }>(`/farms/${farmId}/fields`),

  createField: (farmId: string, body: Partial<Field>) =>
    apiClient.post<{ data: Field }>(`/farms/${farmId}/fields`, body),
};

// ── Crop Cycles ───────────────────────────────────────────────────────────────

export const cropCycleApi = {
  getActive: (fieldId: string) =>
    apiClient.get<{ data: CropCycle | null }>(`/fields/${fieldId}/crop-cycles/active`),

  create: (fieldId: string, body: Partial<CropCycle>) =>
    apiClient.post<{ data: CropCycle }>(`/fields/${fieldId}/crop-cycles`, body),

  updateStage: (fieldId: string, cycleId: string, growthStage: string) =>
    apiClient.patch<{ data: CropCycle }>(
      `/fields/${fieldId}/crop-cycles/${cycleId}/stage`,
      { growthStage },
    ),
};

// ── Advisories ────────────────────────────────────────────────────────────────

export const advisoryApi = {
  generate: (body: { farmId: string; cropCycleId?: string; language: string }) =>
    apiClient.post<{ data: Advisory | null }>('/advisories/generate', body),

  list: (farmId: string, page = 1, pageSize = 20) =>
    apiClient.get<{ data: PaginatedResponse<Advisory> }>(
      `/advisories?farmId=${farmId}&page=${page}&pageSize=${pageSize}`,
    ),

  get: (id: string) =>
    apiClient.get<{ data: Advisory }>(`/advisories/${id}`),
};

// ── Diagnostics ───────────────────────────────────────────────────────────────

export const diagnosticApi = {
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiClient.post<{ data: { imageId: string; widthPx: number; heightPx: number } }>(
      '/diagnostics/images',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  submit: (body: {
    farmId: string;
    cropName: string;
    growthStage: string;
    imageId: string;
    notes?: string;
  }) =>
    apiClient.post<{ data: DiagnosticResult }>('/diagnostics', body),

  get: (id: string) =>
    apiClient.get<{ data: DiagnosticResult }>(`/diagnostics/${id}`),

  list: (farmId: string, page = 1, pageSize = 20) =>
    apiClient.get<{ data: PaginatedResponse<DiagnosticResult> }>(
      `/diagnostics?farmId=${farmId}&page=${page}&pageSize=${pageSize}`,
    ),
};
