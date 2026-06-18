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
