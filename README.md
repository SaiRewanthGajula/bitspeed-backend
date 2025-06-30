# Bitespeed Backend Task: Identity Reconciliation

API to link customer contacts across multiple purchases on FluxKart.com.

## Setup
1. Clone the repository: `git clone https://github.com/your-username/bitespeed-backend`
2. Install dependencies: `npm install`
3. Set up PostgreSQL and update `.env` with `DATABASE_URL`
4. Run migrations: `npx prisma migrate dev --name init`
5. Generate Prisma client: `npx prisma generate`
6. Start the server: `npm run dev`

## Endpoint
- **POST /identify**: `https://bitspeed-backend-hmst.onrender.com/identify`
- **Request Body**:
  ```json
  {
    "email": "mcfly@hillvalley.edu",
    "phoneNumber": "123456"
  }
