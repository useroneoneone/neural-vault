import {
  Atom, BookOpen, PenLine, FileText, Lightbulb, Quote, Sparkles, Link2, MessageSquare,
  Hash, Brain, Workflow, Feather, Flame, Target, Cpu, Repeat, Eye, BookMarked,
} from 'lucide-react';

export const SIDEBAR_W = 452; // panel width + right margin

export const ICONS = { Atom, BookOpen, PenLine, FileText, Lightbulb, Quote, Sparkles, Link2, MessageSquare };

const TAG_ICONS = {
  思维模型: Brain, 概念: Atom, 作品: BookMarked, 长文: Feather, 草稿: PenLine, 写作: Feather,
  方法论: Workflow, 效率: Flame, 选题: Target, 灵感: Lightbulb, 认知: Eye, AI: Cpu,
  系统: Workflow, 学习: BookOpen, 复利: Repeat, 注意力: Target,
};
export const tagIcon = (t) => TAG_ICONS[t] || Hash;
