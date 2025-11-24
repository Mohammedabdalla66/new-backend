import { User } from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/tokens.js';
import { twilioClient, verifyServiceSid } from '../utils/twilio.js';
import mongoose from 'mongoose';

// Generic registration (legacy - use specific endpoints instead)
export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create({ name, email, password, role: 'client', status: 'pending' });
    const payload = { sub: user._id.toString(), role: user.role };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    return res.status(201).json({ accessToken: access, refreshToken: refresh, id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) { next(err); }
}

// Admin registration
export async function registerAdmin(req, res, next) {
  try {
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Name, email, and password are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Create admin user
    const user = await User.create({ 
      name, 
      email, 
      password, 
      role: 'admin',
      status: 'active', // Admins are auto-activated
      verified: true, // Admins are auto-verified
    });
    
    const payload = { sub: user._id.toString(), role: user.role };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    
    return res.status(201).json({ 
      accessToken: access, 
      refreshToken: refresh, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
      } 
    });
  } catch (err) { 
    console.error('Admin registration error:', err);
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors 
      });
    }
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: 'Email already in use' 
      });
    }
    
    next(err); 
  }
}

// Client registration with additional fields
export async function registerClient(req, res, next) {
  console.log("🔥 RAW BODY:", req.body);
console.log("🔥 RAW FILES:", req.files);

  try {
    const { fullName, email, password, phoneNumber, nationality, address, verified } = req.body;
    
    // Log received data for debugging
    console.log('Client registration request:', { 
      fullName, 
      email, 
      hasPassword: !!password, 
      phoneNumber,
      nationality,
      address 
    });
    
    // Validate required fields
    if (!fullName || !email || !password) {
      const missing = [];
      if (!fullName) missing.push('fullName');
      if (!email) missing.push('email');
      if (!password) missing.push('password');
      return res.status(400).json({ 
        message: `Missing required fields: ${missing.join(', ')}`,
        received: { fullName: !!fullName, email: !!email, password: !!password }
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Create user
    try {
      console.log('Attempting to create user in database...');
      const userData = {
        name: fullName, 
        email, 
        password, 
        phone: phoneNumber || undefined,
        role: 'client',
        status: 'pending',
        verified: verified || false,
        address: address || undefined,
        nationality: nationality || undefined,
      };
      console.log('User data to save:', { ...userData, password: '***' });
      
      // Check database connection
      const dbState = mongoose.connection.readyState;
      const dbName = mongoose.connection.db?.databaseName;
      console.log('Database connection state:', dbState, '(0=disconnected, 1=connected, 2=connecting, 3=disconnecting)');
      console.log('Database name:', dbName);
      
      if (dbState !== 1) {
        console.error('❌ Database is not connected! State:', dbState);
        throw new Error('Database connection is not active');
      }
      
      const user = await User.create(userData);
      console.log('User.create() completed, user ID:', user._id.toString());
      
      // Force save and verify
      await user.save();
      console.log('user.save() completed');
      
      // Wait a moment for database to sync
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify user was saved to database - try multiple queries
      console.log('Verifying user in database...');
      const savedUser = await User.findById(user._id);
      const savedUserByEmail = await User.findOne({ email: user.email });
      const allUsers = await User.find({}).limit(5);
      
      console.log('FindById result:', savedUser ? 'FOUND' : 'NOT FOUND');
      console.log('FindOne by email result:', savedUserByEmail ? 'FOUND' : 'NOT FOUND');
      console.log('Total users in collection:', allUsers.length);
      console.log('Sample user IDs:', allUsers.map(u => u._id.toString()));
      
      if (!savedUser) {
        console.error('❌ ERROR: User was not found in database after creation!');
        console.error('User ID searched:', user._id.toString());
        console.error('User email:', user.email);
        throw new Error('User was not saved to database');
      }
      
      console.log('✅ User created and saved successfully:', user._id.toString());
      console.log('✅ User data confirmed in database:', {
        id: savedUser._id.toString(),
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        phone: savedUser.phone,
        address: savedUser.address,
        nationality: savedUser.nationality,
        createdAt: savedUser.createdAt,
        database: dbName,
      });
      
      // Generate JWT tokens
      console.log('Generating JWT tokens...');
      const payload = { sub: user._id.toString(), role: user.role };
      
      let access, refresh;
      try {
        access = signAccessToken(payload);
        refresh = signRefreshToken(payload);
        console.log('✅ JWT tokens generated successfully');
      } catch (tokenError) {
        console.error('❌ JWT token generation failed:', tokenError);
        throw new Error(`Token generation failed: ${tokenError.message}`);
      }
      
      // Send response
      console.log('Sending registration response...');
      const responseData = { 
        accessToken: access, 
        refreshToken: refresh, 
        user: { 
          id: user._id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          phone: user.phone,
          address: user.address,
          nationality: user.nationality,
        } 
      };
      
      console.log('Response data prepared:', { ...responseData, accessToken: '***', refreshToken: '***' });
      
      res.status(201).json(responseData);
      console.log('✅ Registration response sent successfully');
      return;
    } catch (createError) {
      console.error('❌ User creation error:', createError);
      console.error('Error details:', {
        name: createError.name,
        message: createError.message,
        code: createError.code,
        errors: createError.errors,
        stack: createError.stack
      });
      
      // Handle Mongoose validation errors
      if (createError.name === 'ValidationError') {
        const errors = Object.values(createError.errors).map(e => e.message);
        return res.status(400).json({ 
          message: 'Validation error', 
          errors,
          details: Object.keys(createError.errors)
        });
      }
      
      // Handle duplicate key error
      if (createError.code === 11000) {
        const field = Object.keys(createError.keyPattern || {})[0] || 'email';
        return res.status(400).json({ 
          message: `${field} already in use`,
          field
        });
      }
      
      throw createError;
    }
  } catch (err) { 
    console.error('Client registration error:', err);
    console.error('Error stack:', err.stack);
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors 
      });
    }
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: 'Email already in use' 
      });
    }
    
    // Return error details for debugging
    return res.status(400).json({
      message: err.message || 'Registration failed',
      error: err.name,
      ...(process.env.NODE_ENV === 'development' && { details: err.toString() })
    });
  }
}

