import { Message } from '../models/Message.js';
import { Chat } from '../models/Chat.js';
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
    
    // Find or create Chat record first
    let chat = await Chat.findOne({
      client: req.user.sub,
      serviceProvider: serviceProviderId
    });
    
    if (!chat) {
      chat = await Chat.create({
        client: req.user.sub,
        serviceProvider: serviceProviderId,
        lastMessage: null,
        unreadCount: {
          serviceProvider: 0,
          client: 0
        }
      });
    }
    
    // Create message with conversationId
    const msg = await Message.create({ 
      conversationId: chat._id,
      client: req.user.sub, 
      serviceProvider: serviceProviderId, 
      company: serviceProviderId, // Legacy field
      sender: 'client', 
      text: text || '', 
      file: file || undefined
    });
    
    // Update Chat record
    chat.lastMessage = {
      text: text || (file ? 'File attachment' : ''),
      timestamp: msg.createdAt,
      sender: 'client'
    };
    chat.unreadCount.serviceProvider = (chat.unreadCount.serviceProvider || 0) + 1;
    await chat.save();
    
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
    
    // Find or create Chat record first
    let chat = await Chat.findOne({
      client: clientId,
      serviceProvider: req.user.sub
    });
    
    if (!chat) {
      chat = await Chat.create({
        client: clientId,
        serviceProvider: req.user.sub,
        lastMessage: null,
        unreadCount: {
          client: 0,
          serviceProvider: 0
        }
      });
    }
    
    // Create message with conversationId
    const msg = await Message.create({ 
      conversationId: chat._id,
      client: clientId, 
      serviceProvider: req.user.sub,
      company: req.user.sub, // Legacy field
      sender: 'serviceProvider', 
      text: text || '', 
      file: file || undefined
    });
    
    // Update Chat record
    chat.lastMessage = {
      text: text || (file ? 'File attachment' : ''),
      timestamp: msg.createdAt,
      sender: 'serviceProvider'
    };
    chat.unreadCount.client = (chat.unreadCount.client || 0) + 1;
    await chat.save();
    
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

// List all conversations for client
export async function listClientConversations(req, res, next) {
  try {
    console.log('listClientConversations called for user:', req.user.sub);
    
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    const chats = await Chat.find({ client: req.user.sub })
      .populate('serviceProvider', 'name email avatar')
      .populate('request', 'title')
      .populate('proposal', 'price')
      .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });
    
    console.log(`Found ${chats.length} conversations for client ${req.user.sub}`);
    
    // Format response to include conversationId (which is the Chat._id)
    const formattedChats = chats.map(chat => ({
      _id: chat._id,
      conversationId: chat._id, // Add conversationId for frontend
      client: chat.client,
      serviceProvider: chat.serviceProvider,
      request: chat.request,
      proposal: chat.proposal,
      lastMessage: chat.lastMessage,
      unreadCount: chat.unreadCount,
      isActive: chat.isActive,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));
    
    res.json({ success: true, data: formattedChats });
  } catch (err) {
    console.error('Error in listClientConversations:', err);
    next(err);
  }
}

// List all conversations for service provider
export async function listServiceProviderConversations(req, res, next) {
  try {
    console.log('listServiceProviderConversations called for user:', req.user.sub);
    
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    const chats = await Chat.find({ serviceProvider: req.user.sub })
      .populate('client', 'name email avatar')
      .populate('request', 'title')
      .populate('proposal', 'price')
      .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });
    
    console.log(`Found ${chats.length} conversations for service provider ${req.user.sub}`);
    
    // Format response to include conversationId (which is the Chat._id)
    const formattedChats = chats.map(chat => ({
      _id: chat._id,
      conversationId: chat._id, // Add conversationId for frontend
      client: chat.client,
      serviceProvider: chat.serviceProvider,
      request: chat.request,
      proposal: chat.proposal,
      lastMessage: chat.lastMessage,
      unreadCount: chat.unreadCount,
      isActive: chat.isActive,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));
    
    res.json({ success: true, data: formattedChats });
  } catch (err) {
    console.error('Error in listServiceProviderConversations:', err);
    next(err);
  }
}

