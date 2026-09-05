# Empire Backend App

E-commerce backend for products, orders, deliveries, notifications, and Kopo Kopo M-Pesa payments.

## Setup

```bash
npm install
npm run check
npm run dev
```

The application requires PostgreSQL through `DATABASE_URL`. Configure Kopo Kopo with:

```env
K2_CLIENT_ID=your-client-id
K2_CLIENT_SECRET=your-client-secret
K2_API_KEY=your-api-key
K2_BASE_URL=https://sandbox.kopokopo.com
K2_TILL_NUMBER=your-till-number
K2_CALLBACK_URL=https://your-domain.example/api/callbacks/mpesa
```

Optional Redis support:

```env
REDIS_URL=redis://localhost:6379
K2_VERIFY_CALLBACK_SIGNATURE=true
```

Without `REDIS_URL`, token caching still works in-process. With Redis, instances share the OAuth token and use a distributed lock so concurrent requests do not fetch duplicate tokens.

## Payment Flow

1. Create an order with `amount` and `phone` in the request body.
2. The server starts a Kopo Kopo M-Pesa STK Push and stores an `initiated` payment record.
3. Kopo Kopo posts the result to `POST /api/callbacks/mpesa`.
4. A successful callback marks the payment completed, moves the order to `processing`, and creates a delivery.

See [KOPO_KOPO.md](KOPO_KOPO.md) for provider payloads and [endpoints.md](endpoints.md) for the full API reference.

## Commands

- `npm run dev`: start the development server.
- `npm run check`: run TypeScript validation.
- `npm run build`: build the client and server.
- `npm run db:push`: apply the Drizzle schema to PostgreSQL.