import K2Connect from 'k2-connect-node';
import dotenv from 'dotenv';

dotenv.config();

const options = {
  clientId: process.env.K2_CLIENT_ID || '',
  clientSecret: process.env.K2_CLIENT_SECRET || '',
  baseUrl: process.env.K2_BASE_URL || 'https://kopokopo.com',
  apiKey: process.env.K2_API_KEY || ''
};

const K2 = K2Connect(options);

export const TokenService = K2.TokenService;
export const StkService = K2.StkService;
export const WebhooksService = K2.WebhooksService;
