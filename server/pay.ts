// src/services/mpesa.service.ts
import fetch from 'node-fetch';
import { storage } from './storage';
import nodemailer from 'nodemailer';

const ENV = process.env.NODE_ENV || 'development';

const AUTH_URL =
  ENV === 'development'
    ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : '';

const STK_URL =
  ENV === 'development'
    ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : '';

/* ===================== TYPES ===================== */

export interface StkPushPayload {
  amount: number;
  phone: string;
}

export interface MpesaAccessTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/* ===================== HELPERS ===================== */

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

const getTimestamp = (): string => {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
};

/* ===================== AUTH ===================== */

export const getMpesaAccessToken = async (): Promise<string> => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY!;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials missing');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const response = await fetch(AUTH_URL, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Auth failed: ${error}`);
  }

  const data = (await response.json()) as MpesaAccessTokenResponse;
  return data.access_token;
};

/* ===================== STK PUSH ===================== */

export const initiateStkPush = async (
  payload: StkPushPayload
): Promise<StkPushResponse> => {
  const { amount, phone } = payload;

  if (!amount || !phone) {
    throw new Error('Amount or phone missing');
  }

  const accessToken = await getMpesaAccessToken();
  const timestamp = getTimestamp();

  const businessShortCode = process.env.MPESA_SHORTCODE || '174379';
  const passkey = process.env.MPESA_PASSKEY!;
  const callbackUrl = process.env.MPESA_CALLBACK_URL!;

  if (!passkey || !callbackUrl) {
    throw new Error('Passkey or callback URL missing');
  }

  const password = Buffer.from(
    `${businessShortCode}${passkey}${timestamp}`
  ).toString('base64');

  const requestBody = {
    BusinessShortCode: businessShortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: businessShortCode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: 'Test Payment',
    TransactionDesc: 'Payment for services',
  };

  const response = await fetch(STK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`STK Push failed: ${error}`);
  }

  return (await response.json()) as StkPushResponse;
};

export const pay = async (data: any) => {
    try {
        const { amount, phone } = data;

        const stkResponse = await initiateStkPush({ amount, phone });

        if (stkResponse.ResponseCode === '0') {
        return {
            success: true,
            message: 'STK push initiated successfully',
            data: stkResponse,
        };
        }

        return {
        success: false,
        message: `Payment failed with code ${stkResponse.ResponseCode}`,
        data: stkResponse,
        };
    } catch (error: any) {
        console.error('M-Pesa Error:', error.message);

        return {
        success: false,
        message: 'Internal server error',
        error: error.message,
        };
    }
};



export async function send_invoice_email(order: { id: number; createdAt: Date | null; status: string; userId: number; total: string; items: unknown; }) {
  try {
    const user = await storage.getUser(order.userId);
    if (!user?.email) return;

    const emailContent = `
      Order #${order.id}
      Total: $${order.total}
      Status: ${order.status}
      Date: ${order.createdAt?.toLocaleDateString()}
      Items: ${JSON.stringify(order.items, null, 2)}
    `;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || '',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
      },
    } as any);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Order Invoice',
      text: emailContent,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Sent invoice to ${user.email}: ${info.response}`);
    } catch (err) {
      console.error(`Failed to send invoice to ${user.email}:`, err);
    }
  } catch (err) {
    console.error("Failed to send invoice email:", err);
  }
}
