const mongoose = require('mongoose');
const { ROLES, JOB_STATUSES, APPLICATION_STATUSES } = require('../constants');
const { Schema } = mongoose;
const schema = (definition, options = {}) => new Schema(definition, { timestamps: true, ...options });
const ref = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const resourceRef = { type: Schema.Types.ObjectId, ref: 'Resource' };
const translationId = { type: String, match: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i };

const dateEntry = new Schema({ translationId, event: String, date: Date, description: String }, { _id: false });
const vacancyEntry = new Schema({ translationId, post: String, vacancyCount: Number, notes: String }, { _id: false });
const categoryVacancy = new Schema({ translationId, category: String, vacancyCount: Number, notes: String }, { _id: false });
const ageRelaxation = new Schema({ translationId, category: String, relaxation: String, notes: String }, { _id: false });
const feeEntry = new Schema({ translationId, category: String, fee: String, notes: String }, { _id: false });
const qualificationEntry = new Schema({ translationId, name: String, field: String, condition: { type: String, enum: ['ALL','ANY_ONE','OPTIONAL'] }, additionalRequirement: String, minimumMarks: String, notes: String }, { _id: false });
const experienceEntry = new Schema({ translationId, minimumExperience: String, domain: String, description: String }, { _id: false });
const selectionComponent = new Schema({ name: String, maximumMarks: Number, qualifyingMarks: Number, qualifyingPercentage: Number, qualifyingOnly: Boolean }, { _id: false });
const selectionStage = new Schema({ translationId, name: String, description: String, maximumMarks: Number, qualifyingMarks: Number, qualifyingPercentage: Number, duration: String, weightage: String, components: [selectionComponent] }, { _id: false });
const salaryInfo = new Schema({ payLevel: String, payScale: String, gradePay: String, minimum: String, maximum: String, description: String }, { _id: false });
const importantLink = new Schema({ translationId, label: String, url: String, description: String }, { _id: false });
const contentBlock = new Schema({ type: { type: String, enum: ['paragraph','heading','bulletList','numberedList','steps','table','keyValueList','callout','link','externalLink','youtube','image','divider'] }, data: Schema.Types.Mixed }, { _id: false });
const contentSection = new Schema({ title: { type: String, maxlength: 160 }, blocks: [contentBlock] }, { _id: false });
const conditionalEntry = new Schema({ postId: { type: Schema.Types.ObjectId }, category: String, value: String }, { _id: false });
const conditionalField = new Schema({ field: { type: String, enum: ['vacancyCount','qualification','ageLimit','salary','applicationFee','location','experience','selectionProcess'] }, mode: { type: String, enum: ['COMMON','VARIES'] }, entries: [conditionalEntry] }, { _id: false });
const translatedDateEntry = new Schema({ translationId, description: String }, { _id: false });
const translatedNotesEntry = new Schema({ translationId, notes: String }, { _id: false });
const translatedQualificationEntry = new Schema({ translationId, additionalRequirement: String, notes: String }, { _id: false });
const translatedExperienceEntry = new Schema({ translationId, description: String }, { _id: false });
const translatedSelectionStage = new Schema({ translationId, description: String }, { _id: false });
const translatedSalaryInfo = new Schema({ description: String }, { _id: false });
const translatedImportantLink = new Schema({ translationId, description: String }, { _id: false });
const translatedDocument = new Schema({ translationId, description: String }, { _id: false });
const translatedInstruction = new Schema({ translationId, text: String }, { _id: false });
const translatedTextEntry = new Schema({ translationId, text: String }, { _id: false });
const translatedRecruitmentPost = new Schema({
  translationId,
  ageDescription: String,
  categoryVacancyBreakdown: { type: [translatedNotesEntry], default: undefined },
  qualifications: { type: [translatedQualificationEntry], default: undefined },
  experienceRequirements: { type: [translatedExperienceEntry], default: undefined },
  additionalRequirements: String,
  postSpecificNotes: String,
}, { _id: false });
const translatedPostGroup = new Schema({ description: String }, { _id: false });
const translatedJobContent = new Schema({
  description: String,
  qualification: String,
  ageRelaxation: String,
  ageDescription: String,
  selectionProcess: { type: [translatedTextEntry], default: undefined },
  importantDates: { type: [translatedDateEntry], default: undefined },
  vacancyBreakdown: { type: [translatedNotesEntry], default: undefined },
  ageRelaxations: { type: [translatedNotesEntry], default: undefined },
  applicationFees: { type: [translatedNotesEntry], default: undefined },
  qualifications: { type: [translatedQualificationEntry], default: undefined },
  experienceRequirements: { type: [translatedExperienceEntry], default: undefined },
  selectionStages: { type: [translatedSelectionStage], default: undefined },
  salaryInfo: translatedSalaryInfo,
  howToApplySteps: { type: [translatedTextEntry], default: undefined },
  importantLinks: { type: [translatedImportantLink], default: undefined },
  documentsRequired: { type: [translatedDocument], default: undefined },
  importantInstructions: { type: [translatedInstruction], default: undefined },
  posts: { type: [translatedRecruitmentPost], default: undefined },
  postGroups: { type: [translatedPostGroup], default: undefined },
  contentDocument: { type: Map, of: String, default: undefined },
}, { _id: false, strict: 'throw' });
const contentTranslations = new Schema({
  hi: { type: translatedJobContent },
  bn: { type: translatedJobContent },
}, { _id: false, strict: 'throw' });
const recruitmentPost = new Schema({
  translationId,
  name: String, code: String, groupName: String, vacancyCount: Number,
  categoryVacancyBreakdown: [categoryVacancy], ageMin: Number, ageMax: Number, ageCutoffDate: Date, ageDescription: String,
  qualifications: [qualificationEntry], experienceRequirements: [experienceEntry], mandatoryCertifications: [String], preferredCertifications: [String],
  minimumMarks: String, salary: salaryInfo, selectionRequirements: [String], additionalRequirements: String, postSpecificNotes: String,
}, { _id: true });
const postGroup = new Schema({ translationId, name: String, description: String, totalVacancies: Number }, { _id: false });

