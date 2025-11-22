# Cloudinary File Upload Implementation

## ✅ Implementation Complete

This document describes the complete authentication and file upload flow with Cloudinary integration.

## 📁 Files Created/Modified

### New Files
- `src/config/cloudinary.js` - Cloudinary configuration and upload helpers
- `.env.example` - Environment variables template with Cloudinary credentials

### Modified Files
- `src/models/User.js` - Added `documents`, `taxId`, `licenseNumber`, `address`, `nationality` fields
- `src/middlewares/upload.js` - Changed from disk storage to memory storage for Cloudinary
- `src/controllers/authController.js` - Updated registration endpoints with Cloudinary upload
- `src/routes/authRoutes.js` - Added admin registration route
- `src/controllers/adminController.js` - Added `listCompanies` endpoint
- `src/routes/adminRoutes.js` - Added companies listing route

## 🔐 Registration Endpoints

### 1. Admin Registration
**POST** `/api/auth/register/admin`

**Body (JSON):**
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "name": "Admin Name",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 2. Client Registration
**POST** `/api/auth/register/client`

**Body (JSON):**
```json
{
  "fullName": "Client Name",
  "email": "client@example.com",
  "password": "SecurePassword123",
  "phoneNumber": "+1234567890",
  "nationality": "omani",
  "address": "123 Main Street",
  "verified": true
}
```

**Response:**
```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "name": "Client Name",
    "email": "client@example.com",
    "role": "client",
    "phone": "+1234567890"
  }
}
```

### 3. Company Registration (with File Upload)
**POST** `/api/auth/register/company`

**Body (FormData):**
- `companyName`: "Company Name"
- `companyEmail`: "company@example.com"
- `password`: "SecurePassword123"
- `phoneNumber`: "+1234567890"
- `taxId`: "TAX123456" (optional)
- `licenseNumber`: "LIC789012" (optional)
- `documents`: File[] (multiple files allowed, max 10)
- `verified`: "true"

**Response:**
```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "name": "Company Name",
    "email": "company@example.com",
    "role": "company",
    "phone": "+1234567890",
    "taxId": "TAX123456",
    "licenseNumber": "LIC789012"
  },
  "documents": [
    {
      "url": "https://res.cloudinary.com/.../document.pdf",
      "name": "license.pdf",
      "type": "document"
    }
  ]
}
```

## 🔍 Admin Endpoints

### Get All Companies with Documents
**GET** `/api/admin/companies`

**Query Parameters:**
- `verified` (optional): `true` or `false` - Filter by verification status
- `search` (optional): Search by name, email, taxId, or licenseNumber

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response:**
```json
{
  "count": 5,
  "companies": [
    {
      "id": "company_id",
      "name": "Company Name",
      "email": "company@example.com",
      "phone": "+1234567890",
      "taxId": "TAX123456",
      "licenseNumber": "LIC789012",
      "verified": true,
      "documents": [
        {
          "url": "https://res.cloudinary.com/.../document.pdf",
          "publicId": "accountax/companies/xyz123",
          "name": "license.pdf",
          "type": "document",
          "uploadedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## ⚙️ Environment Variables

Add these to your `.env` file:

```env
# Cloudinary Configuration (REQUIRED for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Getting Cloudinary Credentials

1. Sign up at https://cloudinary.com/
2. Go to Dashboard
3. Copy your:
   - Cloud Name
   - API Key
   - API Secret

## 📦 File Upload Details

### Supported File Types
- Images: JPG, JPEG, PNG
- Documents: PDF, DOC, DOCX

### File Size Limit
- Maximum: 10MB per file
- Maximum: 10 files per request

### Storage Location
Files are stored in Cloudinary under the folder: `accountax/companies/`

### File Metadata
Each uploaded file includes:
- `url`: Secure HTTPS URL to access the file
- `publicId`: Cloudinary public ID (for deletion)
- `name`: Original filename
- `type`: Document type (default: "document")
- `uploadedAt`: Upload timestamp

## 🔒 Security Features

1. **Password Hashing**: All passwords are hashed using bcryptjs
2. **JWT Authentication**: Access and refresh tokens for secure authentication
3. **Role-Based Access**: Admin endpoints require admin role
4. **File Validation**: Only allowed file types and sizes are accepted
5. **Email Validation**: Email format validation on all registration endpoints

## 🧪 Testing with Postman

### Example: Company Registration with Files

1. **Method**: POST
2. **URL**: `http://localhost:5000/api/auth/register/company`
3. **Body Type**: `form-data`
4. **Fields**:
   - `companyName`: "Test Company"
   - `companyEmail`: "test@company.com"
   - `password`: "Test123456"
   - `phoneNumber`: "+1234567890"
   - `taxId`: "TAX123"
   - `licenseNumber`: "LIC456"
   - `documents`: [Select File] (choose PDF or image)
   - `verified`: "true"

### Example: Admin Get Companies

1. **Method**: GET
2. **URL**: `http://localhost:5000/api/admin/companies?verified=true`
3. **Headers**:
   - `Authorization`: `Bearer <admin_access_token>`

## 🐛 Error Handling

All endpoints include comprehensive error handling:
- **400 Bad Request**: Missing required fields, invalid data
- **401 Unauthorized**: Invalid or missing token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server errors (with detailed logging)

## 📝 Notes

- Company documents are stored in MongoDB as an array within the User document
- Cloudinary URLs are permanent and accessible via HTTPS
- Files can be deleted from Cloudinary using the `publicId` if needed
- Admin can view all companies and their documents via `/api/admin/companies`
- All registration endpoints return JWT tokens for immediate authentication

## 🚀 Next Steps

1. Set up Cloudinary account and add credentials to `.env`
2. Test registration endpoints with Postman
3. Integrate file upload in frontend registration forms
4. Implement file deletion functionality if needed
5. Add file preview/download functionality in admin panel

