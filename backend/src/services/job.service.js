const { Job, Board, AuditLog } = require('../models');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { pagination, pageMeta } = require('../utils/pagination');
const { AppError } = require('../utils/http');
const { slugify } = require('./source.service');
const { isYoutubeUrl } = require('../utils/urls');
function filtersFrom(query) {
  const filter = { status: 'PUBLISHED' };
  for (const key of ['category','location','qualification','organization']) if (query[key]) filter[key] = new RegExp(`^${escapeRegex(query[key])}$`, 'i');
  if (query.board) filter.board = query.board;
  if (query.tag) filter.tags = query.tag.toLowerCase();
  if (query.salary) filter.salary = new RegExp(`^${escapeRegex(query.salary)}$`, 'i');
  if (query.excludeJobId && mongoose.isValidObjectId(query.excludeJobId)) filter._id = { $ne: new mongoose.Types.ObjectId(query.excludeJobId) };
  if (query.deadlineBefore) filter.applicationDeadline = { ...filter.applicationDeadline, $lte: new Date(query.deadlineBefore) };
  if (query.deadlineAfter) filter.applicationDeadline = { ...filter.applicationDeadline, $gte: new Date(query.deadlineAfter) };
  if (query.status && ['ADMIN','SUPER_ADMIN','AUTHOR'].includes(query._role)) filter.status = query.status;
  return filter;
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
async function list(query, role) {
  const { page, limit, skip } = pagination(query); const q = (query.q || '').trim();
  const filter = filtersFrom({ ...query, _role: role });
  if (query.board && !/^[a-f\d]{24}$/i.test(query.board)) { const board = await Board.findOne({ slug: query.board.toLowerCase() }).select('_id'); filter.board = board?._id || new mongoose.Types.ObjectId(); }
  if (q) {
    const stages = [{ $search: { index: 'jobs_search', compound: { must: [{ text: { query: q, path: ['title','organization','boardName','tags','category','qualification','location','description'] } }], filter: role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'AUTHOR' ? [{ equals: { path: 'status', value: filter.status } }] : [{ equals: { path: 'status', value: 'PUBLISHED' } }] } } }, { $match: Object.fromEntries(Object.entries(filter).filter(([key]) => key !== 'status')) }, { $sort: { applicationDeadline: 1, _id: 1 } }, { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'count' }] } }];
    try { const [result] = await Job.aggregate(stages); const total = result?.total[0]?.count || 0; return { data: result?.data || [], pagination: pageMeta(page, limit, total) }; }
    catch (error) { if (error.codeName === 'AtlasSearchIndexNotFound' || /search index/i.test(error.message)) throw new AppError(503, 'SEARCH_NOT_CONFIGURED', 'MongoDB Atlas Search index jobs_search is not configured.'); throw error; }
  }
  const [data, total] = await Promise.all([Job.find(filter).populate('board','name slug').sort({ applicationDeadline: 1, _id: 1 }).skip(skip).limit(limit).lean(), Job.countDocuments(filter)]);
  return { data, pagination: pageMeta(page, limit, total) };
}
async function related(jobId, limit = 3) {
  if (!mongoose.isValidObjectId(jobId)) throw new AppError(400, 'INVALID_ID', 'Invalid job id.');
  const current = await Job.findOne({ _id: jobId, status: { $in: ['PUBLISHED','EXPIRED'] } }).select('board category organization tags').lean();
  if (!current) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  const or = [];
  if (current.board) or.push({ board: current.board });
  if (current.category) or.push({ category: new RegExp(`^${escapeRegex(current.category)}$`, 'i') });
  if (current.organization) or.push({ organization: new RegExp(`^${escapeRegex(current.organization)}$`, 'i') });
  if (current.tags?.length) or.push({ tags: { $in: current.tags } });
  if (!or.length) return [];
  const candidates = await Job.find({ status: 'PUBLISHED', _id: { $ne: current._id }, $or: or })
    .populate('board', 'name slug').sort({ applicationDeadline: 1, _id: 1 }).limit(100).lean();
  return rankRelated(current, candidates, limit);
}
function rankRelated(current, candidates, limit = 3) {
  const tags = new Set((current.tags || []).map(tag => String(tag).toLowerCase()));
  const score = item => (current.board && String(item.board?._id || item.board) === String(current.board) ? 8 : 0)
    + (current.category && item.category?.toLowerCase() === current.category.toLowerCase() ? 4 : 0)
    + (current.organization && item.organization?.toLowerCase() === current.organization.toLowerCase() ? 2 : 0)
    + (item.tags || []).filter(tag => tags.has(String(tag).toLowerCase())).length;
  return candidates.filter(item => String(item._id) !== String(current._id) && item.status === 'PUBLISHED')
    .sort((a,b) => score(b)-score(a)).slice(0, Math.min(3, limit));
}
function makeSlug(title) {
  const value = String(title || '').trim();
  return value ? `${slugify(value)}-${Date.now().toString(36)}` : `draft-${new mongoose.Types.ObjectId().toString()}`;
}
function mergeContentTranslations(current, updates) {
  const currentValues = typeof current?.toObject === 'function' ? current.toObject() : current || {};
  const merged = { ...currentValues };
  for (const [locale, values] of Object.entries(updates || {})) {
    merged[locale] = { ...(currentValues[locale] || {}), ...values };
  }
  return merged;
}
const REPEATER_FIELDS = {
  importantDates: 'importantDates', vacancyBreakdown: 'vacancyBreakdown', ageRelaxations: 'ageRelaxations',
  applicationFees: 'applicationFees', qualifications: 'qualifications', experienceRequirements: 'experienceRequirements',
  selectionStages: 'selectionStages', importantLinks: 'importantLinks', documentsRequired: 'documentsRequired',
  importantInstructions: 'importantInstructions', posts: 'posts', postGroups: 'postGroups',
};
const POST_REPEATER_FIELDS = ['categoryVacancyBreakdown', 'qualifications', 'experienceRequirements'];
const makeTranslationId = () => randomUUID();
function sourceTranslationIds(job, field) {
  if (field === 'selectionProcess') return job.selectionProcessTranslationIds || [];
  if (field === 'howToApplySteps') return job.howToApplyStepTranslationIds || [];
  return (job[field] || []).map(item => item?.translationId);
}
function ensureSourceTranslationIds(job, previous = {}) {
  const next = job;
  const ensureObjectRows = field => {
    if (!Array.isArray(next[field])) return;
    next[field] = next[field].map((row, index) => ({
      ...row,
      translationId: row.translationId || previous[field]?.[index]?.translationId || makeTranslationId(),
    }));
  };
  for (const field of Object.keys(REPEATER_FIELDS)) ensureObjectRows(field);
  for (const [field, idsField] of [['selectionProcess', 'selectionProcessTranslationIds'], ['howToApplySteps', 'howToApplyStepTranslationIds']]) {
    if (!Array.isArray(next[field])) continue;
    const supplied = next[idsField];
    next[idsField] = next[field].map((_, index) => supplied?.[index] || previous[idsField]?.[index] || makeTranslationId());
  }
  if (Array.isArray(next.posts)) next.posts = next.posts.map((post, postIndex) => {
    const oldPost = previous.posts?.find(item => item.translationId && item.translationId === post.translationId) || previous.posts?.[postIndex];
    const updated = { ...post, translationId: post.translationId || oldPost?.translationId || makeTranslationId() };
    for (const field of POST_REPEATER_FIELDS) if (Array.isArray(updated[field])) updated[field] = updated[field].map((row, index) => ({
      ...row,
      translationId: row.translationId || oldPost?.[field]?.[index]?.translationId || makeTranslationId(),
    }));
    return updated;
  });
  return next;
}
function normalizeTranslationRows(localeValues = {}, job = {}) {
  const result = { ...localeValues };
  for (const [sourceField, translationField] of Object.entries(REPEATER_FIELDS)) {
    const source = job[sourceField] || [];
    const values = localeValues[translationField];
    if (!Array.isArray(values)) continue;
    const byId = new Map(values.filter(item => item && typeof item === 'object' && item.translationId).map(item => [item.translationId, item]));
    result[translationField] = source.map((item, index) => {
      const previous = byId.get(item.translationId) || values[index];
      return previous && typeof previous === 'object'
        ? { ...previous, translationId: item.translationId }
        : { translationId: item.translationId };
    });
  }
  for (const [sourceField, idsField, translationField] of [
    ['selectionProcess', 'selectionProcessTranslationIds', 'selectionProcess'],
    ['howToApplySteps', 'howToApplyStepTranslationIds', 'howToApplySteps'],
  ]) {
    const values = localeValues[translationField];
    if (!Array.isArray(values)) continue;
    const ids = sourceTranslationIds(job, sourceField);
    const byId = new Map(values.filter(item => item && typeof item === 'object' && item.translationId).map(item => [item.translationId, item.text]));
    result[translationField] = (job[sourceField] || []).map((_, index) => ({
      translationId: ids[index],
      text: byId.has(ids[index]) ? byId.get(ids[index]) : typeof values[index] === 'string' ? values[index] : values[index]?.text || '',
    }));
    if (!ids.length) delete result[translationField];
  }
  if (Array.isArray(job.posts) && Array.isArray(localeValues.posts)) {
    const oldPostRows = localeValues.posts;
    result.posts = job.posts.map((post, postIndex) => {
      const previous = oldPostRows.find(item => item?.translationId && item.translationId === post.translationId) || oldPostRows[postIndex] || {};
      const translated = { ...previous, translationId: post.translationId };
      for (const field of POST_REPEATER_FIELDS) {
        const sourceRows = post[field] || [];
        const translatedRows = previous[field] || [];
        const byId = new Map(translatedRows.filter(item => item?.translationId).map(item => [item.translationId, item]));
        if (translatedRows.length || sourceRows.some(item => item.translationId)) translated[field] = sourceRows.map((item, index) => ({
          ...(byId.get(item.translationId) || translatedRows[index] || {}),
          translationId: item.translationId,
        }));
      }
      return translated;
    });
  }
  return result;
}
function normalizeJobTranslationIdentity(job, previous = {}) {
  ensureSourceTranslationIds(job, previous);
  if (job.contentTranslations) {
    const current = typeof job.contentTranslations.toObject === 'function' ? job.contentTranslations.toObject() : job.contentTranslations;
    job.contentTranslations = Object.fromEntries(Object.entries(current).map(([locale, values]) => [locale, normalizeTranslationRows(values, job)]));
  }
  return job;
}
async function create(input, user) {
  const postIds = new Set((input.posts || []).map(post => String(post._id || '')).filter(Boolean));
  for (const field of input.conditionalFields || []) for (const entry of field.entries || []) if (entry.postId && !postIds.has(String(entry.postId))) throw new AppError(400, 'INVALID_CONDITIONAL_POST', 'Conditional values must reference a post included in this recruitment.');
  if (input.howToApplyYoutubeUrl && !isYoutubeUrl(input.howToApplyYoutubeUrl)) throw new AppError(400, 'INVALID_YOUTUBE_URL', 'Use a YouTube URL for how-to-apply videos.');
  const board = input.board ? await Board.findById(input.board) : null; if (input.board && !board) throw new AppError(400, 'INVALID_BOARD', 'Board does not exist.');
  const created=await Job.create({ ...input, contentTranslations: input.contentTranslations, board: board?._id, boardName: board?.name, slug: makeSlug(input.title), author: user._id, status: 'DRAFT', verificationStatus: 'UNVERIFIED' });
  AuditLog.create({actor:user._id,actorRole:user.role,action:'job.created',targetType:'Job',targetId:String(created._id),summary:`Created draft ${created.title || 'Untitled Draft'}`}).catch(()=>{});return created;
}
async function update(jobId, input, user) {
  const job = await Job.findById(jobId); if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  if (user.role === 'AUTHOR' && String(job.author) !== String(user._id)) throw new AppError(403, 'FORBIDDEN', 'Authors can edit only their own jobs.');
  if (user.role === 'AUTHOR' && job.status !== 'DRAFT' && job.status !== 'REJECTED') throw new AppError(409, 'JOB_LOCKED', 'Only draft or rejected jobs may be edited.');
  if(input.howToApplyYoutubeUrl&&!isYoutubeUrl(input.howToApplyYoutubeUrl))throw new AppError(400,'INVALID_YOUTUBE_URL','Use a YouTube URL for how-to-apply videos.');
  if (['PUBLISHED', 'EXPIRED'].includes(job.status)) {
    const nextTitle = Object.prototype.hasOwnProperty.call(input, 'title') ? input.title : job.title;
    const nextOrganization = Object.prototype.hasOwnProperty.call(input, 'organization') ? input.organization : job.organization;
    if (!nextTitle?.trim() || !nextOrganization?.trim())
      throw new AppError(400, 'JOB_METADATA_REQUIRED', 'Published jobs must keep a job title and recruiting organization.');
  }
  const postIds = new Set((input.posts || job.posts || []).map(post => String(post._id || post._id?.toString?.() || '')).filter(Boolean));
  for (const field of input.conditionalFields || []) for (const entry of field.entries || []) if (entry.postId && !postIds.has(String(entry.postId))) throw new AppError(400, 'INVALID_CONDITIONAL_POST', 'Conditional values must reference a post included in this recruitment.');
  const hasBoard = Object.prototype.hasOwnProperty.call(input, 'board');
  const board = hasBoard && input.board ? await Board.findById(input.board) : null;
  if (hasBoard && input.board && !board) throw new AppError(400, 'INVALID_BOARD', 'Board does not exist.');
  const existingContentTranslations = job.contentTranslations;
  Object.assign(job, input);
  if (Object.prototype.hasOwnProperty.call(input, 'contentTranslations'))
    job.contentTranslations = mergeContentTranslations(existingContentTranslations, input.contentTranslations);
  if (hasBoard) { job.board = board?._id; job.boardName = board?.name; }
  if (input.title) job.slug = makeSlug(input.title); await job.save(); return job;
}
async function submitReview(jobId, user) {
  const job = await Job.findById(jobId); if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  if (!['ADMIN','SUPER_ADMIN'].includes(user.role) && String(job.author) !== String(user._id)) throw new AppError(403, 'FORBIDDEN', 'You cannot submit this job.');
  if (!['DRAFT','REJECTED'].includes(job.status)) throw new AppError(409, 'INVALID_WORKFLOW', 'Only draft or rejected jobs can be submitted.');
  const documentText = (nodes = []) => nodes.reduce((text, node) => text + (node.text || '') + documentText(node.content || []), '');
  const hasArticle = documentText(job.contentDocument || []).trim() || job.description?.trim() || (job.contentBlocks || []).length || (job.contentSections || []).some(section => section.blocks?.length);
  if (!hasArticle) throw new AppError(400, 'JOB_CONTENT_REQUIRED', 'Add article content before submitting for review.');
  job.status = 'PENDING_REVIEW'; job.rejectionReason = undefined; await job.save();
  AuditLog.create({actor:user._id,actorRole:user.role,action:'job.submitted',targetType:'Job',targetId:String(job._id),summary:`Submitted ${job.title} for review`}).catch(()=>{});return job;
}
async function review(jobId, reviewer, action, reason) {
  const job = await Job.findById(jobId); if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  if (job.status !== 'PENDING_REVIEW' && !(action === 'publish' && job.status === 'APPROVED') && action !== 'unpublish') throw new AppError(409, 'INVALID_WORKFLOW', 'Job is not pending review or approved.');
  if (['approve', 'publish'].includes(action) && (!job.title?.trim() || !job.organization?.trim()))
    throw new AppError(400, 'JOB_METADATA_REQUIRED', 'Add a job title and recruiting organization before approving or publishing.');
  job.reviewedBy = reviewer._id;
  job.reviewedAt = new Date();
  if (action === 'approve') job.status = 'APPROVED';
  else if (action === 'publish') { job.status = 'PUBLISHED'; job.publishedBy = reviewer._id; job.publishedAt = new Date(); job.verificationStatus = 'VERIFIED'; }
  else if (action === 'reject') { job.status = 'REJECTED'; job.rejectionReason = reason || 'Please review and correct the submitted details.'; }
  else if (action === 'unpublish') job.status = 'ARCHIVED';
  await job.save();
  const verb={approve:'approved',publish:'published',reject:'rejected',unpublish:'unpublished'}[action]||action;
  AuditLog.create({actor:reviewer._id,actorRole:reviewer.role,action:`job.${action}`,targetType:'Job',targetId:String(job._id),summary:`${verb} ${job.title}${action==='reject'?`: ${job.rejectionReason}`:''}`.slice(0,500)}).catch(()=>{});return job;
}
async function fetchExpired() { return Job.updateMany({ status: 'PUBLISHED', applicationDeadline: { $lt: new Date() } }, { $set: { status: 'EXPIRED' } }); }
module.exports = { list, related, rankRelated, create, update, submitReview, review, fetchExpired, makeSlug, mergeContentTranslations };