const User = mongoose.model('User', schema({
  name: { type: String, required: true, trim: true, maxlength: 100 }, email: { type: String, lowercase: true, trim: true },
  phoneNumber: { type: String, trim: true }, passwordHash: { type: String, select: false }, profilePicture: String,
  dateOfBirth: Date,
  preferences: { education: { level: String, degrees: [String], fields: [String], graduationStatus: String, graduationYear: Number }, location: { state: String, district: String }, jobCategories: [String], preferredBoards: [String] },
  role: { type: String, enum: Object.values(ROLES), default: ROLES.USER }, education: String, preferredExams: [String], preferredJobCategories: [String], location: String,
  isEmailVerified: { type: Boolean, default: false }, isPhoneVerified: { type: Boolean, default: false }, isActive: { type: Boolean, default: true }, authTokenVersion: { type: Number, default: 0 },
  googleId: { type: String, sparse: true, unique: true }, pendingEmail: { type: String, lowercase: true, trim: true }, emailVerificationHash: String, emailVerificationExpires: Date, passwordResetHash: String, passwordResetExpires: Date,
  refreshTokenHash: String
}));
User.schema.index({ email: 1 }, { unique: true, sparse: true }); User.schema.index({ phoneNumber: 1 }, { unique: true, sparse: true });

const Board = mongoose.model('Board', schema({ name: { type: String, required: true, trim: true, maxlength: 120 }, slug: { type: String, required: true, unique: true, lowercase: true, trim: true }, shortDescription: { type: String, maxlength: 300 }, description: { type: String, maxlength: 10000 }, about: { type: String, maxlength: 10000 }, organization: { type: String, maxlength: 160 }, category: { type: String, maxlength: 100, lowercase: true, trim: true }, officialWebsite: String, officialNotificationWebsite: String, location: { type: String, maxlength: 160 }, icon: { type: String, maxlength: 500 }, active: { type: Boolean, default: true } }));
Board.schema.index({ active: 1, name: 1 });
const Job = mongoose.model('Job', schema({
  title: { type: String, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true }, organization: { type: String, trim: true }, board: ref('Board', false), boardName: String, category: String, tags: [String], description: String, vacancyCount: Number,
  applicationStartDate: Date, applicationDeadline: Date, examDate: Date, qualification: String, ageMin: Number, ageMax: Number, ageRelaxation: String, location: String, salary: String,
  selectionProcess: [String], applicationFee: Schema.Types.Mixed, categoryEligibility: [String], genderEligibility: String, officialWebsite: String, officialNotificationUrl: String, officialApplyUrl: String,
  howToApplyYoutubeUrl: String, syllabusResources: [resourceRef], pyqResources: [resourceRef], studyResources: [resourceRef], mockTestResources: [resourceRef], otherResources: [resourceRef],
  importantDates: [dateEntry], vacancyBreakdown: [vacancyEntry], ageCutoffDate: Date, ageDescription: String,
  ageRelaxations: [ageRelaxation], applicationFees: [feeEntry], qualifications: [qualificationEntry],
  selectionStages: [selectionStage], salaryInfo, howToApplySteps: [String], importantLinks: [importantLink],
  contentDocument: [Schema.Types.Mixed], contentBlocks: [contentBlock], contentSections: [contentSection], conditionalFields: [conditionalField], documentsRequired: [{ translationId, name: String, description: String, required: Boolean }],
  importantInstructions: [{ translationId, text: String, category: String }], posts: [recruitmentPost], postGroups: [postGroup],
  selectionProcessTranslationIds: { type: [String], default: undefined }, howToApplyStepTranslationIds: { type: [String], default: undefined },
  contentTranslations: { type: contentTranslations, default: undefined },
  source: ref('RecruitmentSource', false), sourceUrl: String, sourceExternalId: String, status: { type: String, enum: JOB_STATUSES, default: 'DRAFT' }, verificationStatus: { type: String, enum: ['UNVERIFIED','PENDING','VERIFIED','REJECTED'], default: 'UNVERIFIED' },
  author: ref('User', false), reviewedBy: ref('User', false), reviewedAt: Date, publishedBy: ref('User', false), publishedAt: Date, rejectionReason: String, rawSourceReference: String
}));
Job.schema.index({ board: 1, status: 1, applicationDeadline: 1 }); Job.schema.index({ organization: 1, status: 1 }); Job.schema.index({ source: 1, sourceExternalId: 1 }, { unique: true, sparse: true }); Job.schema.index({ officialNotificationUrl: 1 }, { sparse: true });

