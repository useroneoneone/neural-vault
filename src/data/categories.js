// Root folders remain the only graph groups. Nested folders belong to their root.
export const CATEGORIES = [
  { id: 'projects', name: '项目', en: 'Projects', type: '项目', typeEn: 'Project', roots: ['01-项目', '项目'], color: '#d6d0ff', icon: 'Atom', pos: [0, -1.0], bend: 0.0 },
  { id: 'assets', name: '资产', en: 'Assets', type: '资产', typeEn: 'Asset', roots: ['02-资产', '资产'], color: '#a78bfa', icon: 'BookOpen', pos: [-1.0, -0.02], bend: -0.1 },
  { id: 'resources', name: '资源', en: 'Resources', type: '资源', typeEn: 'Resource', roots: ['03-资源', '资源'], color: '#7cc4ff', icon: 'PenLine', pos: [-0.74, 0.5], bend: 0.12 },
  { id: 'support', name: '辅助', en: 'Support', type: '辅助', typeEn: 'Support', roots: ['04-辅助', '辅助'], color: '#5eead4', icon: 'FileText', pos: [1.0, -0.02], bend: 0.1 },
  { id: 'inspiration', name: '灵感', en: 'Inspiration', type: '灵感', typeEn: 'Idea', roots: ['05-灵感', '灵感'], color: '#f4c069', icon: 'Lightbulb', pos: [0.72, 0.5], bend: -0.12 },
  { id: 'skills', name: 'skills', en: 'Skills', type: '技能', typeEn: 'Skill', roots: ['06-Skills', 'skills'], color: '#e9a4ca', icon: 'Sparkles', pos: [0, 1.0], bend: 0.0 },
];

export function normalizeVaultPath(value = '') {
  const segments = String(value).replaceAll('\\', '/').split('/');
  const normalized = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }
  return normalized.join('/');
}

export function categoryForPath(path) {
  const root = normalizeVaultPath(path).split('/')[0].toLowerCase();
  return CATEGORIES.find((category) => category.roots.some((name) => name.toLowerCase() === root)) ?? null;
}
