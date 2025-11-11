import { Request } from '../models/Request.js';
import { getIo } from '../sockets/socket.js';

export async function createRequest(req, res, next) {
  try {
    const { title, description, budget, deadline, attachments } = req.body;
    const doc = await Request.create({ client: req.user.sub, title, description, budget, deadline, attachments });
    io.emit("sendNotification", {
        userId: req.user.sub,
        title: "New Request Created",
        message: `Your request "${title}" has been created successfully.`,
        link: `/requests/${doc._id}`,
        data: { requestId: doc._id },
        interests: req.user.interests || []
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

export async function myRequests(req, res, next) {
  try {
    const docs = await Request.find({ client: req.user.sub }).sort('-createdAt');
    res.json(docs);
  } catch (err) { next(err); }
}

export async function getRequest(req, res, next) {
  try {
    const doc = await Request.findOne({ _id: req.params.id, client: req.user.sub });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
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