const SavedJob = mongoose.model('SavedJob', schema({ user: ref('User'), job: ref('Job') })); SavedJob.schema.index({ user: 1, job: 1 }, { unique: true });
const Application = mongoose.model('Application', schema({ user: ref('User'), job: ref('Job'), status: { type: String, enum: APPLICATION_STATUSES, default: 'NOT_APPLIED' }, appliedAt: Date, examDate: Date, result: String, notes: { type: String, maxlength: 3000 }, reminderDate: Date, reminderSentAt: Date }, { timestamps: true }));
Application.schema.index({ user: 1, job: 1 }, { unique: true }); Application.schema.index({ reminderDate: 1, reminderSentAt: 1 });

const Community = mongoose.model('Community', schema({ name: { type: String, required: true }, slug: { type: String, unique: true, required: true }, description: String, board: ref('Board', false), exam: String, active: { type: Boolean, default: true } }));
const CommunityMember = mongoose.model('CommunityMember', schema({ user: ref('User'), community: ref('Community'), role: { type: String, enum: ['MEMBER','MODERATOR'], default: 'MEMBER' }, joinedAt: { type: Date, default: Date.now } })); CommunityMember.schema.index({ user: 1, community: 1 }, { unique: true });
const Post = mongoose.model('Post', schema({ community: ref('Community'), author: ref('User'), title: { type: String, required: true, maxlength: 180 }, body: { type: String, required: true, maxlength: 10000 }, status: { type: String, enum: ['ACTIVE','REMOVED'], default: 'ACTIVE' }, likeCount: { type: Number, default: 0 } })); Post.schema.index({ community: 1, createdAt: -1 });
const Comment = mongoose.model('Comment', schema({ post: ref('Post'), author: ref('User'), body: { type: String, required: true, maxlength: 3000 }, status: { type: String, enum: ['ACTIVE','REMOVED'], default: 'ACTIVE' } })); Comment.schema.index({ post: 1, createdAt: 1 });
const Reaction = mongoose.model('Reaction', schema({ post: ref('Post'), user: ref('User'), type: { type: String, enum: ['UPVOTE'], default: 'UPVOTE' } })); Reaction.schema.index({ post: 1, user: 1 }, { unique: true });
const Report = mongoose.model('Report', schema({ reporter: ref('User'), targetType: { type: String, enum: ['Post','Comment'], required: true }, target: { type: Schema.Types.ObjectId, required: true }, reason: { type: String, required: true }, description: String, status: { type: String, enum: ['OPEN','REVIEWED','DISMISSED','ACTIONED'], default: 'OPEN' }, reviewedBy: ref('User', false), reviewedAt: Date })); Report.schema.index({ status: 1, createdAt: 1 });

