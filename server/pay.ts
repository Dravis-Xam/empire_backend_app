// src/services/mpesa.service.ts
import { storage } from './storage';
import nodemailer from 'nodemailer';
import { TokenService, StkService } from './k2-connect';

/* ===================== TYPES ===================== */

export interface StkPushPayload {
  userid: number,
  amount: number;
  phone: string;
}

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

export const getKopoKopoToken = async(): Promise<KopoKopoTokenResponse> => {
  return TokenService
        .getToken()
        .then((response: any) => response.data as KopoKopoTokenResponse)
        .catch((error: any) => {
            console.log(error);
            throw new Error('Failed to get KopoKopo token');
        })
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

export const initiateStkPush = async (
  payload: StkPushPayload
): Promise<StkPushResponse> => {
  const accessToken = await getKopoKopoToken();
  const startTime = new Date(accessToken?.created_at);
  const timeout = new Date(accessToken?.expires_in);
  const currentTime = new Date();

  while (currentTime.getTime() > timeout.getTime()) {
    console.log('Access token expired, fetching new token...');
    const newTokenResponse = await getKopoKopoToken();
    accessToken.access_token = newTokenResponse.access_token;
    accessToken.created_at = newTokenResponse.created_at;
    accessToken.expires_in = newTokenResponse.expires_in;

    // Update times
    startTime.setTime(Date.parse(accessToken.created_at));
    timeout.setTime(startTime.getTime() + accessToken.expires_in * 1000);

    await storage.createNotification({
      userId: payload.userid,
      message: `Your previous payment token expired. Try a little faster this time 😉`
    });
  }

  const user = await storage.getUser(payload.userid)

  // 2. Trigger M-Pesa STK Push
  const locationUrl = await StkService.initiateStkPush({
    paymentChannel: 'M-PESA',
    tillNumber: process.env.K2_TILL_NUMBER || '',
    firstName: user?.name?.split(" ")[0] || 'Customer',
    lastName: user?.name?.split(" ")[1] || 'User',
    phoneNumber: payload.phone, // E.g., +254700000000
    amount: payload.amount,
    email: user?.email || 'customer@example.com',
    callbackUrl: process.env.K2_CALLBACK_URL || '',
    accessToken: accessToken
  });

  // K2 returns a Location header URL to track request status
  return Promise.resolve({
    success: true,
    message: 'Payment initiation successful',
    checkoutUrl: locationUrl
  });
};

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

export const pay = async (data: any) => {
  try {
    const { amount, phone, userid, orderId } = data;

        const stkResponse = await initiateStkPush({ userid, amount, phone });
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
