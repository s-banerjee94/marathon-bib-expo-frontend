import { CanDeactivateFn } from '@angular/router';
import type { ImportMapper } from './import-mapper';

/**
 * Confirms before navigating away from the import mapper while an uploaded
 * file / in-progress mapping would be lost (the component shows a PrimeNG
 * confirm dialog). Leaving is free before an upload or after launching.
 */
export const unsavedMappingGuard: CanDeactivateFn<ImportMapper> = (component) =>
  component.canLeave();
