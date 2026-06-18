import * as Sentry from '@sentry/node';

export function captureError(err: unknown) {
  try {
    if ((Sentry as any).captureException) {
      (Sentry as any).captureException(err);
    } else {
      console.error('Error:', err);
    }
  } catch (e) {
    console.error('Failed to send error to Sentry:', e, 'original:', err);
  }
}

export default captureError;

export function wrapAsync(fn: (...args: any[]) => Promise<any>) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function addBreadcrumb(message: string, data?: Record<string, any>) {
  try {
    if ((Sentry as any).addBreadcrumb) {
      (Sentry as any).addBreadcrumb({ message, data: data || {}, level: 'info' as any });
    }
  } catch (e) {
    // fail silently
  }
}
