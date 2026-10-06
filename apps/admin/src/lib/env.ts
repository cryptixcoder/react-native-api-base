import 'server-only';

/** Base URL of the Express API, including /api/v1. Server-side only: the browser never calls the API directly. */
export const API_URL = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export const isProduction = process.env.NODE_ENV === 'production';
