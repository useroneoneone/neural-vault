// These are visual presets, not a fixed list of graph groups.
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

export function rootForPath(path) {
  const normalized = normalizeVaultPath(path);
  return normalized.includes('/') ? normalized.split('/')[0] : '';
}

function hashName(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function pastelHex(hue) {
  const saturation = 0.58;
  const lightness = 0.74;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const channel = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  const offset = lightness - chroma / 2;
  return '#' + channel.map((value) => Math.round((value + offset) * 255).toString(16).padStart(2, '0')).join('');
}

function genericCategory(root) {
  const hash = hashName(root || 'neural-vault-root');
  const angle = hash / 4294967296 * Math.PI * 2 - Math.PI / 2;
  const icons = ['FileText', 'BookOpen', 'PenLine', 'Atom', 'Lightbulb', 'Sparkles'];
  return {
    id: root ? `folder:${encodeURIComponent(root)}` : 'vault-root',
    root,
    roots: [root],
    isRoot: !root,
    name: root || '根目录',
    en: root ? 'Folder' : 'Root',
    type: '笔记',
    typeEn: 'Note',
    color: root ? pastelHex(hash % 360) : '#c6c8d4',
    icon: root ? icons[hash % icons.length] : 'FileText',
    pos: [Math.cos(angle), Math.sin(angle)],
    bend: ((hash >>> 16) % 21 - 10) / 100,
  };
}

const compareNames = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Discover actual root directories; aliases can never merge separate roots. */
export function discoverCategories(records = [], { folders = [] } = {}) {
  const roots = new Set();
  for (const record of records) {
    if (typeof record?.path === 'string' && /\.md$/i.test(record.path)) roots.add(rootForPath(record.path));
  }
  for (const folder of folders ?? []) {
    const path = normalizeVaultPath(typeof folder === 'string' ? folder : folder?.path);
    if (path) roots.add(path.split('/')[0]);
  }
  const presetForRoot = new Map();
  for (const preset of CATEGORIES) {
    const aliases = [...roots].filter((root) => preset.roots.some((alias) => alias.toLowerCase() === root.toLowerCase()));
    // Numbered canonical roots retain the existing ID if a legacy alias also
    // exists. Other actual roots get their own path-derived ID and appearance.
    aliases.sort((a, b) => {
      const rank = (root) => {
        const exact = preset.roots.indexOf(root);
        return exact >= 0 ? exact * 2 : preset.roots.findIndex((alias) => alias.toLowerCase() === root.toLowerCase()) * 2 + 1;
      };
      return rank(a) - rank(b) || compareNames(a, b);
    });
    if (aliases.length) presetForRoot.set(aliases[0], preset);
  }
  const categories = [...roots].map((root) => {
    const preset = presetForRoot.get(root);
    return preset
      ? { ...preset, root, roots: [root], name: root, isRoot: false, pos: [...preset.pos] }
      : genericCategory(root);
  });
  return categories.sort((a, b) => {
    const rank = (category) => {
      const index = CATEGORIES.findIndex((preset) => preset.id === category.id);
      return index >= 0 ? index : category.isRoot ? CATEGORIES.length + 1 : CATEGORIES.length;
    };
    return rank(a) - rank(b) || compareNames(a.root, b.root);
  });
}

/** With discovered categories, use exact roots; no category means legacy preset lookup. */
export function categoryForPath(path, categories) {
  if (categories !== undefined) {
    const root = rootForPath(path);
    return categories.find((category) => category.root === root || (category.root === undefined && category.roots.includes(root))) ?? null;
  }
  const root = normalizeVaultPath(path).split('/')[0].toLowerCase();
  return CATEGORIES.find((category) => category.roots.some((name) => name.toLowerCase() === root)) ?? null;
}
