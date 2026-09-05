# Empire Backend App

E-commerce backend and React dashboard for products, orders, deliveries, notifications, and Kopo Kopo M-Pesa payments.

## Requirements

- Node.js 20 or newer
- PostgreSQL
- Kopo Kopo credentials for payment flows
- Redis is optional; it enables shared token caching across server instances

## Setup

```bash
npm install
```

Create a `.env` file and set at least `DATABASE_URL` before starting the server. The application fails during startup when this variable is missing.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/empire
SESSION_SECRET=replace-with-a-long-random-value

K2_CLIENT_ID=your-client-id
K2_CLIENT_SECRET=your-client-secret
K2_API_KEY=your-api-key
K2_BASE_URL=https://sandbox.kopokopo.com
K2_TILL_NUMBER=your-till-number
K2_CALLBACK_URL=https://your-domain.example/api/callbacks/mpesa
```

`K2_BASE_URL` defaults to `https://kopokopo.com` in the application. Use the sandbox URL above for development and testing. `K2_API_KEY` is required when callback signature verification is enabled:

```env
K2_VERIFY_CALLBACK_SIGNATURE=true
REDIS_URL=redis://localhost:6379
```

Redis is optional. Without `REDIS_URL`, token caching and concurrency control remain in-process. With Redis, instances share the OAuth token and coordinate token refreshes.

Apply the database schema after PostgreSQL is available:

```bash
npm run db:push
```

## Development and production

```bash
npm run check   # TypeScript validation
npm test        # API and contract tests
npm run dev     # Development server on http://localhost:5000
```

Create a production build and run it with:

```bash
npm run build
npm start
```

The server uses `PORT` when provided and otherwise listens on `5000`.

## Payment Flow

1. Create an order with `amount` and `phone` in the request body.
2. The server starts a Kopo Kopo M-Pesa STK Push and stores an `initiated` payment record.
3. Kopo Kopo posts the result to `POST /api/callbacks/mpesa`.
4. A successful callback marks the payment completed, moves the order to `processing`, and creates a delivery.

See [KOPO_KOPO.md](KOPO_KOPO.md) for provider payloads and [endpoints.md](endpoints.md) for the full API reference. The health check is available at `GET /api/health`.

## Commands

- `npm run dev`: start the development server.
- `npm run check`: run TypeScript validation.
- `npm test`: run the API and contract tests.
- `npm run build`: build the client and server.
- `npm run db:push`: apply the Drizzle schema to PostgreSQL.

## Troubleshooting

- `DATABASE_URL must be set`: create `.env` and set a reachable PostgreSQL connection string.
- Database connection errors: confirm PostgreSQL is running and run `npm run db:push`.
- Payment callback failures: use a public `K2_CALLBACK_URL`; local callbacks need a tunnel such as Cloudflare Tunnel or ngrok.
- OAuth callback issues: set the provider callback URLs and `FRONTEND_URI`/`LIVE_FRONTEND_URI` to the deployed frontend origins.