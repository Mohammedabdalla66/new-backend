import { Message } from '../models/Message.js';
import { getIo } from '../sockets/socket.js';

// Client sending message to service provider
export async function sendMessage(req, res, next) {
  try {
    const { serviceProviderId } = req.params;
    
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(serviceProviderId)) {
      return res.status(400).json({ message: 'Invalid service provider ID format' });
    }
    
    const { text, file } = req.body;
    if (!text && !file) {
      return res.status(400).json({ message: 'Message text or file is required' });
    }
    
    const msg = await Message.create({ 
      client: req.user.sub, 
      serviceProvider: serviceProviderId, 
      company: serviceProviderId, // Legacy field
      sender: 'client', 
      text: text || '', 
      file: file || undefined
    });
    
    // Populate sender info for socket
    await msg.populate('client', 'name email avatar');
    
    // Emit socket event to service provider
    const io = getIo();
    io.to(serviceProviderId.toString()).emit('chat:message', {
      id: msg._id,
      from: req.user.sub,
      to: serviceProviderId,
      text: msg.text,
      file: msg.file,
      sender: 'client',
      senderName: msg.client?.name || 'Client',
      timestamp: msg.createdAt,
    });
    
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
}

// Client getting conversation with service provider
export async function getConversation(req, res, next) {
  try {
    const { serviceProviderId } = req.params;
    
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(serviceProviderId)) {
      return res.status(400).json({ message: 'Invalid service provider ID format' });
    }
    
    const msgs = await Message.find({ 
      client: req.user.sub, 
      $or: [
        { serviceProvider: serviceProviderId },
        { company: serviceProviderId } // Legacy support
      ]
    })
      .populate('serviceProvider', 'name email avatar')
      .populate('company', 'name email avatar') // Legacy support
      .sort('createdAt');
    
    res.json({ success: true, data: msgs });
  } catch (err) { next(err); }
}

// Service Provider sending message to client
export async function sendMessageFromServiceProvider(req, res, next) {
  try {
    const { clientId } = req.params;
    
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }
    
    const { text, file } = req.body;
    if (!text && !file) {
      return res.status(400).json({ message: 'Message text or file is required' });
    }
    
    const msg = await Message.create({ 
      client: clientId, 
      serviceProvider: req.user.sub,
      company: req.user.sub, // Legacy field
      sender: 'serviceProvider', 
      text: text || '', 
      file: file || undefined
    });
    
    // Populate sender info for socket
    await msg.populate('serviceProvider', 'name email avatar');
    
    // Emit socket event to client
    const io = getIo();
    io.to(clientId.toString()).emit('chat:message', {
      id: msg._id,
      from: req.user.sub,
      to: clientId,
      text: msg.text,
      file: msg.file,
      sender: 'serviceProvider',
      senderName: msg.serviceProvider?.name || 'Service Provider',
      timestamp: msg.createdAt,
    });
    
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
}

// Service Provider getting conversation with client
export async function getConversationForServiceProvider(req, res, next) {
  try {
    const { clientId } = req.params;
    
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid client ID format' });
    }
    
    const msgs = await Message.find({ 
      client: clientId, 
      $or: [
        { serviceProvider: req.user.sub },
        { company: req.user.sub } // Legacy support
      ]
    })
      .populate('client', 'name email avatar')
      .sort('createdAt');
    
    res.json({ success: true, data: msgs });
  } catch (err) { next(err); }
}


