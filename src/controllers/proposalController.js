import { Proposal } from '../models/Proposal.js';
import { Request } from '../models/Request.js';
import { getIo } from '../sockets/socket.js';
import Notification from '../models/Notification.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

export async function listMyProposals(req, res, next) {
  try {
    const docs = await Proposal.find({ 
      $or: [
        { serviceProvider: req.user.sub },
        { company: req.user.sub } // Legacy support
      ]
    })
      .populate('request', 'title budget status client')
      .populate('request.client', 'name email')
      .sort('-createdAt');
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
}

// List proposals for a specific request (for clients)
export async function listProposalsByRequest(req, res, next) {
  try {
    const requestId = req.params.id || req.params.requestId; // Support both :id and :requestId
    console.log('📥 Fetching proposals for request:', requestId);
    console.log('Request params:', req.params);
    
    if (!requestId) {
      return res.status(400).json({ message: 'Request ID is required' });
    }
    
    const request = await Request.findById(requestId);
    if (!request) {
      console.log('❌ Request not found:', requestId);
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Verify client owns the request
    if (request.client.toString() !== req.user.sub) {
      console.log('❌ Client does not own request. Client:', req.user.sub, 'Request client:', request.client.toString());
      return res.status(403).json({ message: 'You can only view proposals for your own requests' });
    }
    
    // Clients can see all proposals (pending, active, rejected) for their requests
    const proposals = await Proposal.find({ request: requestId })
      .populate('serviceProvider', 'name email avatar')
      .populate('company', 'name email avatar') // Legacy support
      .sort('-createdAt');
    
    console.log('✅ Found', proposals.length, 'proposals for request:', requestId);
    res.json({ success: true, data: proposals });
  } catch (err) {
    console.error('❌ Error in listProposalsByRequest:', err);
    next(err);
  }
}

export async function createProposal(req, res, next) {
  try {
    const { id: requestId } = req.params;
    const { price, durationDays, notes } = req.body;
    
    // Validate required fields
    if (!price || !durationDays) {
      return res.status(400).json({ message: 'Price and duration are required' });
    }
    
    const request = await Request.findById(requestId).populate('client');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!['submitted', 'open'].includes(request.status)) {
      return res.status(400).json({ message: 'Cannot propose on this request' });
    }
    
    // Check if provider already proposed
    const existing = await Proposal.findOne({ 
      request: requestId, 
      $or: [
        { serviceProvider: req.user.sub },
        { company: req.user.sub } // Legacy support
      ],
      status: { $ne: 'canceled' } 
    });
    if (existing) return res.status(400).json({ message: 'You already proposed on this request' });
    
    // Handle file uploads to Cloudinary
    const uploadedAttachments = [];
    const files = req.files || [];
    
    if (files.length > 0) {
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('Cloudinary not configured - files will not be uploaded');
      } else {
        try {
          for (const file of files) {
            try {
              console.log(`Uploading proposal file: ${file.originalname} (${file.size} bytes)`);
              const result = await uploadToCloudinary(file, 'accountax/proposals');
              uploadedAttachments.push({
                name: file.originalname,
                url: result.secure_url,
                type: file.mimetype || 'file',
              });
              console.log(`File uploaded successfully: ${result.secure_url}`);
            } catch (uploadError) {
              console.error('Error uploading file to Cloudinary:', uploadError);
              uploadedAttachments.push({
                name: file.originalname,
                url: '',
                type: file.mimetype || 'file',
                error: uploadError.message,
              });
            }
          }
        } catch (importError) {
          console.error('Error importing Cloudinary module:', importError);
        }
      }
    }
    
    // Create proposal
    const doc = await Proposal.create({ 
      request: requestId, 
      serviceProvider: req.user.sub,
      company: req.user.sub, // Legacy field
      price: parseFloat(price), 
      durationDays: parseInt(durationDays), 
      notes: notes || '', 
      attachments: uploadedAttachments,
      status: 'pending',
    });
    
    // Populate for response
    await doc.populate('request', 'title budget status');
    await doc.populate('serviceProvider', 'name email');
    
    // Send notification to client
    const io = getIo();
    const notification = await Notification.create({
      user: request.client._id,
      title: 'New Proposal Received',
      Message: `A new proposal has been submitted for your request: "${request.title}"`,
      link: `/requests/${requestId}/proposals`,
      data: { requestId, proposalId: doc._id },
    });
    
    // Emit socket notification to client
    io.to(request.client._id.toString()).emit('newNotification', {
      id: notification._id,
      title: notification.title,
      message: notification.Message,
      link: notification.link,
      timestamp: notification.createdAt,
    });
    
    res.status(201).json({ success: true, data: doc });
  } catch (err) { 
    console.error('Error creating proposal:', err);
    next(err); 
  }
}

export async function getProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id)
      .populate('request', 'title budget status client')
      .populate('request.client', 'name email')
      .populate('serviceProvider', 'name email')
      .populate('company', 'name email'); // Legacy support
    
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    
    // Check if user has access (either the provider who created it or the client who owns the request)
    const isProvider = proposal.serviceProvider?._id?.toString() === req.user.sub || proposal.company?._id?.toString() === req.user.sub;
    const isClient = proposal.request?.client?._id?.toString() === req.user.sub;
    
    if (!isProvider && !isClient) {
      return res.status(403).json({ message: 'You do not have access to this proposal' });
    }
    
    res.json({ success: true, data: proposal });
  } catch (err) { next(err); }
}

export async function updateProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findOne({ 
      _id: id, 
      $or: [
        { serviceProvider: req.user.sub },
        { company: req.user.sub } // Legacy support
      ]
    });
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ message: 'Only pending proposals can be updated' });
    
    // Handle file uploads if new files are provided
    const files = req.files || [];
    let uploadedAttachments = [...(proposal.attachments || [])];
    
    if (files.length > 0) {
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
          for (const file of files) {
            try {
              const result = await uploadToCloudinary(file, 'accountax/proposals');
              uploadedAttachments.push({
                name: file.originalname,
                url: result.secure_url,
                type: file.mimetype || 'file',
              });
            } catch (uploadError) {
              console.error('Error uploading file:', uploadError);
            }
          }
        } catch (importError) {
          console.error('Error importing Cloudinary:', importError);
        }
      }
    }
    
    // Update allowed fields
    if (req.body.price !== undefined) proposal.price = parseFloat(req.body.price);
    if (req.body.durationDays !== undefined) proposal.durationDays = parseInt(req.body.durationDays);
    if (req.body.notes !== undefined) proposal.notes = req.body.notes;
    if (files.length > 0) proposal.attachments = uploadedAttachments;
    
    await proposal.save();
    await proposal.populate('request', 'title budget status');
    await proposal.populate('serviceProvider', 'name email');
    
    res.json({ success: true, data: proposal });
  } catch (err) { next(err); }
}

export async function cancelProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findOne({ 
      _id: id, 
      $or: [
        { serviceProvider: req.user.sub },
        { company: req.user.sub } // Legacy support
      ]
    });
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ message: 'Only pending proposals can be canceled' });
    proposal.status = 'canceled';
    await proposal.save();
    res.json({ success: true, data: proposal });
  } catch (err) { next(err); }
}


