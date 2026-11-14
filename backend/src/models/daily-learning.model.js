const mongoose = require('mongoose');
const { Schema } = mongoose;
const currentAffairSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 240 },
  summary: { type: String, required: true, trim: true, maxlength: 1800 },
  takeaway: { type: String, trim: true, maxlength: 500 },
  source: { type: String, trim: true, maxlength: 240 },
  sourceUrl: { type: String, trim: true, maxlength: 1000 },
}, { _id: true });
const vocabularySchema = new Schema({
  word: { type: String, required: true, trim: true, maxlength: 80 },
  partOfSpeech: { type: String, trim: true, maxlength: 40 },
  meaning: { type: String, required: true, trim: true, maxlength: 500 },
  example: { type: String, required: true, trim: true, maxlength: 700 },
  synonyms: { type: String, trim: true, maxlength: 240 },
}, { _id: true });
const dailyLearningSchema = new Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  currentAffairs: { type: [currentAffairSchema], default: [] },
  vocabulary: { type: [vocabularySchema], default: [] },
  published: { type: Boolean, default: false },
  publishedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
dailyLearningSchema.index({ date: 1 }, { unique: true });
module.exports = mongoose.models.DailyLearning || mongoose.model('DailyLearning', dailyLearningSchema);
