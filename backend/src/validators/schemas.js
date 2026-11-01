const { z } = require('zod');
const qualificationTaxonomy = require('../data/qualification-taxonomy.json');
const jobTaxonomy = require('../data/job-taxonomy.json');
const indiaLocations = require('../data/india-locations.json');
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');
const translationId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Invalid translation item ID');
const url = z.string().url().refine(value => { try { return ['https:','http:'].includes(new URL(value).protocol); } catch { return false; } }, 'URL must use HTTP or HTTPS').optional().or(z.literal(''));
const youtubeUrl = z.string().url().refine(value=>{const host=new URL(value).hostname.toLowerCase();return host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com');},'URL must belong to YouTube').optional().or(z.literal(''));
const register = z.object({ name: z.string().trim().min(1).max(100), email: z.string().email().transform(v => v.toLowerCase()), password: z.string().min(10).max(128), phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/).optional() }).strict();
const login = z.object({ email: z.string().email().transform(v => v.toLowerCase()), password: z.string().min(1).max(128) }).strict();
const profilePreferences = z.object({
  education: z.object({ level: z.enum(qualificationTaxonomy.levels.map(item=>item.id)).optional(), degrees: z.array(z.string().trim().max(100)).max(20).optional(), fields: z.array(z.enum(qualificationTaxonomy.fields)).max(20).optional(), graduationStatus: z.enum(['IN_PROGRESS','COMPLETED','NOT_APPLICABLE']).optional(), graduationYear: z.number().int().min(1950).max(new Date().getFullYear()+10).optional() }).strict().optional(),
  location: z.object({ state: z.string().max(100), district: z.string().max(100).optional() }).strict().optional(),
  jobCategories: z.array(z.enum(jobTaxonomy.categories)).max(40).optional(), preferredBoards: z.array(z.enum(jobTaxonomy.boards)).max(20).optional()
}).strict().superRefine((value,ctx)=>{const education=value.education;if(education?.level&&education.degrees){const level=qualificationTaxonomy.levels.find(item=>item.id===education.level);education.degrees.forEach((degree,index)=>{if(!level.degrees.some(option=>option.toLowerCase()===degree.toLowerCase()))ctx.addIssue({code:z.ZodIssueCode.custom,path:['education','degrees',index],message:'Choose a degree available for the selected education level.'});});}const place=value.location;if(!place)return;const state=indiaLocations.states.find(item=>item.name.toLowerCase()===place.state.trim().toLowerCase());if(!state){ctx.addIssue({code:z.ZodIssueCode.custom,path:['location','state'],message:'Choose a listed Indian state or union territory.'});return;}if(place.district&&!state.districts.some(item=>item.toLowerCase()===place.district.trim().toLowerCase()))ctx.addIssue({code:z.ZodIssueCode.custom,path:['location','district'],message:'Choose a district in the selected state.'});});
const profile = z.object({ name: z.string().trim().min(1).max(100).optional(), profilePicture: url, dateOfBirth: z.coerce.date().max(new Date()).optional(), preferences: profilePreferences.optional(), education: z.string().max(100).optional(), location: z.string().max(100).optional(), preferredExams: z.array(z.string().max(80)).max(30).optional(), preferredJobCategories: z.array(z.string().max(80)).max(30).optional() }).strict();
const verifyEmail = z.object({ token: z.string().min(32).max(256) }).strict();
const forgotPassword = z.object({ email: z.string().email().transform(v=>v.toLowerCase()) }).strict();
const resetPassword = z.object({ token: z.string().min(32).max(256), password: z.string().min(10).max(128) }).strict();
const changePassword = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128) }).strict().superRefine((value, ctx) => { if (value.newPassword !== value.confirmPassword) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match.' }); });
const sendOtp = z.object({ phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/) }).strict();
const verifyOtp = z.object({ phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/), code: z.string().regex(/^\d{4,10}$/), name: z.string().max(100).optional() }).strict();
const phoneLogin = z.object({ phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/), password: z.string().min(1).max(128) }).strict();
const jobBase = z.object({ title: z.string().trim().min(2).max(200), organization: z.string().trim().min(1).max(200), board: id.optional().or(z.literal('')), category: z.string().max(80).optional(), tags: z.array(z.string().max(80)).max(50).optional(), description: z.string().max(20000).optional(), vacancyCount: z.number().int().nonnegative().optional(), applicationStartDate: z.coerce.date().optional(), applicationDeadline: z.coerce.date().optional(), examDate: z.coerce.date().optional(), qualification: z.string().max(500).optional(), ageMin: z.number().min(0).max(120).optional(), ageMax: z.number().min(0).max(120).optional(), ageRelaxation: z.string().max(500).optional(), location: z.string().max(200).optional(), salary: z.string().max(200).optional(), selectionProcess: z.array(z.string().max(200)).max(30).optional(), applicationFee: z.unknown().optional(), categoryEligibility:z.array(z.string().max(120)).max(30).optional(),genderEligibility:z.string().max(120).optional(),syllabusResources:z.array(id).max(100).optional(),pyqResources:z.array(id).max(100).optional(),studyResources:z.array(id).max(100).optional(),mockTestResources:z.array(id).max(100).optional(),otherResources:z.array(id).max(100).optional(), officialWebsite: url, officialNotificationUrl: url, officialApplyUrl: url, howToApplyYoutubeUrl: youtubeUrl, sourceUrl: url }).strict();
const shortText = (max=500) => z.string().max(max);
const dateRow = z.object({ translationId: translationId.optional(), event: shortText(120), date: z.coerce.date().optional(), description: shortText(500).optional() }).strict();
const vacancyRow = z.object({ translationId: translationId.optional(), post: shortText(160), vacancyCount: z.number().int().nonnegative().optional(), notes: shortText(500).optional() }).strict();
const categoryVacancy = z.object({ translationId: translationId.optional(), category: shortText(120), vacancyCount: z.number().int().nonnegative().optional(), notes: shortText(500).optional() }).strict();
const ageRelaxation = z.object({ translationId: translationId.optional(), category: shortText(120), relaxation: shortText(120), notes: shortText(500).optional() }).strict();
const feeRow = z.object({ translationId: translationId.optional(), category: shortText(120), fee: shortText(120), notes: shortText(500).optional() }).strict();
const qualificationRow = z.object({ translationId: translationId.optional(), name: shortText(300), field: shortText(200).optional(), condition: z.enum(['ALL','ANY_ONE','OPTIONAL']).optional(), additionalRequirement: shortText(1000).optional(), minimumMarks: shortText(80).optional(), notes: shortText(500).optional() }).strict();
const experienceRow = z.object({ translationId: translationId.optional(), minimumExperience: shortText(120), domain: shortText(200).optional(), description: shortText(1000).optional() }).strict();
const selectionComponent = z.object({ name: shortText(160), maximumMarks: z.number().nonnegative().optional(), qualifyingMarks: z.number().nonnegative().optional(), qualifyingPercentage: z.number().min(0).max(100).optional(), qualifyingOnly: z.boolean().optional() }).strict();
const selectionStage = z.object({ translationId: translationId.optional(), name: shortText(160), description: shortText(1000).optional(), maximumMarks: z.number().nonnegative().optional(), qualifyingMarks: z.number().nonnegative().optional(), qualifyingPercentage: z.number().min(0).max(100).optional(), duration: shortText(120).optional(), weightage: shortText(80).optional(), components: z.array(selectionComponent).max(30).optional() }).strict();
const salaryInfo = z.object({ payLevel: shortText(120).optional(), payScale: shortText(300).optional(), gradePay: shortText(120).optional(), minimum: shortText(120).optional(), maximum: shortText(120).optional(), description: shortText(1000).optional() }).strict();
const importantLink = z.object({ translationId: translationId.optional(), label: shortText(120), url, description: shortText(500).optional() }).strict();
const jobPost = z.object({ translationId: translationId.optional(), _id: id.optional(), name: shortText(200), code: shortText(80).optional(), groupName: shortText(120).optional(), vacancyCount: z.number().int().nonnegative().optional(), categoryVacancyBreakdown: z.array(categoryVacancy).max(50).optional(), ageMin: z.number().min(0).max(120).optional(), ageMax: z.number().min(0).max(120).optional(), ageCutoffDate: z.coerce.date().optional(), ageDescription: shortText(1000).optional(), qualifications: z.array(qualificationRow).max(50).optional(), experienceRequirements: z.array(experienceRow).max(50).optional(), mandatoryCertifications: z.array(shortText(160)).max(50).optional(), preferredCertifications: z.array(shortText(160)).max(50).optional(), minimumMarks: shortText(80).optional(), salary: salaryInfo.optional(), selectionRequirements: z.array(shortText(300)).max(50).optional(), additionalRequirements: shortText(2000).optional(), postSpecificNotes: shortText(2000).optional() }).strict();
const translatedNotesRow = z.object({ translationId: translationId.optional(), notes: shortText(500).optional() }).strict();
const translatedQualificationRow = z.object({ translationId: translationId.optional(), additionalRequirement: shortText(1000).optional(), notes: shortText(500).optional() }).strict();
const translatedExperienceRow = z.object({ translationId: translationId.optional(), description: shortText(1000).optional() }).strict();
const translatedJobPost = z.object({
  translationId: translationId.optional(),
  ageDescription: shortText(1000).optional(),
  categoryVacancyBreakdown: z.array(translatedNotesRow).max(50).optional(),
  qualifications: z.array(translatedQualificationRow).max(50).optional(),
  experienceRequirements: z.array(translatedExperienceRow).max(50).optional(),
  additionalRequirements: shortText(2000).optional(),
  postSpecificNotes: shortText(2000).optional(),
}).strict();
const translationKey = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const richDocumentTranslations = z.record(translationKey, z.string().trim().min(1).max(20000)).superRefine((translations, ctx) => {
  const keys = Object.keys(translations);
  if (keys.length > 10000) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'Document translations contain too many text runs.' });
  if (keys.reduce((size, key) => size + translations[key].length, 0) > 500000)
    ctx.addIssue({ code:z.ZodIssueCode.custom, message:'Document translations exceed 500,000 characters.' });
});
const translatedJobContent = z.object({
  description: z.string().max(20000).optional(),
  qualification: z.string().max(500).optional(),
  ageRelaxation: z.string().max(500).optional(),
  ageDescription: shortText(1000).optional(),
  selectionProcess: z.array(z.union([shortText(200), z.object({ translationId, text: shortText(200) }).strict()])).max(30).optional(),
  importantDates: z.array(z.object({ translationId: translationId.optional(), description: shortText(500).optional() }).strict()).max(100).optional(),
  vacancyBreakdown: z.array(translatedNotesRow).max(100).optional(),
  ageRelaxations: z.array(translatedNotesRow).max(50).optional(),
  applicationFees: z.array(translatedNotesRow).max(50).optional(),
  qualifications: z.array(translatedQualificationRow).max(50).optional(),
  experienceRequirements: z.array(translatedExperienceRow).max(50).optional(),
  selectionStages: z.array(z.object({ translationId: translationId.optional(), description: shortText(1000).optional() }).strict()).max(50).optional(),
  salaryInfo: z.object({ description: shortText(1000).optional() }).strict().optional(),
  howToApplySteps: z.array(z.union([shortText(1000), z.object({ translationId, text: shortText(1000) }).strict()])).max(100).optional(),
  importantLinks: z.array(z.object({ translationId: translationId.optional(), description: shortText(500).optional() }).strict()).max(100).optional(),
  documentsRequired: z.array(z.object({ translationId: translationId.optional(), description: shortText(1000).optional() }).strict()).max(100).optional(),
  importantInstructions: z.array(z.object({ translationId: translationId.optional(), text: shortText(2000).optional() }).strict()).max(100).optional(),
  posts: z.array(translatedJobPost).max(100).optional(),
  postGroups: z.array(z.object({ translationId: translationId.optional(), description: shortText(500).optional() }).strict()).max(50).optional(),
  contentDocument: richDocumentTranslations.optional(),
}).strict().superRefine((translation, ctx) => {
  const hasText = value => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(hasText);
    if (value && typeof value === 'object') return Object.values(value).some(hasText);
    return false;
  };
  const clearingDocumentTranslations = Object.keys(translation).length === 1 && translation.contentDocument && Object.keys(translation.contentDocument).length === 0;
  if (!hasText(translation) && !clearingDocumentTranslations) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A translation must contain at least one eligible text field.' });
});
const contentTranslationsSchema = z.object({ hi: translatedJobContent.optional(), bn: translatedJobContent.optional() }).strict().superRefine((translations, ctx) => {
  if (!translations.hi && !translations.bn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide a Hindi or Bengali translation.' });
});
const blockData = {
  paragraph: z.object({ text: z.string().trim().min(1).max(10000) }).strict(), heading: z.object({ text: z.string().trim().min(1).max(300) }).strict(),
  callout: z.object({ text: z.string().trim().min(1).max(3000), tone: z.enum(['NOTE','WARNING','INFO']).optional() }).strict(),
  bulletList: z.object({ items: z.array(z.string().trim().min(1).max(1000)).min(1).max(100) }).strict(), numberedList: z.object({ items: z.array(z.string().trim().min(1).max(1000)).min(1).max(100) }).strict(),
  steps: z.object({ items: z.array(z.string().trim().min(1).max(1000)).min(1).max(100) }).strict(),
  table: z.object({ title: shortText(200).optional(), note: shortText(1000).optional(), headers: z.array(z.string().trim().min(1).max(200)).min(1).max(50), rows: z.array(z.array(shortText(1000)).min(1).max(50)).min(1).max(200) }).strict().superRefine((table,ctx)=>{table.rows.forEach((row,i)=>{if(row.length!==table.headers.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:['rows',i],message:'Every row must have one cell per column.'});if(!row.some(cell=>cell.trim()))ctx.addIssue({code:z.ZodIssueCode.custom,path:['rows',i],message:'Rows cannot be completely empty.'});});}),
  keyValueList: z.object({ title: shortText(200).optional(), items: z.array(z.object({key:z.string().trim().min(1).max(200),value:z.string().trim().min(1).max(1000)}).strict()).min(1).max(100) }).strict(),
  divider: z.object({}).strict(),
  link: z.object({ label: z.string().trim().min(1).max(200), url: z.string().url().refine(value=>['https:','http:'].includes(new URL(value).protocol),'URL must use HTTP or HTTPS'), description: shortText(500).optional() }).strict(),
  externalLink: z.object({ label: z.string().trim().min(1).max(200), url: z.string().url().refine(value=>['https:','http:'].includes(new URL(value).protocol),'URL must use HTTP or HTTPS'), description: shortText(500).optional() }).strict(),
  image: z.object({ url: z.string().url().refine(value=>['https:','http:'].includes(new URL(value).protocol),'URL must use HTTP or HTTPS'), alt: shortText(300).optional(), caption: shortText(500).optional() }).strict(),
  youtube: z.object({ url: z.string().url().refine(value=>{const host=new URL(value).hostname.toLowerCase();return host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com');},'URL must belong to YouTube'), caption: shortText(500).optional() }).strict(),
};
const contentBlock = z.discriminatedUnion('type', Object.entries(blockData).map(([type,data]) => z.object({ type: z.literal(type), data }).strict()));
const documentNode = z.lazy(() => z.object({
  type: z.enum(['p','h1','h2','h3','ul','ol','li','table','thead','tbody','tr','th','td','blockquote','hr','strong','em','u','s','a','span','div','br']),
  text: z.string().max(20000).optional(),
  translationKey: translationKey.optional(),
  attrs: z.object({ id:z.string().regex(/^heading-[a-z0-9-]{1,80}$/).optional(), href:z.string().url().refine(value=>['http:','https:'].includes(new URL(value).protocol),'URL must use HTTP or HTTPS').optional(), align:z.enum(['left','center','right']).optional() }).strict().optional(),
  content: z.array(documentNode).max(500).optional(),
}).strict());
const documentNodes = z.array(documentNode).max(2000).superRefine((nodes,ctx)=>{
  let size=0,count=0; const keys = new Set();
  const inspect=(items,parent='',depth=0,tableState=null,path=[])=>items.forEach((item,index)=>{
    const here=[...path,index];size+=(item.text||'').length;count++;
    if (item.translationKey) {
      if (item.type !== 'span' || !item.text?.trim() || item.content?.length || item.attrs)
        ctx.addIssue({ code:z.ZodIssueCode.custom, path:here, message:'Translation keys may only mark non-empty span text runs without attributes or child nodes.' });
      if (keys.has(item.translationKey)) ctx.addIssue({ code:z.ZodIssueCode.custom, path:here, message:'Translation keys must be unique in a document.' });
      keys.add(item.translationKey);
    }
    if(depth>40)ctx.addIssue({code:z.ZodIssueCode.custom,path:here,message:'Document nesting is too deep.'});
    const allowed={table:['thead','tbody','tr'],thead:['tr'],tbody:['tr'],tr:['th','td'],ul:['li'],ol:['li']};
    if(allowed[parent]&&!allowed[parent].includes(item.type))ctx.addIssue({code:z.ZodIssueCode.custom,path:here,message:`Invalid ${parent} structure.`});
    if(item.type==='table')tableState={width:null};
    if(item.type==='tr'&&tableState){const width=item.content?.length||0;if(tableState.width!=null&&tableState.width!==width)ctx.addIssue({code:z.ZodIssueCode.custom,path:here,message:'Every table row must have the same number of cells.'});tableState.width=width;}
    if(item.content)inspect(item.content,item.type,depth+1,tableState,here);
  });
  inspect(nodes);if(size>500000)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Document text exceeds 500,000 characters.'});if(count>10000)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Document contains too many nested nodes.'});
});
const jobFields = {
  contentTranslations: contentTranslationsSchema.optional(),
  selectionProcessTranslationIds: z.array(translationId).max(30).optional(),
  howToApplyStepTranslationIds: z.array(translationId).max(100).optional(),
  contentDocument: documentNodes.optional(),
  importantDates: z.array(dateRow).max(100).optional(), vacancyBreakdown: z.array(vacancyRow).max(100).optional(),
  ageCutoffDate: z.coerce.date().optional(), ageDescription: shortText(1000).optional(), ageRelaxations: z.array(ageRelaxation).max(50).optional(),
  applicationFees: z.array(feeRow).max(50).optional(), qualifications: z.array(qualificationRow).max(50).optional(), selectionStages: z.array(selectionStage).max(50).optional(),
  salaryInfo: salaryInfo.optional(), howToApplySteps: z.array(shortText(1000)).max(100).optional(), importantLinks: z.array(importantLink).max(100).optional(),
  contentBlocks: z.array(contentBlock).max(100).optional(), contentSections: z.array(z.object({title:z.string().trim().min(1).max(160),blocks:z.array(contentBlock).min(1).max(100)}).strict()).max(50).optional(),
  conditionalFields: z.array(z.object({field:z.enum(['vacancyCount','qualification','ageLimit','salary','applicationFee','location','experience','selectionProcess']),mode:z.enum(['COMMON','VARIES']),entries:z.array(z.object({postId:id.optional(),category:shortText(120).optional(),value:z.string().trim().min(1).max(1000)}).strict()).max(100).optional()}).strict()).max(8).optional(),
  documentsRequired: z.array(z.object({ translationId: translationId.optional(), name: shortText(160), description: shortText(1000).optional(), required: z.boolean().optional() }).strict()).max(100).optional(),
  importantInstructions: z.array(z.object({ translationId: translationId.optional(), text: shortText(2000), category: shortText(120).optional() }).strict()).max(100).optional(),
  posts: z.array(jobPost).max(100).optional(), postGroups: z.array(z.object({ translationId: translationId.optional(), name: shortText(120), description: shortText(500).optional(), totalVacancies: z.number().int().nonnegative().optional() }).strict()).max(50).optional(),
};
const identityRepeaterPaths = [
  ['importantDates', 'importantDates'], ['vacancyBreakdown', 'vacancyBreakdown'],
  ['ageRelaxations', 'ageRelaxations'], ['applicationFees', 'applicationFees'],
  ['qualifications', 'qualifications'], ['selectionStages', 'selectionStages'],
  ['posts', 'posts'], ['postGroups', 'postGroups'], ['importantLinks', 'importantLinks'],
  ['documentsRequired', 'documentsRequired'], ['importantInstructions', 'importantInstructions'],
];
function checkUniqueIds(items, path, ctx) {
  const seen = new Set();
  (items || []).forEach((item, index) => {
    const value = item?.translationId;
    if (!value) return;
    if (seen.has(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index, 'translationId'], message: 'Translation item IDs must be unique within a repeater.' });
    seen.add(value);
  });
  return seen;
}
function checkIdentityPair(source, translated, path, ctx) {
  if (!Array.isArray(translated) || !translated.some(item => item && typeof item === 'object' && item.translationId)) return;
  const sourceIds = new Set((source || []).map(item => item?.translationId).filter(Boolean));
  const seen = new Set();
  translated.forEach((item, index) => {
    if (!item?.translationId) return;
    if (seen.has(item.translationId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index, 'translationId'], message: 'Translation item IDs must be unique within a translated repeater.' });
    if (sourceIds.size && !sourceIds.has(item.translationId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index, 'translationId'], message: 'Translation item ID must refer to an English source item.' });
    seen.add(item.translationId);
  });
}
function validateStructuredTranslationIdentities(value, ctx) {
  for (const [sourceKey, translationKey] of identityRepeaterPaths) {
    const source = value[sourceKey] || [];
    checkUniqueIds(source, [sourceKey], ctx);
    for (const locale of ['hi', 'bn']) checkIdentityPair(source, value.contentTranslations?.[locale]?.[translationKey], ['contentTranslations', locale, translationKey], ctx);
  }
  for (const [sourceKey, idsKey, translationKey] of [
    ['selectionProcess', 'selectionProcessTranslationIds', 'selectionProcess'],
    ['howToApplySteps', 'howToApplyStepTranslationIds', 'howToApplySteps'],
  ]) {
    const ids = value[idsKey] || [];
    if (ids.length && value[sourceKey] && ids.length !== value[sourceKey].length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [idsKey], message: `${idsKey} must contain one ID per source item.` });
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [idsKey], message: 'Translation item IDs must be unique within a repeater.' });
    for (const locale of ['hi', 'bn']) {
      const rows = value.contentTranslations?.[locale]?.[translationKey];
      if (!Array.isArray(rows) || !rows.some(item => item && typeof item === 'object' && item.translationId)) continue;
      const seen = new Set();
      rows.forEach((item, index) => {
        if (!item?.translationId) return;
        if (seen.has(item.translationId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contentTranslations', locale, translationKey, index, 'translationId'], message: 'Translation item IDs must be unique within a translated repeater.' });
        if (ids.length && !ids.includes(item.translationId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contentTranslations', locale, translationKey, index, 'translationId'], message: 'Translation item ID must refer to an English source item.' });
        seen.add(item.translationId);
      });
    }
  }
  const posts = value.posts || [];
  posts.forEach((post, postIndex) => {
    for (const path of ['categoryVacancyBreakdown', 'qualifications', 'experienceRequirements']) {
      const source = post[path] || [];
      checkUniqueIds(source, ['posts', postIndex, path], ctx);
      for (const locale of ['hi', 'bn']) checkIdentityPair(source, value.contentTranslations?.[locale]?.posts?.[postIndex]?.[path], ['contentTranslations', locale, 'posts', postIndex, path], ctx);
    }
  });
}
function validateDocumentTranslations(value, ctx) {
  const keys = new Set();
  const visit = nodes => (nodes || []).forEach(node => { if (node.translationKey) keys.add(node.translationKey); visit(node.content); });
  visit(value.contentDocument);
  for (const locale of ['hi', 'bn']) {
    for (const key of Object.keys(value.contentTranslations?.[locale]?.contentDocument || []))
      if (!keys.has(key)) ctx.addIssue({ code:z.ZodIssueCode.custom, path:['contentTranslations',locale,'contentDocument',key], message:'Translation key does not refer to a marked text run in contentDocument.' });
  }
}
const job = jobBase.extend(jobFields).superRefine((value, ctx) => { validateDocumentTranslations(value, ctx); validateStructuredTranslationIdentities(value, ctx); });
const jobDraft = jobBase.extend({ ...jobFields,
  title: z.string().trim().max(200).optional(),
  organization: z.string().trim().max(200).optional(),
}).superRefine((value, ctx) => { validateDocumentTranslations(value, ctx); validateStructuredTranslationIdentities(value, ctx); });
const application = z.object({ job: id, status: z.enum(['NOT_APPLIED','APPLIED','ADMIT_CARD','EXAM_SCHEDULED','EXAM_COMPLETED','RESULT','INTERVIEW','SELECTED','REJECTED']).optional(), appliedAt: z.coerce.date().optional(), examDate: z.coerce.date().optional(), result: z.string().max(500).optional(), notes: z.string().max(3000).optional(), reminderDate: z.coerce.date().optional() }).strict();
const applicationUpdate = application.omit({job:true}).strict();
const board = z.object({name:z.string().trim().min(2).max(120),slug:z.string().trim().min(2).max(120).optional(),shortDescription:z.string().max(300).optional(),description:z.string().max(10000).optional(),about:z.string().max(10000).optional(),organization:z.string().max(160).optional(),category:z.string().max(100).optional(),officialWebsite:url,officialNotificationWebsite:url,location:z.string().max(160).optional(),icon:z.string().max(500).optional(),active:z.boolean().optional()}).strict();
const community = z.object({ name: z.string().min(2).max(120), description: z.string().max(2000).optional(), board: id.optional(), exam: z.string().max(100).optional() }).strict();
const resourceBase = z.object({ title: z.string().trim().min(2).max(200), type: z.enum(['SYLLABUS','PYQ','MOCK_TEST','STUDY_MATERIAL','HOW_TO_APPLY','OTHER']), description: z.string().max(3000).optional(), sourceType: z.enum(['EXTERNAL_URL','UPLOAD']).optional(), externalUrl: url, accessMode: z.enum(['INLINE','DOWNLOAD']).optional(), url, youtubeUrl, board: id.optional(), job: id.optional(), exam: z.string().max(100).optional(), community: id.optional() }).strict();
const validateResource = (value, ctx) => { const external=value.sourceType==='EXTERNAL_URL'||(!value.sourceType&&Boolean(value.externalUrl||value.url)); if (external && !(value.externalUrl||value.url)) ctx.addIssue({code:z.ZodIssueCode.custom,path:['externalUrl'],message:'A valid HTTP/HTTPS resource URL is required.'}); if(external&&value.accessMode) ctx.addIssue({code:z.ZodIssueCode.custom,path:['accessMode'],message:'Access mode applies to uploaded files only.'}); };
const resource = resourceBase.superRefine(validateResource);
const resourcePatch = resourceBase.partial().superRefine(validateResource);
const authorAsset = z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(500).optional(), data: z.record(z.unknown()).optional() }).strict();
module.exports = { id, register, login, profile, verifyEmail, forgotPassword, resetPassword, changePassword, sendOtp, verifyOtp, phoneLogin, job, jobDraft, application, applicationUpdate, board, community, resource, resourcePatch, authorAsset };