// Service Provider registration with file uploads to Cloudinary
export async function registerServiceProvider(req, res, next) {
  console.log("🔥 RAW BODY:", req.body);
console.log("🔥 RAW FILES:", req.files);

  try {
    // Log received data for debugging
    console.log('Service Provider registration request body:', {
      serviceProviderName: req.body.serviceProviderName || req.body.companyName,
      serviceProviderEmail: req.body.serviceProviderEmail || req.body.companyEmail,
      email: req.body.email,
      hasPassword: !!req.body.password,
      phoneNumber: req.body.phoneNumber,
      taxId: req.body.taxId,
      licenseNumber: req.body.licenseNumber,
      address: req.body.address,
      legalForm: req.body.legalForm,
      companyType: req.body.companyType,
      contactPersonName: req.body.contactPersonName,
      filesCount: req.files?.length || 0,
    });
    
    // Handle FormData (multipart/form-data)
    // Support both old (companyName) and new (serviceProviderName) field names for backward compatibility
    const serviceProviderName = req.body.serviceProviderName || req.body.companyName;
    const email = req.body.serviceProviderEmail || req.body.companyEmail || req.body.email;
    const password = req.body.password;
    const phoneNumber = req.body.phoneNumber;
    const taxId = req.body.taxId;
    const licenseNumber = req.body.licenseNumber;
    const address = req.body.address;
    const legalForm = req.body.legalForm;
    const companyType = req.body.companyType;
    const contactPersonName = req.body.contactPersonName;
    const verified = req.body.verified === 'true' || req.body.verified === true;
    
    // Validate required fields
    if (!serviceProviderName || !email || !password) {
      const missing = [];
      if (!serviceProviderName) missing.push('serviceProviderName (or companyName)');
      if (!email) missing.push('email (serviceProviderEmail or companyEmail)');
      if (!password) missing.push('password');
      return res.status(400).json({ 
        message: `Missing required fields: ${missing.join(', ')}`,
        received: {
          serviceProviderName: !!serviceProviderName,
          email: !!email,
          password: !!password,
        }
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if user exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
    // Upload files to Cloudinary
    const files = req.files || [];
    const uploadedDocuments = [];
    
    if (files.length > 0) {
      // Check if Cloudinary is configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('Cloudinary not configured - files will not be uploaded');
        return res.status(400).json({ 
          message: 'File upload service not configured. Please configure Cloudinary credentials in .env file.',
          error: 'CLOUDINARY_NOT_CONFIGURED'
        });
      }
      
      try {
        const { uploadToCloudinary } = await import('../config/cloudinary.js');
        
        for (const file of files) {
          try {
            console.log(`Uploading file: ${file.originalname} (${file.size} bytes)`);
            const result = await uploadToCloudinary(file, 'accountax/service-providers');
            uploadedDocuments.push({
              url: result.secure_url,
              publicId: result.public_id,
              name: file.originalname,
              type: req.body[`documentType_${file.fieldname}`] || 'document',
            });
            console.log(`File uploaded successfully: ${result.secure_url}`);
          } catch (uploadError) {
            console.error('Error uploading file to Cloudinary:', uploadError);
            // If Cloudinary upload fails, return error instead of continuing
            return res.status(400).json({ 
              message: 'Failed to upload file to Cloudinary',
              error: uploadError.message || 'File upload error',
              fileName: file.originalname
            });
          }
        }
      } catch (importError) {
        console.error('Error importing Cloudinary module:', importError);
        return res.status(500).json({ 
          message: 'File upload service error',
          error: 'CLOUDINARY_IMPORT_ERROR'
        });
      }
    }
    
    // Create user with documents
    console.log('Attempting to create service provider user in database...');
    const serviceProviderData = {
      name: serviceProviderName, 
      email, 
      password, 
      phone: phoneNumber,
      role: 'serviceProvider',
      status: 'pending',
      verified: verified || false,
      taxId: taxId || undefined,
      licenseNumber: licenseNumber || undefined,
      address: address || undefined,
      legalForm: legalForm || undefined,
      companyType: companyType || undefined,
      contactPersonName: contactPersonName || undefined,
      documents: uploadedDocuments,
    };
    console.log('Service Provider data to save:', { ...serviceProviderData, password: '***', documentsCount: uploadedDocuments.length });
    
    const user = await User.create(serviceProviderData);
    
    // Force save and verify
    await user.save();
    
    // Verify user was saved to database
    const savedUser = await User.findById(user._id);
    if (!savedUser) {
      console.error('ERROR: Service Provider user was not found in database after creation!');
      throw new Error('Service Provider user was not saved to database');
    }
    
    console.log('✅ Service Provider user created and saved successfully:', user._id);
    console.log('✅ Service Provider data confirmed in database:', {
      id: savedUser._id.toString(),
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
      phone: savedUser.phone,
      taxId: savedUser.taxId,
      licenseNumber: savedUser.licenseNumber,
      address: savedUser.address,
      legalForm: savedUser.legalForm,
      companyType: savedUser.companyType,
      contactPersonName: savedUser.contactPersonName,
      documentsCount: savedUser.documents?.length || 0,
      createdAt: savedUser.createdAt,
    });
    
    // Generate JWT tokens
    console.log('Generating JWT tokens for service provider...');
    const payload = { sub: user._id.toString(), role: user.role };
    
    let access, refresh;
    try {
      access = signAccessToken(payload);
      refresh = signRefreshToken(payload);
      console.log('✅ JWT tokens generated successfully');
    } catch (tokenError) {
      console.error('❌ JWT token generation failed:', tokenError);
      throw new Error(`Token generation failed: ${tokenError.message}`);
    }
    
    // Send response
    console.log('Sending service provider registration response...');
    const responseData = { 
      accessToken: access, 
      refreshToken: refresh, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        phone: user.phone,
        taxId: user.taxId,
        licenseNumber: user.licenseNumber,
        address: user.address,
        legalForm: user.legalForm,
        companyType: user.companyType,
        contactPersonName: user.contactPersonName,
      },
      documents: uploadedDocuments.map(doc => ({
        url: doc.url,
        name: doc.name,
        type: doc.type,
      })),
    };
    
    console.log('Response data prepared:', { 
      ...responseData, 
      accessToken: '***', 
      refreshToken: '***',
      documentsCount: responseData.documents.length
    });
    
    res.status(201).json(responseData);
    console.log('✅ Service Provider registration response sent successfully');
    return;
  } catch (err) { 
    console.error('Service Provider registration error:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors,
        details: Object.keys(err.errors)
      });
    }
    
    // Handle duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'email';
      return res.status(400).json({ 
        message: `${field} already in use`,
        field
      });
    }
    
    // Handle Cloudinary errors
    if (err.message?.includes('Cloudinary') || err.message?.includes('cloudinary')) {
      return res.status(400).json({
        message: 'File upload failed',
        error: err.message
      });
    }
    
    // Return detailed error for debugging
    return res.status(400).json({
      message: err.message || 'Service Provider registration failed',
      error: err.name,
      ...(process.env.NODE_ENV === 'development' && { 
        details: err.toString(),
        stack: err.stack 
      })
    });
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Check if user is pending (not activated by admin)
    // Admins can always sign in, bypassing the pending status check
    if (user.status === 'pending' && user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Your account is under review. Please wait for admin approval.',
        status: 'pending'
      });
    }
    const payload = { sub: user._id.toString(), role: user.role };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    res.json({ accessToken: access, refreshToken: refresh, user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (err) { next(err); }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Missing token' });
    const payload = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    const access = signAccessToken({ sub: payload.sub, role: payload.role });
    res.json({ accessToken: access });
  } catch (err) { next(err); }
}

