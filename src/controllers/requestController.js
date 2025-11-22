import { Request } from '../models/Request.js';
import { getIo } from '../sockets/socket.js';
import Notification from '../models/Notification.js';

export async function createRequest(req, res, next) {
  try {
    // Log request details for debugging
    console.log('📥 Creating request...');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request body:', req.body);
    console.log('Request files count:', req.files ? req.files.length : 0);
    if (req.files && req.files.length > 0) {
      console.log('Request files:', req.files.map(f => ({ name: f.originalname, size: f.size, mimetype: f.mimetype, fieldname: f.fieldname })));
    }
    
    // Validate required fields - handle both FormData and JSON
    const title = req.body?.title;
    const description = req.body?.description;
    const budget = req.body?.budget;
    const deadline = req.body?.deadline;
    
    if (!title || !description) {
      console.error('❌ Missing required fields:', { title: !!title, description: !!description });
      return res.status(400).json({ 
        message: 'Validation error', 
        error: 'Title and description are required',
        received: { title: !!title, description: !!description }
      });
    }
    
    // Handle file uploads to Cloudinary
    const uploadedAttachments = [];
    const files = req.files || [];
    
    if (files.length > 0) {
      // Check if Cloudinary is configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('Cloudinary not configured - files will not be uploaded');
        // Continue without file uploads if Cloudinary is not configured
      } else {
        try {
          const { uploadToCloudinary } = await import('../config/cloudinary.js');
          
          for (const file of files) {
            try {
              console.log(`Uploading file: ${file.originalname} (${file.size} bytes)`);
              const result = await uploadToCloudinary(file, 'accountax/requests');
              uploadedAttachments.push({
                name: file.originalname,
                url: result.secure_url,
                type: file.mimetype || 'file',
                // Note: publicId is not in the schema, so we don't store it
                // If needed later, we can add it to the schema
              });
              console.log(`File uploaded successfully: ${result.secure_url}`);
            } catch (uploadError) {
              console.error('Error uploading file to Cloudinary:', uploadError);
              // Continue with other files even if one fails
              uploadedAttachments.push({
                name: file.originalname,
                url: '', // Empty URL if upload failed
                type: file.mimetype || 'file',
                error: uploadError.message,
              });
            }
          }
        } catch (importError) {
          console.error('Error importing Cloudinary module:', importError);
          // Continue without file uploads
        }
      }
    }
    
    // If attachments were sent as JSON (from old frontend), merge them
    let attachments = [...uploadedAttachments]; // Create a new array
    
    // Handle any attachments from req.body (shouldn't happen with FormData, but handle it)
    if (req.body.attachments) {
      let bodyAttachments = req.body.attachments;
      
      // If it's a string, try to parse it
      if (typeof bodyAttachments === 'string') {
        try {
          bodyAttachments = JSON.parse(bodyAttachments);
        } catch (e) {
          console.warn('Failed to parse attachments string:', e);
          bodyAttachments = [];
        }
      }
      
      // Only merge if it's a valid array
      if (Array.isArray(bodyAttachments)) {
        const validAttachments = bodyAttachments.filter(a => a && (typeof a === 'object') && (a.url || a.name));
        attachments = [...attachments, ...validAttachments];
      }
    }
    
    // Ensure attachments is always an array of plain objects with correct structure
    // Remove any extra fields that aren't in the schema (name, url, type only)
    const finalAttachments = attachments.map(att => {
      // Ensure att is an object
      if (typeof att !== 'object' || att === null || Array.isArray(att)) {
        console.warn('Invalid attachment format:', att);
        return { name: '', url: '', type: 'file' };
      }
      // Only include fields that are in the schema
      return {
        name: String(att.name || ''),
        url: String(att.url || ''),
        type: String(att.type || 'file')
      };
    }).filter(att => att.name || att.url); // Remove empty attachments
    
    console.log('Final attachments array:', {
      type: typeof finalAttachments,
      isArray: Array.isArray(finalAttachments),
      length: finalAttachments.length,
      sample: finalAttachments[0]
    });
    
    // Extract additional fields from request body
    const legalForm = req.body?.legalForm;
    const businessActivity = req.body?.businessActivity;
    const registeredCapital = req.body?.registeredCapital;
    const estimatedRevenue = req.body?.estimatedRevenue;
    const estimatedExpenses = req.body?.estimatedExpenses;
    
    // Create the request with proper data types
    const requestData = {
      client: req.user.sub,
      title: String(title),
      description: String(description),
      budget: budget || '', // Keep as string for budget range
      attachments: finalAttachments // This should be an array of objects
    };
    
    if (deadline) {
      requestData.deadline = new Date(deadline);
    }
    
    // Add additional fields if provided
    if (legalForm) {
      requestData.legalForm = String(legalForm);
    }
    if (businessActivity) {
      requestData.businessActivity = String(businessActivity);
    }
    if (registeredCapital) {
      requestData.registeredCapital = String(registeredCapital);
    }
    if (estimatedRevenue) {
      requestData.estimatedRevenue = String(estimatedRevenue);
    }
    if (estimatedExpenses) {
      requestData.estimatedExpenses = String(estimatedExpenses);
    }
    
    console.log('Creating request with data:', {
      client: requestData.client,
      title: requestData.title,
      description: requestData.description,
      budget: requestData.budget,
      deadline: requestData.deadline,
      attachmentsCount: finalAttachments.length,
      attachmentsType: typeof finalAttachments,
      attachmentsIsArray: Array.isArray(finalAttachments),
      firstAttachment: finalAttachments[0]
    });
    
    // Use new Request() instead of Request.create() to have more control
    const doc = new Request(requestData);
    await doc.save();
    
    console.log('✅ Request created successfully:', doc._id);
    
    // Send notification to client
    const io = getIo();
    const notification = await Notification.create({
      user: req.user.sub,
      title: "New Request Created",
      Message: `Your request "${title}" has been created successfully.`,
      link: `/requests/${doc._id}`,
      data: { requestId: doc._id },
    });
    
    // Emit to user's sockets if online
    io.to(req.user.sub).emit('newNotification', notification);
    
    res.status(201).json(doc);
  } catch (err) { 
    console.error('Error creating request:', err);
    next(err); 
  }
}

