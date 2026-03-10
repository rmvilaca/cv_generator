# Token Shop

A Rails 8 API-only application with JWT-based authentication.

## Setup

```bash
bundle install
rails db:migrate
rails server
```

The server runs at `http://localhost:3000` by default.

## Authentication

This API uses **Devise** with **JWT** tokens for authentication. After signing up or logging in, the server returns a JWT token in the `Authorization` header. Include this token in subsequent requests to access protected endpoints.

**Token format:** `Bearer <token>`

**Token expiration:** 24 hours

---

## API Endpoints

### Health Check

#### `GET /api/health`

Returns the API health status. No authentication required.

**Response:**

```json
{
  "status": "ok"
}
```

**Status:** `200 OK`

---

### Sign Up

#### `POST /api/signup`

Create a new user account. Returns user data and a JWT token in the `Authorization` response header.

**Request body:**

```json
{
  "user": {
    "email": "user@example.com",
    "password": "password123",
    "password_confirmation": "password123"
  }
}
```

**Success response (`200 OK`):**

```json
{
  "status": {
    "code": 200,
    "message": "Signed up successfully."
  },
  "data": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-02-09T20:30:00.000Z"
  }
}
```

**Error response (`422 Unprocessable Entity`):**

```json
{
  "status": {
    "code": 422,
    "message": "User could not be created.",
    "errors": [
      "Email has already been taken"
    ]
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"user": {"email": "user@example.com", "password": "password123", "password_confirmation": "password123"}}' \
  -v
```

> The `Authorization` header in the response contains the JWT token.

---

### Log In

#### `POST /api/login`

Authenticate an existing user. Returns user data and a JWT token in the `Authorization` response header.

**Request body:**

```json
{
  "user": {
    "email": "user@example.com",
    "password": "password123"
  }
}
```

**Success response (`200 OK`):**

```json
{
  "status": {
    "code": 200,
    "message": "Logged in successfully."
  },
  "data": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-02-09T20:30:00.000Z"
  }
}
```

**Error response (`401 Unauthorized`):**

```json
{
  "error": "Invalid Email or password."
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": {"email": "user@example.com", "password": "password123"}}' \
  -v
```

> Save the `Authorization` header value from the response to use in authenticated requests.

---

### Log Out

#### `DELETE /api/logout`

Revoke the current JWT token. Requires authentication.

**Headers:**

| Header          | Value            |
|-----------------|------------------|
| `Authorization` | `Bearer <token>` |

**Success response (`200 OK`):**

```json
{
  "status": {
    "code": 200,
    "message": "Logged out successfully."
  }
}
```

**Error response (`401 Unauthorized`):**

```json
{
  "status": {
    "code": 401,
    "message": "Couldn't find an active session."
  }
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/logout \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

### Current User

#### `GET /api/me`

Get the currently authenticated user's profile. Requires authentication.

**Headers:**

| Header          | Value            |
|-----------------|------------------|
| `Authorization` | `Bearer <token>` |

**Success response (`200 OK`):**

```json
{
  "status": {
    "code": 200,
    "message": "User found."
  },
  "data": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-02-09T20:30:00.000Z"
  }
}
```

**Error response (`401 Unauthorized`):** Returned when no valid token is provided.

**Example:**

```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

### Update Account

#### `PATCH /api/signup`

Update the current user's account (email or password). Requires authentication.

**Headers:**

| Header          | Value              |
|-----------------|--------------------|
| `Authorization` | `Bearer <token>`   |
| `Content-Type`  | `application/json` |

**Request body (change password):**

```json
{
  "user": {
    "password": "newpassword123",
    "password_confirmation": "newpassword123",
    "current_password": "password123"
  }
}
```

**Request body (change email):**

```json
{
  "user": {
    "email": "newemail@example.com",
    "current_password": "password123"
  }
}
```

**Success response (`200 OK`):**

```json
{
  "status": {
    "code": 200,
    "message": "Signed up successfully."
  },
  "data": {
    "id": 1,
    "email": "newemail@example.com",
    "created_at": "2026-02-09T20:30:00.000Z"
  }
}
```

**Error response (`422 Unprocessable Entity`):**

