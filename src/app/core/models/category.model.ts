/**
 * Gender Enum for Category Filtering
 */
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  OPEN = 'OPEN',
}

export interface Category {
  id: number;
  categoryName: string;
  description?: string;
  raceId: number;
  eventId: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface CreateCategoryRequest {
  categoryName: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  categoryName?: string;
  description?: string;
}
