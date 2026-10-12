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
        if (error.status === 0) {
          console.error('API network or connection error:', error.message);
        } else if (error.status >= 500) {
          console.error(`API server error (${error.status}):`, error.message);
        }
      }

      return throwError(() => error);
    }),
  );
};