export async function logout(req, res) {
  res.json({ message: 'Logged out' });
}

// Send phone verification code via Twilio Verify
export async function sendPhoneVerification(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });
    
    // If Twilio is not configured, return success (phone verification optional)
    if (!twilioClient || !verifyServiceSid) {
      console.warn('Twilio not configured - phone verification skipped');
      return res.json({ 
        status: 'pending', 
        message: 'Phone verification service not configured. Phone verification skipped.',
        skipped: true 
      });
    }

    try {
      const verification = await twilioClient.verify.v2.services(verifyServiceSid)
        .verifications
        .create({ to: phone, channel: 'sms' });
      res.json({ status: verification.status });
    } catch (twilioError) {
      // Handle Twilio trial account restrictions and 403 errors
      const errorCode = twilioError.code || twilioError.status;
      const errorMessage = twilioError.message || '';
      
      if (
        errorCode === 21211 || 
        errorCode === 403 ||
        errorMessage.includes('unverified') ||
        errorMessage.includes('Trial accounts cannot send') ||
        errorMessage.includes('verify it at twilio.com')
      ) {
        console.warn('Twilio trial account restriction:', errorMessage);
        return res.status(200).json({ 
          status: 'pending',
          message: 'Phone verification requires verified number in Twilio. For development, phone verification is skipped.',
          skipped: true,
          error: 'Trial account restriction - verify number at twilio.com/user/account/phone-numbers/verified'
        });
      }
      // Re-throw other Twilio errors
      throw twilioError;
    }
  } catch (err) {
    console.error('Phone verification error:', err);
    
    // Check if it's a Twilio error with 403 or trial restriction
    const errorCode = err.code || err.status || err.statusCode;
    const errorMessage = err.message || err.msg || '';
    
    if (
      errorCode === 21211 || 
      errorCode === 403 ||
      errorMessage.includes('unverified') ||
      errorMessage.includes('Trial accounts cannot send') ||
      errorMessage.includes('verify it at twilio.com') ||
      errorMessage.includes('Trial account')
    ) {
      console.warn('Twilio trial account restriction detected');
      return res.status(200).json({ 
        status: 'pending',
        message: 'Phone verification requires verified number in Twilio. For development, phone verification is skipped.',
        skipped: true,
        error: 'Trial account restriction - verify number at twilio.com/user/account/phone-numbers/verified'
      });
    }
    
    // Return a graceful error instead of 500
    return res.status(200).json({ 
      status: 'pending',
      message: 'Phone verification service unavailable. Verification skipped for development.',
      skipped: true,
      error: err.message || 'Phone verification service error'
    });
  }
}

// Verify code
export async function verifyPhoneCode(req, res, next) {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: 'Phone and code are required' });
    
    // If Twilio is not configured, return success (phone verification optional)
    if (!twilioClient || !verifyServiceSid) {
      console.warn('Twilio not configured - phone verification skipped');
      return res.json({ verified: true, skipped: true });
    }

    try {
      const check = await twilioClient.verify.v2.services(verifyServiceSid)
        .verificationChecks
        .create({ to: phone, code });
      const verified = check.status === 'approved';
      res.json({ verified });
    } catch (twilioError) {
      // Handle Twilio errors gracefully
      if (twilioError.code === 20404 || twilioError.message?.includes('not found')) {
        return res.status(400).json({ 
          verified: false,
          message: 'Verification code expired or invalid'
        });
      }
      throw twilioError;
    }
  } catch (err) {
    console.error('Phone verification check error:', err);
    return res.status(400).json({ 
      verified: false,
      message: 'Failed to verify code',
      error: err.message || 'Verification service error'
    });
  }
}


