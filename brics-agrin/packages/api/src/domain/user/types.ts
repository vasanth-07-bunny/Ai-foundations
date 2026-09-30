/**
 * Internal domain types for User and Auth context.
 */

import type { UserRole } from '@prisma/client';
import type { SupportedCountry, SupportedLanguage } from '@brics-agrin/shared';

export interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
}

export interface FarmerProfileRecord {
  id: string;
  userId: string;
  country: SupportedCountry;
  language: SupportedLanguage;
  farmCategory: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContext {
  userId: string;
  role: UserRole;
  farmerProfileId: string | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  language: SupportedLanguage;
  country: SupportedCountry;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
