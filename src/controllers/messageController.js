import { Message } from '../models/Message.js';

export async function sendMessage(req, res, next) {
  try {
    const { companyId } = req.params;
    const { text, file } = req.body;
    const msg = await Message.create({ client: req.user.sub, company: companyId, sender: 'client', text, file });
    res.status(201).json(msg);
  } catch (err) { next(err); }
}

export async function getConversation(req, res, next) {
  try {
    const { companyId } = req.params;
    const msgs = await Message.find({ client: req.user.sub, company: companyId }).sort('createdAt');
    res.json(msgs);
  } catch (err) { next(err); }
}