const Resource = mongoose.model('Resource', schema({ title: { type: String, required: true }, type: { type: String, enum: ['SYLLABUS','PYQ','MOCK_TEST','STUDY_MATERIAL','HOW_TO_APPLY','OTHER'], required: true }, description: String, sourceType: { type: String, enum: ['EXTERNAL_URL','UPLOAD'] }, externalUrl: String, accessMode: { type: String, enum: ['INLINE','DOWNLOAD'] }, fileName: String, url: String, youtubeUrl: String, cloudinaryUrl: String, cloudinaryPublicId: String, cloudinaryResourceType: String, mimeType: String, size: Number, board: ref('Board', false), job: ref('Job', false), exam: String, community: ref('Community', false), author: ref('User', false), active: { type: Boolean, default: true } }));
const Notification = mongoose.model('Notification', schema({ user: ref('User', false), type: { type: String, required: true }, title: { type: String, required: true }, message: String, relatedJob: ref('Job', false), relatedApplication: ref('Application', false), relatedBoard: ref('Board', false), dedupeKey: String, readByUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }], published: { type: Boolean, default: true }, read: { type: Boolean, default: false }, channelsSent: [String] })); Notification.schema.index({ user: 1, published: 1, read: 1, createdAt: -1 }); Notification.schema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
const NotificationPreference = mongoose.model('NotificationPreference', schema({ user: { ...ref('User'), unique: true }, email: { type: Boolean, default: true }, sms: { type: Boolean, default: false }, website: { type: Boolean, default: true }, jobMatches: { type: Boolean, default: true }, deadlineReminders: { type: Boolean, default: true }, announcements: { type: Boolean, default: true } }));
const OtpThrottle = mongoose.model('OtpThrottle', schema({ phoneHash: { type: String, unique: true, required: true }, lastRequestedAt: Date, windowStartedAt: Date, requestCount: { type: Number, default: 0 }, expiresAt: { type: Date, expires: 0 } }, { timestamps: true }));
const FAQ = mongoose.model('FAQ', schema({ question: { type: String, required: true }, answer: { type: String, required: true }, order: { type: Number, default: 0 }, active: { type: Boolean, default: true } }));
const RecruitmentSource = mongoose.model('RecruitmentSource', schema({ name: { type: String, required: true }, organization: String, board: ref('Board', false), websiteUrl: String, isOfficial: { type: Boolean, default: false }, sourceType: { type: String, enum: ['API','RSS','STATIC_HTML','JAVASCRIPT_SITE','PDF','MANUAL'], default: 'MANUAL' }, active: { type: Boolean, default: false }, fetchInterval: { type: Number, default: 24 }, lastFetchedAt: Date, nextFetchAt: Date, lastSuccessAt: Date, lastFailureAt: Date, lastError: String, lastFetchedItemCount: { type: Number, default: 0 }, parserType: String, configuration: Schema.Types.Mixed }));
const discoveryHistory = new Schema({ status: { type: String, enum: ['DISCOVERED','DUPLICATE','PENDING_REVIEW','ERROR','MATCHED'], required: true }, actor: ref('User', false), note: { type: String, maxlength: 300 }, at: { type: Date, default: Date.now } }, { _id: false });
const JobDiscovery = mongoose.model('JobDiscovery', schema({ source: ref('RecruitmentSource'), sourceUrl: { type: String, required: true }, externalId: String, rawTitle: String, rawContent: String, extractedData: Schema.Types.Mixed, fingerprint: { type: String, required: true }, discoveredAt: { type: Date, default: Date.now }, processingStatus: { type: String, enum: ['DISCOVERED','DUPLICATE','PENDING_REVIEW','ERROR','MATCHED'], default: 'DISCOVERED' }, matchedJob: ref('Job', false), error: String, reviewedBy: ref('User', false), reviewedAt: Date, processingHistory: { type: [discoveryHistory], default: [] } }, { timestamps: true }));
JobDiscovery.schema.index({ fingerprint: 1 }, { unique: true }); JobDiscovery.schema.index({ source: 1, sourceUrl: 1 }); JobDiscovery.schema.index({ processingStatus: 1, discoveredAt: -1 });

const AuthorAsset = mongoose.model('AuthorAsset', schema({
  author: ref('User'), type: { type: String, enum: ['TEMPLATE','SAVED_SECTION'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 }, description: { type: String, maxlength: 500 },
  data: { type: Schema.Types.Mixed, default: {} },
}));
AuthorAsset.schema.index({ author: 1, type: 1, updatedAt: -1 });

const AuditLog = mongoose.model('AuditLog', schema({
  actor: ref('User', false), actorRole: { type: String, enum: Object.values(ROLES) }, action: { type: String, required: true, maxlength: 120 },
  targetType: { type: String, maxlength: 80 }, targetId: { type: String, maxlength: 80 }, summary: { type: String, maxlength: 500 }, metadata: { type: Schema.Types.Mixed },
}));
AuditLog.schema.index({ createdAt: -1, _id: -1 });

module.exports = { User, Board, Job, SavedJob, Application, Community, CommunityMember, Post, Comment, Reaction, Report, Resource, Notification, NotificationPreference, OtpThrottle, FAQ, RecruitmentSource, JobDiscovery, AuthorAsset, AuditLog };