```json
{
  "status": {
    "code": 422,
    "message": "User could not be created.",
    "errors": [
      "Current password is invalid"
    ]
  }
}
```

**Example:**

```bash
curl -X PATCH http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"user": {"email": "newemail@example.com", "current_password": "password123"}}'
```

---

### Delete Account

#### `DELETE /api/signup`

Delete the current user's account. Requires authentication.

**Headers:**

| Header          | Value            |
|-----------------|------------------|
| `Authorization` | `Bearer <token>` |

**Success response (`200 OK`):**

```json
{
  "status": {
    "code": 200,
    "message": "Account deleted successfully."
  }
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/signup \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

### Reset Password (Request)

#### `POST /api/password`

Send a password reset email to the user.

**Request body:**

```json
{
  "user": {
    "email": "user@example.com"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/password \
  -H "Content-Type: application/json" \
  -d '{"user": {"email": "user@example.com"}}'
```

---

### Reset Password (Update)

#### `PATCH /api/password`

Reset password using the token received via email.

**Request body:**

```json
{
  "user": {
    "reset_password_token": "<token-from-email>",
    "password": "newpassword123",
    "password_confirmation": "newpassword123"
  }
}
```

**Example:**

```bash
curl -X PATCH http://localhost:3000/api/password \
  -H "Content-Type: application/json" \
  -d '{"user": {"reset_password_token": "<token>", "password": "newpassword123", "password_confirmation": "newpassword123"}}'
```

---

### Create Checkout Session

#### `POST /api/checkout`

Create a Stripe Checkout session to purchase tokens. Requires authentication. Redirects the user to Stripe's hosted payment page.

**Pricing:** 1 token = €1.00

**Headers:**

| Header          | Value              |
|-----------------|--------------------|
| `Authorization` | `Bearer <token>`   |
| `Content-Type`  | `application/json` |

**Request body:**

```json
{
  "token_amount": 50
}
```

**Success response (`201 Created`):**

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "session_id": "cs_test_..."
}
```

**Error response (`422 Unprocessable Entity`):**

```json
{
  "error": "token_amount must be positive"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"token_amount": 50}'
```

> Open the `checkout_url` in a browser to complete payment on Stripe's hosted page.
> Use test card `4242 4242 4242 4242` with any future expiry and any CVC.

---

### Stripe Webhook

#### `POST /api/webhooks/stripe`

Receives Stripe webhook events. This endpoint is called by Stripe, not by users directly. It handles:

- `checkout.session.completed` — Credits tokens to the user's balance
- `checkout.session.expired` — Marks the purchase as failed

No authentication required (verified via Stripe signature).

---

## Testing the Payment Flow

### Prerequisites

1. Stripe CLI installed (`stripe --version`)
2. Stripe credentials configured in Rails credentials
3. Rails server running (`bin/rails server`)

### Step-by-step

**1. Start the Stripe webhook listener (in a separate terminal):**

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**2. Log in to get a JWT token:**

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user": {"email": "user@example.com", "password": "password123"}}' \
  -v
```

> Copy the `Authorization` header from the response.

**3. Create a checkout session:**

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"token_amount": 10}'
```

**4. Open the `checkout_url` in your browser** and pay with test card `4242 4242 4242 4242`.

**5. Verify tokens were credited:**

```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

You should see `"token_balance": 10` in the response.

---

## Endpoints Summary

| Method   | Endpoint              | Auth Required | Description                |
|----------|-----------------------|---------------|----------------------------|
| `GET`    | `/api/health`         | No            | Health check               |
| `POST`   | `/api/signup`         | No            | Create account             |
| `POST`   | `/api/login`          | No            | Log in                     |
| `DELETE` | `/api/logout`         | Yes           | Log out (revoke token)     |
| `GET`    | `/api/me`             | Yes           | Get current user profile   |
| `PATCH`  | `/api/signup`         | Yes           | Update account             |
| `DELETE` | `/api/signup`         | Yes           | Delete account             |
| `POST`   | `/api/password`       | No            | Request password reset     |
| `PATCH`  | `/api/password`       | No            | Reset password with token  |
| `POST`   | `/api/checkout`       | Yes           | Create checkout session    |
| `POST`   | `/api/webhooks/stripe`| No            | Stripe webhook (internal)  |
