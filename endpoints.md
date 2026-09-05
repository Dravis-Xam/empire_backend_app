# E-commerce Backend API Documentation

## Overview
This is a high-performance backend for an e-commerce platform dealing with phones, laptops, and accessories. It features custom local authentication, role-based access control, and real-time-ready notification systems.

### Roles
- `admin`: Full system access.
- `customer_care`: Order processing and notifications.
- `delivery_crew`: Delivery status tracking.
- `stock_manager`: Inventory management and reporting.
- `client`: End-user shopping experience.

---
## Health route
`GET /api/health`
- **Response**: `we are doing okay`

## Authentication Endpoints

### Register
`POST /api/register`
- **Body**: `{ username, password, role, name, email }`
- **Response**: `201 Created` with User object.

### Login via email
`POST /api/login`
- **Body**: `{ username, password }`
- **Response**: `200 OK` with User object and session cookie.

### Login via google
`GET /api/auth/google`
- **Response**: `200 OK` with User object and session cookie

### Login via facebook
`GET /api/auth/facebook`
- **Response**: `200 OK` with User object and session cookie

### Logout
`POST /api/logout`
- **Response**: `200 OK`

### Current User
`GET /api/user`
- **Response**: `200 OK` with current authenticated User object.

---

## Product Endpoints

### List Products
`GET /api/products`
- **Response**: `200 OK` - Array of all devices/accessories.

### Get Products by their barcode
 `GET /api/barcode/fetch-item`
 - **Response**: `200 OK` - That Device with barcode provided.

### Create Product
`POST /api/products` (Requires Auth)
- **Body**: `{ name, description, price, category, stock, imageUrl }`
- **Response**: `201 Created`

### Update Product
`PATCH /api/products/:id` (Requires Auth)
- **Body**: Partial product object.
- **Response**: `200 OK`

### Delete Product
`DELETE /api/products/:id` (Requires Auth)
- **Response**: `204 No Content`

---

## Order Endpoints

### List Orders
`GET /api/orders` (Requires Auth)
- **Response**: `200 OK` - List of all orders.

### Create Order
`POST /api/orders`
- **Body**: `{ userId, total, items: [{ productId, quantity, price }] }`
- **Response**: `201 Created`

### Update Order Status
`PATCH /api/orders/:id/status` (Requires Auth)
- **Body**: `{ status: "processing" | "shipped" | "delivered" | "cancelled" }`
- **Response**: `200 OK`

## Kopo Kopo Payments

### Start Payment
Payments are initiated while creating an order:
`POST /api/orders` (Requires Auth)

- **Body fields**: include `amount` and `phone` alongside the order fields.
- **Phone formats**: `07XXXXXXXX`, `2547XXXXXXXX`, or `+2547XXXXXXXX`.
- **Response**: `201 Created` with `{ order, payment }`.
- **Payment response**: includes `success`, `message`, and `checkoutUrl`.

The payment uses Kopo Kopo's `M-PESA STK Push` channel and stores the order ID in provider metadata.

### Payment Callback
`POST /api/callbacks/mpesa`

Kopo Kopo calls this endpoint after payment processing. The endpoint accepts nested Kopo Kopo callback payloads, updates the matching payment, and only creates a delivery for a confirmed successful payment.

When `K2_VERIFY_CALLBACK_SIGNATURE=true`, the request must include the `X-kopokopo-signature` HMAC-SHA256 header generated with `K2_API_KEY`.

---

## Delivery Endpoints

### List Deliveries
`GET /api/deliveries` (Requires Auth)
- **Response**: `200 OK` - List of all delivery tracking info.

### Update Delivery
`PATCH /api/deliveries/:id` (Requires Auth)
- **Body**: `{ assignedCrewId, status, trackingInfo }`
- **Response**: `200 OK`

---

## Notification Endpoints

### List My Notifications
`GET /api/notifications` (Requires Auth)
- **Response**: `200 OK` - List of notifications for the logged-in user.

---

## Database Schema
The system uses PostgreSQL with the following tables:
- `users`: Authentication and profile data.
- `products`: Device and accessory inventory.
- `orders`: Transactional data.
- `deliveries`: Logistics and tracking.
- `notifications`: User alerts.
