import { HttpInterceptorFn } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';

// IP de tu PC en la red local (la misma de tu allowedHosts)
export const API_URL = 'http://192.168.100.25:4000';

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (Capacitor.isNativePlatform() && req.url.startsWith('/api')) {
    return next(req.clone({ url: API_URL + req.url }));
  }
  return next(req);
};