export async function myRequests(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const status = req.query.status; // Filter by status
    const q = req.query.q || req.query.search || ''; // Search query
    const sort = req.query.sort || '-createdAt';
    
    const filter = { client: req.user.sub };
    
    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // Search filter (title or description)
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
      ];
    }
    
    const total = await Request.countDocuments(filter);
    const docs = await Request.find(filter)
      .populate('client', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      data: docs,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
}

export async function getRequest(req, res, next) {
  try {
    const doc = await Request.findOne({ _id: req.params.id, client: req.user.sub });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
}

export async function getRequestWithProposals(req, res, next) {
  try {
    const doc = await Request.findOne({ _id: req.params.id, client: req.user.sub });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const { Proposal } = await import('../models/Proposal.js');
    const proposals = await Proposal.find({ request: req.params.id })
      .populate('serviceProvider', 'name email avatar')
      .populate('company', 'name email avatar') // Legacy support
      .sort('-createdAt');
    res.json({ request: doc, proposals });
  } catch (err) { next(err); }
}

export async function updateRequest(req, res, next) {
  try {
    const doc = await Request.findOne({ _id: req.params.id, client: req.user.sub });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'submitted' && doc.status !== 'open') return res.status(400).json({ message: 'Cannot update' });
    const updatable = (({ title, description, budget, deadline, attachments, status }) => ({ title, description, budget, deadline, attachments, status }))(req.body);
    Object.assign(doc, updatable);
    await doc.save();
    res.json(doc);
  } catch (err) { next(err); }
}

export async function deleteRequest(req, res, next) {
  try {
    const doc = await Request.findOneAndDelete({ _id: req.params.id, client: req.user.sub });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}


