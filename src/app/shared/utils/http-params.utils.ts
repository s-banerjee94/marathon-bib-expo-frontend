import { HttpParams } from '@angular/common/http';
import { PageableParams } from '../../core/models/api.model';

/**
 * Build HttpParams from PageableParams.
 * Centralizes the repeated pattern across services.
 */
export function buildHttpParams(params: PageableParams): HttpParams {
  let httpParams = new HttpParams();

  if (params.page !== undefined) {
    httpParams = httpParams.set('page', params.page.toString());
  }
  if (params.size !== undefined) {
    httpParams = httpParams.set('size', params.size.toString());
  }
  if (params.search) {
    httpParams = httpParams.set('search', params.search);
  }
  if (params.sort && params.sort.length > 0) {
    params.sort.forEach((sortParam) => {
      httpParams = httpParams.append('sort', sortParam);
    });
  }
  if (params.status) {
    httpParams = httpParams.set('status', params.status);
  }
  if (params.organizationId !== undefined) {
    httpParams = httpParams.set('organizationId', params.organizationId.toString());
  }
  if (params.enabled !== undefined) {
    httpParams = httpParams.set('enabled', params.enabled.toString());
  }
  if (params.deleted !== undefined) {
    httpParams = httpParams.set('deleted', params.deleted.toString());
  }
  if (params.role) {
    httpParams = httpParams.set('role', params.role);
  }
  if (params.subscriptionTier) {
    httpParams = httpParams.set('subscriptionTier', params.subscriptionTier);
  }
  if (params.includeDeleted !== undefined) {
    httpParams = httpParams.set('includeDeleted', params.includeDeleted.toString());
  }

  return httpParams;
}
