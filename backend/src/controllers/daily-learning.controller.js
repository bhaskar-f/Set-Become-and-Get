const DailyLearning = require('../models/daily-learning.model');
const { success, AppError } = require('../utils/http');
const { AuditLog } = require('../models');
const { env } = require('../config/env');
const cloudinary = require('cloudinary').v2;
const researchedToday = require('../data/daily-learning-today.json');
const DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const publicToday = async (req, res) => {
  const date = today();
  const item = await DailyLearning.findOne({ date, published: true }).lean();

  // The reviewed content shipped with the app is the public fallback for its
  // matching date. Without this, visitors see an empty deck until an admin
  // manually republishes the same content into MongoDB.
  if (item) {
    return success(res, { date, currentAffairs: item.currentAffairs, vocabulary: item.vocabulary });
  }
  if (researchedToday.date === date) {
    return success(res, {
      date,
      currentAffairs: researchedToday.currentAffairs,
      vocabulary: researchedToday.vocabulary,
    });
  }
  return success(res, null);
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

const uploadImage = async (req, res) => {
  if (!req.file) throw new AppError(400, 'IMAGE_REQUIRED', 'Choose an image to upload.');
  const b=req.file.buffer, png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), jpeg=b[0]===255&&b[1]===216&&b[2]===255, webp=b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if (!png&&!jpeg&&!webp) throw new AppError(400,'INVALID_IMAGE','Choose a valid PNG, JPEG or WebP image.');
  if (!env.cloudinaryName||!env.cloudinaryKey||!env.cloudinarySecret) throw new AppError(503,'UPLOAD_PROVIDER_NOT_CONFIGURED','Image upload is unavailable. Paste an HTTPS image URL instead.');
  cloudinary.config({cloud_name:env.cloudinaryName,api_key:env.cloudinaryKey,api_secret:env.cloudinarySecret,secure:true});
  const result=await new Promise((resolve,reject)=>cloudinary.uploader.upload_stream({folder:'setbget/daily-learning',resource_type:'image',allowed_formats:['png','jpg','jpeg','webp'],max_bytes:5*1024*1024},(err,data)=>err?reject(err):resolve(data)).end(b));
  if(!result?.secure_url) throw new AppError(502,'IMAGE_UPLOAD_FAILED','Image upload failed. Please try again.');
  success(res,{url:result.secure_url},201);
};

module.exports = { publicToday, list, get, save, uploadImage };
