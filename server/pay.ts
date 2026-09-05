// src/services/mpesa.service.ts
import { storage } from './storage';
import nodemailer from 'nodemailer';
import { TokenService, StkService } from './k2-connect';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCachedValue, setCachedValue, withRedisLock } from './redis';

/* ===================== TYPES ===================== */

export interface StkPushPayload {
  userid: number,
  amount: number;
  phone: string;
  orderId?: number;
}

let cachedToken: { value: string; expiresAt: number } | undefined;
let tokenRequest: Promise<KopoKopoTokenResponse> | undefined;

export interface KopoKopoTokenResponse {
  access_token: string,
  token_type: string,
  expires_in: number,
  created_at: string
}

export interface StkPushResponse {
    success: boolean,
    message: string,
    checkoutUrl: string | null,
}

/* ===================== AUTH ===================== */

/** Return a cached or freshly issued Kopo Kopo OAuth token. */
export const getKopoKopoToken = async(): Promise<KopoKopoTokenResponse> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return {
      access_token: cachedToken.value,
      token_type: 'Bearer',
      expires_in: Math.floor((cachedToken.expiresAt - Date.now()) / 1000),
      created_at: new Date(cachedToken.expiresAt - 300_000).toISOString(),
    };
  }

  if (!tokenRequest) {
    tokenRequest = withRedisLock('kopokopo:oauth:lock', async () => {
      const sharedToken = await getCachedValue<KopoKopoTokenResponse>('kopokopo:oauth:token');
      if (sharedToken?.access_token) {
        cachedToken = {
          value: sharedToken.access_token,
          expiresAt: Date.now() + sharedToken.expires_in * 1000,
        };
        return sharedToken;
      }

      try {
        const response: any = await TokenService.getToken();
        const payload = response?.data ?? response;
        const token = typeof payload === 'string' ? payload : payload?.access_token;
        if (!token) throw new Error('Kopo Kopo did not return an access token');

        const expiresIn = Number(payload?.expires_in ?? 300);
        const tokenResponse = {
          access_token: token,
          token_type: payload?.token_type ?? 'Bearer',
          expires_in: expiresIn,
          created_at: payload?.created_at ?? new Date().toISOString(),
        };
        cachedToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
        await setCachedValue('kopokopo:oauth:token', tokenResponse, expiresIn - 30);
        return tokenResponse;
      } catch (error) {
        console.error('Failed to get Kopo Kopo token:', error);
        throw new Error('Failed to get Kopo Kopo token');
      }
    });
  }

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = undefined;
  }
}

// export const getMpesaAccessToken = async (): Promise<string> => {
//   const consumerKey = process.env.MPESA_CONSUMER_KEY!;
//   const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;

//   if (!consumerKey || !consumerSecret) {
//     throw new Error('M-Pesa credentials missing');
//   }

//   const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

//   const response = await fetch(AUTH_URL, {
//     headers: {
//       Authorization: `Basic ${auth}`,
//     },
//   });

//   if (!response.ok) {
//     const error = await response.text();
//     throw new Error(`Auth failed: ${error}`);
//   }

//   const data = (await response.json()) as MpesaAccessTokenResponse;
//   return data.access_token;
// };

/* ===================== STK PUSH ===================== */

/** Initiate an incoming Kopo Kopo M-Pesa STK Push for an order. */
export const initiateStkPush = async (
  payload: StkPushPayload
): Promise<StkPushResponse> => {
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const phone = normalizePhone(payload.phone);
  const accessToken = await getKopoKopoToken();

  const user = await storage.getUser(payload.userid);

  const locationUrl = await StkService.initiateIncomingPayment({
    paymentChannel: 'M-PESA STK Push',
    tillNumber: process.env.K2_TILL_NUMBER || '',
    firstName: user?.name?.split(" ")[0] || 'Customer',
    lastName: user?.name?.split(" ").slice(1).join(' ') || 'User',
    phoneNumber: phone,
    amount: payload.amount,
    email: user?.email || 'customer@example.com',
    currency: 'KES',
    metadata: { orderId: payload.orderId },
    callbackUrl: process.env.K2_CALLBACK_URL || '',
    accessToken: accessToken
  });

  if (typeof locationUrl !== 'string' || !locationUrl) {
    throw new Error('Kopo Kopo did not return a payment location');
  }

  return Promise.resolve({
    success: true,
    message: 'Payment initiation successful',
    checkoutUrl: locationUrl
  });
};

/** Normalize supported Kenyan M-Pesa phone formats to the 254XXXXXXXXX format. */
function normalizePhone(phone: string): string {
  const compact = phone.replace(/[\s-]/g, '');
  if (/^07\d{8}$/.test(compact)) return `254${compact.slice(1)}`;
  if (/^\+2547\d{8}$/.test(compact)) return compact.slice(1);
  if (/^2547\d{8}$/.test(compact)) return compact;
  throw new Error('Phone must be a valid Kenyan M-Pesa number');
}

