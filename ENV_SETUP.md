# Environment Variables Setup

## ⚠️ Required: Create `.env` file

The backend requires environment variables to run. Follow these steps:

## Required Variables

### Database
- `MONGO_URI` - MongoDB connection string
- `MONGO_DB_NAME` - Database name

### JWT Authentication
- `JWT_ACCESS_SECRET` - Secret for access tokens (REQUIRED)
- `JWT_REFRESH_SECRET` - Secret for refresh tokens (REQUIRED)

### Server
- `PORT` - Server port (default: 5000)
- `CORS_ORIGIN` - Frontend URL for CORS

### Cloudinary (Required for file uploads)
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Your Cloudinary API key
- `CLOUDINARY_API_SECRET` - Your Cloudinary API secret

### Optional Variables
- `EMAIL_USER` - Email for notifications
- `EMAIL_PASS` - Email app password
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_VERIFY_SID` - Twilio verify service SID

### 1. Create `.env` file

In the `backend` folder, create a file named `.env` (no extension).

### 2. Copy from `.env.example`

Copy the contents from `.env.example` and update the values.

### 3. Generate JWT Secrets

**IMPORTANT**: You MUST set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with strong random strings.

#### Option A: Use Node.js to generate secrets
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run this twice to get two different secrets.

#### Option B: Use online generator
Visit: https://generate-secret.vercel.app/64 (or similar)

#### Option C: Use PowerShell (Windows)
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

### 4. Minimum Required Variables

At minimum, you need these variables:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=accountax
JWT_ACCESS_SECRET=<generate-a-random-64-character-string>
JWT_REFRESH_SECRET=<generate-a-different-random-64-character-string>
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### 5. Quick Setup Script

Run this in PowerShell to create a basic `.env` file:

```powershell
cd backend
@"
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=accountax
JWT_ACCESS_SECRET=$(New-Guid).Guid.Replace('-','') + $(New-Guid).Guid.Replace('-','')
JWT_REFRESH_SECRET=$(New-Guid).Guid.Replace('-','') + $(New-Guid).Guid.Replace('-','')
PORT=5000
CORS_ORIGIN=http://localhost:5173
"@ | Out-File -FilePath .env -Encoding utf8
```

Or manually create `.env` with:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=accountax
JWT_ACCESS_SECRET=change-this-to-a-random-64-character-string
JWT_REFRESH_SECRET=change-this-to-a-different-random-64-character-string
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### 6. Verify Setup

After creating `.env`, restart your server:

```bash
npm run dev
```

You should see:
```
MongoDB connected
✅ Server running on http://localhost:5000
```

If you see "secretOrPrivateKey must have a value", the JWT secrets are still missing.

## 🔐 Security Notes

- **NEVER commit `.env` to git** (it should be in `.gitignore`)
- Use strong, random secrets in production
- Keep secrets different between development and production
- Rotate secrets periodically