// Get messages by conversationId
export async function getMessagesByConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    console.log('getMessagesByConversation called with conversationId:', conversationId);
    console.log('User:', req.user?.sub, 'Role:', req.user?.role);
    
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      console.log('Invalid conversationId format:', conversationId);
      return res.status(400).json({ success: false, message: 'Invalid conversation ID format' });
    }
    
    // Verify conversation exists and user has access
    const chat = await Chat.findById(conversationId);
    if (!chat) {
      console.log('Conversation not found:', conversationId);
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    console.log('Found chat:', chat._id, 'Client:', chat.client, 'ServiceProvider:', chat.serviceProvider);
    
    // Check if user is part of this conversation
    const userId = req.user.sub;
    const isClient = chat.client.toString() === userId.toString();
    const isServiceProvider = chat.serviceProvider.toString() === userId.toString();
    
    if (!isClient && !isServiceProvider) {
      console.log('Access denied - user not part of conversation');
      return res.status(403).json({ success: false, message: 'Access denied to this conversation' });
    }
    
    // Get messages for this conversation
    const msgs = await Message.find({ conversationId })
      .populate('client', 'name email avatar')
      .populate('serviceProvider', 'name email avatar')
      .sort('createdAt');
    
    console.log(`Found ${msgs.length} messages for conversation ${conversationId}`);
    res.json({ success: true, data: msgs });
  } catch (err) {
    console.error('Error in getMessagesByConversation:', err);
    next(err);
  }
}

// Send message to conversation by conversationId
export async function sendMessageToConversation(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { text, file } = req.body;
    
    if (!text && !file) {
      return res.status(400).json({ success: false, message: 'Message text or file is required' });
    }
    
    // Validate ObjectId format
    const mongoose = (await import('mongoose')).default;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID format' });
    }
    
    // Get conversation
    const chat = await Chat.findById(conversationId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    
    // Check if user is part of this conversation
    const userId = req.user.sub;
    const isClient = chat.client.toString() === userId.toString();
    const isServiceProvider = chat.serviceProvider.toString() === userId.toString();
    
    if (!isClient && !isServiceProvider) {
      return res.status(403).json({ success: false, message: 'Access denied to this conversation' });
    }
    
    // Determine sender type
    const sender = isClient ? 'client' : 'serviceProvider';
    
    // Create message
    const msg = await Message.create({
      conversationId: chat._id,
      client: chat.client,
      serviceProvider: chat.serviceProvider,
      company: chat.serviceProvider, // Legacy field
      sender,
      text: text || '',
      file: file || undefined
    });
    
    // Update Chat record
    chat.lastMessage = {
      text: text || (file ? 'File attachment' : ''),
      timestamp: msg.createdAt,
      sender
    };
    
    // Update unread count for the other participant
    if (isClient) {
      chat.unreadCount.serviceProvider = (chat.unreadCount.serviceProvider || 0) + 1;
    } else {
      chat.unreadCount.client = (chat.unreadCount.client || 0) + 1;
    }
    await chat.save();
    
    // Populate sender info for socket
    await msg.populate('client', 'name email avatar');
    await msg.populate('serviceProvider', 'name email avatar');
    
    // Emit socket event
    const io = getIo();
    const recipientId = isClient ? chat.serviceProvider.toString() : chat.client.toString();
    io.to(recipientId).emit('chat:message', {
      id: msg._id,
      conversationId: chat._id,
      from: userId,
      to: recipientId,
      text: msg.text,
      file: msg.file,
      sender,
      senderName: isClient 
        ? (msg.client?.name || 'Client')
        : (msg.serviceProvider?.name || 'Service Provider'),
      timestamp: msg.createdAt,
    });
    
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
}

// Create or get chat for a proposal (when proposal becomes active)
export async function createChatForProposal(req, res, next) {
  try {
    const { proposalId } = req.params;
    const { Proposal } = await import('../models/Proposal.js');
    
    const proposal = await Proposal.findById(proposalId)
      .populate('request')
      .populate('serviceProvider');
    
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }
    
    if (proposal.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Proposal must be active to create chat' });
    }
    
    // Check if chat already exists
    let chat = await Chat.findOne({
      client: proposal.request.client,
      serviceProvider: proposal.serviceProvider._id || proposal.serviceProvider,
      proposal: proposalId
    });
    
    if (!chat) {
      chat = await Chat.create({
        client: proposal.request.client,
        serviceProvider: proposal.serviceProvider._id || proposal.serviceProvider,
        request: proposal.request._id,
        proposal: proposalId,
        lastMessage: null,
        unreadCount: {
          client: 0,
          serviceProvider: 0
        }
      });
    }
    
    await chat.populate('client', 'name email avatar');
    await chat.populate('serviceProvider', 'name email avatar');
    await chat.populate('request', 'title');
    await chat.populate('proposal', 'price');
    
    res.json({ success: true, data: chat });
  } catch (err) { next(err); }
}