/** Convert a Kopo Kopo callback status to the application's payment status. */
export function getPaymentCallbackStatus(body: any): 'completed' | 'failed' | 'initiated' {
  const status = String(
    body?.data?.attributes?.status ?? body?.event?.resource?.status ?? body?.status ?? ''
  ).toLowerCase();
  if (['success', 'successful', 'completed', 'complete'].includes(status)) return 'completed';
  if (['failed', 'failure', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return 'initiated';
}

/** Extract the order ID stored in Kopo Kopo callback metadata. */
export function getPaymentCallbackOrderId(body: any): number | undefined {
  const metadata = body?.data?.attributes?.metadata ?? body?.metadata ?? {};
  const value = metadata.orderId ?? metadata.order_id ?? body?.orderId ?? body?.order_id;
  const orderId = Number(value);
  return Number.isInteger(orderId) && orderId > 0 ? orderId : undefined;
}

/** Validate a Kopo Kopo callback signature when signature verification is enabled. */
export function isValidKopoKopoCallback(body: unknown, signature: string | undefined, rawBody?: Buffer): boolean {
  if (process.env.K2_VERIFY_CALLBACK_SIGNATURE !== 'true') return true;
  if (!signature || !process.env.K2_API_KEY) return false;
  const content = rawBody ?? Buffer.from(JSON.stringify(body));
  const expected = createHmac('sha256', process.env.K2_API_KEY).update(content).digest('hex');
  const provided = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}

// export const initiateStkPush = async (
//   payload: StkPushPayload
// ): Promise<StkPushResponse> => {
//   const { amount, phone } = payload;

//   if (!amount || !phone) {
//     throw new Error('Amount or phone missing');
//   }

//   const accessToken = await getMpesaAccessToken();
//   const timestamp = getTimestamp();

//   const businessShortCode = process.env.MPESA_SHORTCODE || '174379';
//   const passkey = process.env.MPESA_PASSKEY!;
//   const callbackUrl = process.env.MPESA_CALLBACK_URL!;

//   if (!passkey || !callbackUrl) {
//     throw new Error('Passkey or callback URL missing');
//   }

//   const password = Buffer.from(
//     `${businessShortCode}${passkey}${timestamp}`
//   ).toString('base64');

//   const requestBody = {
//     BusinessShortCode: businessShortCode,
//     Password: password,
//     Timestamp: timestamp,
//     TransactionType: 'CustomerPayBillOnline',
//     Amount: amount,
//     PartyA: phone,
//     PartyB: businessShortCode,
//     PhoneNumber: phone,
//     CallBackURL: callbackUrl,
//     AccountReference: 'Test Payment',
//     TransactionDesc: 'Payment for services',
//   };

//   const response = await fetch(STK_URL, {
//     method: 'POST',
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(requestBody),
//   });

//   if (!response.ok) {
//     const error = await response.text();
//     throw new Error(`STK Push failed: ${error}`);
//   }

//   return (await response.json()) as StkPushResponse;
// };

/** Start payment, persist its initiation result, and notify the customer. */
export const pay = async (data: any) => {
  try {
    const { amount, phone, userid, orderId } = data;

        const stkResponse = await initiateStkPush({ userid, amount, phone, orderId });
        try {
          const { addBreadcrumb } = await import('./error');
          addBreadcrumb('Initiated STK push', { userid, amount, phone });
        } catch {}

    // persist a payment record
    try {
      await storage.createPayment({
      orderId: orderId,
      userId: userid,
      amount: String(amount),
      method: 'stk_push',
      status: stkResponse.success ? 'initiated' : 'failed',
      checkoutUrl: stkResponse.checkoutUrl || null,
      providerResponse: { message: stkResponse.message }
      });
    } catch (err) {
      console.error('Failed to persist payment:', err);
    }

    if (stkResponse.success) {
      await storage.createNotification({
        userId: userid,
        message: `Your payment of KES ${amount} has been initiated. Please complete the payment on your phone.`
      });
      try {
        const { addBreadcrumb } = await import('./error');
        addBreadcrumb('STK push succeeded', { checkoutUrl: stkResponse.checkoutUrl });
      } catch {}
    } else {
      await storage.createNotification({
        userId: userid,
        message: `Payment initiation failed: ${stkResponse.message}`
      });
      try {
        const { addBreadcrumb } = await import('./error');
        addBreadcrumb('STK push failed', { message: stkResponse.message });
      } catch {}
    }

    return stkResponse;
  } catch (error: any) {
    console.error('M-Pesa Error:', error.message);
    try {
      const capture = await import('./error').then(m => m.default).catch(() => null);
      if (capture) capture(error);
    } catch {}
    await storage.createNotification({
      userId: data.userid,
      message: `Payment initiation failed: ${error.message}`
    });
    return {
    success: false,
    message: 'Internal server error',
    error: error.message,
    };
  }
};



/** Send an order invoice when the customer has an email address. */
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
      storage.createNotification({
        userId: user.id,
        message: `Hey ${user.name}, your order has been processed and the invoice has been sent to your  email: ${user.email} . For any inquiries or complaints, call us or sms to <a href="0711489056">0711489056</a>`        
      })
      console.log(`Sent invoice to ${user.email}: ${info.response}`);
    } catch (err) {
      console.error(`Failed to send invoice to ${user.email}:`, err);
    }
  } catch (err) {
    console.error("Failed to send invoice email:", err);
  }
}
