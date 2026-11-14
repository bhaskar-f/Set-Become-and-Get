const DailyLearning = require('../models/daily-learning.model');
const { success, AppError } = require('../utils/http');
const { AuditLog } = require('../models');
const researchedToday = require('../../../frontend/daily-learning-today.json');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const publicToday = async (req, res) => {
  const date = today();
  const item = await DailyLearning.findOne({ date, published: true }).lean();
  success(res, item ? { date, currentAffairs: item.currentAffairs, vocabulary: item.vocabulary } : null);
};
const list = async (req, res) => {
  const items = await DailyLearning.find().sort({ date: -1 }).limit(45).select('date published currentAffairs vocabulary updatedAt').lean();
  if (!items.some(item => item.date === researchedToday.date)) items.unshift({ date: researchedToday.date, published: false, currentAffairs: researchedToday.currentAffairs, vocabulary: researchedToday.vocabulary, updatedAt: null, isResearchSeed: true });
  success(res, items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 45));
};
const get = async (req, res) => {
  if (!DATE_RE.test(req.params.date)) throw new AppError(400, 'INVALID_DATE', 'Use YYYY-MM-DD.');
  const item = await DailyLearning.findOne({ date: req.params.date }).lean();
  if (item) return success(res, item);
  if (req.params.date === researchedToday.date) return success(res, { date: researchedToday.date, published: false, currentAffairs: researchedToday.currentAffairs, vocabulary: researchedToday.vocabulary, isResearchSeed: true });
  success(res, null);
};
const save = async (req, res) => {
  const { date, currentAffairs, vocabulary, published } = req.body;
  if (!DATE_RE.test(date)) throw new AppError(400, 'INVALID_DATE', 'Use YYYY-MM-DD.');
  if (!Array.isArray(currentAffairs) || currentAffairs.length > 20) throw new AppError(400, 'INVALID_CURRENT_AFFAIRS', 'Add up to 20 current-affairs cards.');
  if (!Array.isArray(vocabulary) || (published && vocabulary.length !== 10) || vocabulary.length > 10) throw new AppError(400, 'INVALID_VOCABULARY', 'Published daily vocabulary must contain exactly 10 words; drafts may be incomplete.');
  if (currentAffairs.some(x => !x.title?.trim() || !x.summary?.trim())) throw new AppError(400, 'INVALID_CURRENT_AFFAIRS', 'Every current-affairs card needs a title and summary.');
  if (vocabulary.some(x => !x.word?.trim() || !x.meaning?.trim() || !x.example?.trim())) throw new AppError(400, 'INVALID_VOCABULARY', 'Every word needs a meaning and example.');
  const item = await DailyLearning.findOneAndUpdate(
    { date },
    { $set: { currentAffairs, vocabulary, published: Boolean(published), publishedAt: published ? new Date() : null, updatedBy: req.user._id }, $setOnInsert: { createdBy: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await AuditLog.create({ actor: req.user._id, actorRole: req.user.role, action: 'DAILY_LEARNING_SAVED', targetType: 'DailyLearning', targetId: String(item._id), summary: `Saved Daily Learning for ${date} (${item.published ? 'published' : 'draft'})` });
  success(res, item);
};
module.exports = { publicToday, list, get, save };
