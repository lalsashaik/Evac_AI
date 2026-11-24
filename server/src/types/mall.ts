export interface MallInfo {
  mallId: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPerson?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  isActive: boolean;
  totalFloors?: number;
  managementUid?: string | null;
  managementEmail?: string | null;
  managementName?: string | null;
}

export interface CreateMallDto {
  mallId?: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPerson?: string;
  totalFloors?: number;
}

export interface UpdateMallDto {
  name?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPerson?: string;
  isActive?: boolean;
  totalFloors?: number;
}

export interface CreateManagementAccountDto {
  email: string;
  password?: string;
  temporaryPassword?: string;
  displayName: string;
  mallId: string;
}

export interface PlatformStats {
  totalMalls: number;
  activeMalls: number;
  totalManagementAccounts: number;
}
