/**
 * Pageable response from API with pagination metadata
 */
export interface PageableResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasContent: boolean;
  empty: boolean;
  numberOfElements: number;
}

/**
 * Parameters for paginated API requests
 */
export interface PageableParams {
  page?: number;
  size?: number;
  sort?: string[];
  search?: string;
  enabled?: boolean;
  deleted?: boolean;
}
