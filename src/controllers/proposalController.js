import { Proposal } from '../models/Proposal.js';
import { Request } from '../models/Request.js';

export async function listMyProposals(req, res, next) {
  try {
    const docs = await Proposal.find({ company: req.user.sub })
      .populate('request', 'title budget status')
      .sort('-createdAt');
    res.json(docs);
  } catch (err) { next(err); }
}

export async function createProposal(req, res, next) {
  try {
    const { id: requestId } = req.params;
    const { price, durationDays, notes, attachments } = req.body;
    const request = await Request.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!['submitted', 'open'].includes(request.status)) {
      return res.status(400).json({ message: 'Cannot propose on this request' });
    }
    const existing = await Proposal.findOne({ request: requestId, company: req.user.sub, status: { $ne: 'canceled' } });
    if (existing) return res.status(400).json({ message: 'You already proposed' });
    const doc = await Proposal.create({ request: requestId, company: req.user.sub, price, durationDays, notes, attachments });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

export async function updateProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findOne({ _id: id, company: req.user.sub });
    if (!proposal) return res.status(404).json({ message: 'Not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ message: 'Only pending proposals can be updated' });
    const updatable = (({ price, durationDays, notes, attachments }) => ({ price, durationDays, notes, attachments }))(req.body);
    Object.assign(proposal, updatable);
    await proposal.save();
    res.json(proposal);
  } catch (err) { next(err); }
}

export async function cancelProposal(req, res, next) {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findOne({ _id: id, company: req.user.sub });
    if (!proposal) return res.status(404).json({ message: 'Not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ message: 'Only pending proposals can be canceled' });
    proposal.status = 'canceled';
    await proposal.save();
    res.json(proposal);
  } catch (err) { next(err); }
}


