import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { isDevMode } from '@angular/core';
import { catchError, throwError } from 'rxjs';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (isDevMode()) {
        switch (error.status) {
          case 0:
            console.error(
              'API network or connection error:',
              error.message,
            );
            break;

          case 401: 
            console.warn(
              'API authentication required (401):',
              request.url,
            );
            break;

          case 403: 
            console.warn(
              'API access forbidden (403):',
              request.url,
            );
            break;
          
          default:
            if (error.status >= 500) {
              console.error(
                `API server error (${error.status}):`,
                error.message,
              );
            }
            break;
        }
      }

      return throwError(() => error);
    }),
  );
};