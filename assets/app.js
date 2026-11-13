/* ==========================================================================
   纸间 · Resume Studio
   A dependency-free, local-first resume editor.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Constants & tiny utilities
     ------------------------------------------------------------------------ */
  const STORAGE_KEY = 'papercv.studio.v1';
  const PAGE_W_PX = (210 * 96) / 25.4;
  const PAGE_H_PX = (297 * 96) / 25.4;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function uid(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return (prefix || 'item') + '-' + Date.now().toString(36) + '-' + random;
  }

  function str(value) {
    return typeof value === 'string' ? value : (value == null ? '' : String(value));
  }

  function cleanBullets(value) {
    const list = Array.isArray(value) ? value : str(value).split(/\r?\n/);
    return list.map((line) => str(line).trim()).filter(Boolean);
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  }

  function normalizeHex(value, fallback) {
    const text = str(value).trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function mixHex(hex, target, amount) {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);
    const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
    return '#' +
      toHex(a.r + (b.r - a.r) * amount) +
      toHex(a.g + (b.g - a.g) * amount) +
      toHex(a.b + (b.b - a.b) * amount);
  }

  function readableOn(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.64 ? '#25211b' : '#ffffff';
  }

  function displayUrl(value) {
    return str(value).replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }

  function formatTime(date) {
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  /* ------------------------------------------------------------------------
     Icons
     ------------------------------------------------------------------------ */
  const ICONS = {
    phone: '<svg class="rs-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 3.8 8.8 3l1.7 4-1.9 1.4a14.5 14.5 0 0 0 6.9 6.9l1.5-1.9 4 1.7-.8 2.4c-.4 1.2-1.5 1.9-2.8 1.8C10.7 18.8 5.2 13.3 4.6 6.6c-.1-1.3.6-2.4 1.8-2.8Z"/></svg>',
    mail: '<svg class="rs-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.6 6.5 7.2 6a2 2 0 0 0 2.4 0l7.2-6"/></svg>',
    pin: '<svg class="rs-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5.3-8 11-8 11S4 15.3 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    globe: '<svg class="rs-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.7 5.6 3.7 9S14.4 18.5 12 21c-2.4-2.5-3.7-5.6-3.7-9S9.6 5.5 12 3Z"/></svg>',
    hash: '<svg class="rs-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17"/></svg>'
  };

  function icon(name) { return ICONS[name] || ICONS.hash; }

  /* ------------------------------------------------------------------------
     Default / sample data
     ------------------------------------------------------------------------ */
  const DEFAULT_SETTINGS = {
    template: 'minimal',
    accent: '#205c4c',
    typeface: 'mix',
    fontSize: 1,
    lineHeight: 1.55,
    margin: 15,
    showPhoto: true,
    bilingual: true
  };

  function sampleData() {
    return {
      version: 1,
      basics: {
        name: '林知夏',
        nameEn: 'LIN ZHIXIA',
        role: '产品设计师',
        roleEn: 'PRODUCT DESIGNER',
        tagline: '关注人与系统之间的关系，擅长把复杂问题转化为清晰、可用的产品体验。',
        phone: '+86 138 0000 0000',
        email: 'zhixia.lin@example.com',
        city: '上海 · 徐汇',
        website: 'zhixia.design',
        photo: window.SAMPLE_PHOTO || '',
        photoPath: '',
        photoX: 50,
        photoY: 34,
        photoZoom: 1
      },
      education: [
        {
          id: 'edu-1',
          school: '同济大学 · 设计创意学院',
          degree: '设计学 硕士',
          period: '2017.09 — 2020.06',
          location: '上海',
          detail: '研究方向：交互设计与服务设计 · 国家奖学金'
        },
        {
          id: 'edu-2',
          school: '江南大学',
          degree: '工业设计 学士',
          period: '2013.09 — 2017.06',
          location: '无锡',
          detail: 'GPA 3.8 / 4.0 · 校优秀毕业生'
        }
      ],
      experience: [
        {
          id: 'exp-1',
          company: '字节跳动 · 飞书',
          role: '高级产品设计师',
          period: '2022.07 — 至今',
          location: '上海',
          bullets: [
            '负责飞书文档的协作与知识沉淀体验，主导「多维表格视图」重构，核心任务完成率提升 18%。',
            '搭建文档编辑器设计规范，覆盖 6 类内容块与 40+ 组件，研发还原度从 78% 提升至 95%。',
            '与 AI 团队共同落地智能摘要与续写能力，上线 3 个月内周活使用率增长 27%。'
          ]
        },
        {
          id: 'exp-2',
          company: '蔚来汽车',
          role: '体验设计师',
          period: '2020.08 — 2022.06',
          location: '上海',
          bullets: [
            '负责 NIO App 社区与车主服务模块，独立完成 12 个版本的交互设计与走查。',
            '通过用户访谈与数据分析重设「一键加电」预约流程，订单取消率下降 21%。'
          ]
        }
      ],
      projects: [
        {
          id: 'proj-1',
          name: 'Flow · AI 写作助手',
          role: '独立产品 / 设计开发',
          period: '2024.03 — 2024.09',
          link: 'flow.zhixia.design',
          bullets: [
            '从 0 到 1 设计面向长文写作者的 AI 助手，完成用户研究、信息架构与高保真原型。',
            '上线 6 个月获得 1.2 万注册用户，次周留存 34%，获 2024 年 UX Design Awards 提名。'
          ]
        }
      ],
      skills: [
        { id: 'skill-1', label: '设计', items: 'Figma / Sketch / Framer / Adobe CC' },
        { id: 'skill-2', label: '研究', items: '用户访谈 / 可用性测试 / 数据分析' },
        { id: 'skill-3', label: '技术', items: 'HTML / CSS / React 基础 / Prompt Engineering' },
        { id: 'skill-4', label: '语言', items: '中文（母语）/ English（IELTS 7.5）' }
      ],
      honors: [
        { id: 'honor-1', year: '2024', text: 'UX Design Awards · 提名（Flow AI 写作助手）' },
        { id: 'honor-2', year: '2020', text: '同济大学优秀毕业生 · 国家奖学金' }
      ],
      settings: clone(DEFAULT_SETTINGS)
    };
  }

  function multipageSampleData() {
    const data = sampleData();
    data.experience[0].bullets.push('牵头跨团队的设计评审机制，将需求平均返工轮次从 2.6 轮降至 1.4 轮。');
    data.experience[1].bullets.push('参与建立 NIO 跨端设计系统 Atlas，统一 120+ 组件的视觉与交互规范。');
    data.experience.push({
      id: 'exp-3',
      company: '网易 · 杭州研究院',
      role: '交互设计实习生',
      period: '2019.06 — 2020.06',
      location: '杭州',
      bullets: [
        '支持云音乐评论与歌单模块的体验优化，完成 20+ 份交互稿与可用性测试。',
        '协助搭建内容社区的组件库，沉淀 18 个高频场景模板，设计交付效率提升 25%。'
      ]
    });
    data.projects[0].bullets.push('设计可解释的 AI 建议与版本回溯机制，核心写作流程完成率提升 19%。');
    data.projects.push({
      id: 'proj-2',
      name: 'NIO Atlas · 跨端设计系统',
      role: '设计系统负责人',
      period: '2021.06 — 2022.05',
      link: 'atlas.nio.design',
      bullets: [
        '为 NIO App 搭建覆盖 iOS / Android / Web 的设计系统，统一 120+ 组件与 4 套主题。',
        '推动设计与研发共用一套 Token，版本交付周期缩短 30%，设计走查问题减少 42%。'
      ]
    });
    data.honors.unshift({ id: 'honor-0', year: '2023', text: '红点概念设计奖 · 智能药盒服务系统' });
    data.settings.template = 'minimal';
    data.settings.fontSize = 1;
    data.settings.lineHeight = 1.55;
    data.settings.margin = 15;
    return data;
  }

  function emptyData(settings) {
    return {
      version: 1,
      basics: {
        name: '',
        nameEn: '',
        role: '',
        roleEn: '',
        tagline: '',
        phone: '',
        email: '',
        city: '',
        website: '',
        photo: '',
        photoPath: '',
        photoX: 50,
        photoY: 40,
        photoZoom: 1
      },
      education: [],
      experience: [],
      projects: [],
      skills: [],
      honors: [],
      settings: settings ? clone(settings) : clone(DEFAULT_SETTINGS)
    };
  }

  /* ------------------------------------------------------------------------
     Normalisation / persistence
     ------------------------------------------------------------------------ */
  function normalizeData(raw) {
    const fallback = sampleData();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;

    const basicsIn = (raw.basics && typeof raw.basics === 'object') ? raw.basics : {};
    const settingsIn = (raw.settings && typeof raw.settings === 'object') ? raw.settings : {};
    const settings = {
      template: ['minimal', 'sidebar', 'editorial'].includes(settingsIn.template) ? settingsIn.template : DEFAULT_SETTINGS.template,
      accent: normalizeHex(settingsIn.accent, DEFAULT_SETTINGS.accent),
      typeface: ['sans', 'serif', 'mix'].includes(settingsIn.typeface) ? settingsIn.typeface : DEFAULT_SETTINGS.typeface,
      fontSize: clampNumber(settingsIn.fontSize, 0.88, 1.12, DEFAULT_SETTINGS.fontSize),
      lineHeight: clampNumber(settingsIn.lineHeight, 1.35, 1.8, DEFAULT_SETTINGS.lineHeight),
      margin: clampNumber(settingsIn.margin, 12, 22, DEFAULT_SETTINGS.margin),
      showPhoto: typeof settingsIn.showPhoto === 'boolean' ? settingsIn.showPhoto : DEFAULT_SETTINGS.showPhoto,
      bilingual: typeof settingsIn.bilingual === 'boolean' ? settingsIn.bilingual : DEFAULT_SETTINGS.bilingual
    };

    const data = {
      version: 1,
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
      basics: {
        name: basicsIn.name === undefined ? fallback.basics.name : str(basicsIn.name),
        nameEn: basicsIn.nameEn === undefined ? fallback.basics.nameEn : str(basicsIn.nameEn),
        role: basicsIn.role === undefined ? fallback.basics.role : str(basicsIn.role),
        roleEn: basicsIn.roleEn === undefined ? fallback.basics.roleEn : str(basicsIn.roleEn),
        tagline: basicsIn.tagline === undefined ? fallback.basics.tagline : str(basicsIn.tagline),
        phone: basicsIn.phone === undefined ? fallback.basics.phone : str(basicsIn.phone),
        email: basicsIn.email === undefined ? fallback.basics.email : str(basicsIn.email),
        city: basicsIn.city === undefined ? fallback.basics.city : str(basicsIn.city),
        website: basicsIn.website === undefined ? fallback.basics.website : str(basicsIn.website),
        photo: basicsIn.photo === undefined ? fallback.basics.photo : str(basicsIn.photo),
        photoPath: str(basicsIn.photoPath || (basicsIn.photo && !str(basicsIn.photo).startsWith('data:') ? basicsIn.photo : '')),
        photoX: clampNumber(basicsIn.photoX, 0, 100, 50),
        photoY: clampNumber(basicsIn.photoY, 0, 100, 40),
        photoZoom: clampNumber(basicsIn.photoZoom, 1, 2, 1)
      },
      settings,
      education: [],
      experience: [],
      projects: [],
      skills: [],
      honors: []
    };

    const seen = new Set();
    const makeId = (prefix, value) => {
      let id = str(value) || uid(prefix);
      let candidate = id;
      let counter = 2;
      while (seen.has(candidate)) {
        candidate = id + '-' + counter;
        counter += 1;
      }
      seen.add(candidate);
      return candidate;
    };

    if (Array.isArray(raw.education)) {
      data.education = raw.education.filter((it) => it && typeof it === 'object').map((it) => ({
        id: makeId('edu', it.id),
        school: str(it.school),
        degree: str(it.degree),
        period: str(it.period),
        location: str(it.location),
        detail: str(it.detail)
      }));
    }
    if (Array.isArray(raw.experience)) {
      data.experience = raw.experience.filter((it) => it && typeof it === 'object').map((it) => ({
        id: makeId('exp', it.id),
        company: str(it.company),
        role: str(it.role),
        period: str(it.period),
        location: str(it.location),
        bullets: cleanBullets(it.bullets)
      }));
    }
    if (Array.isArray(raw.projects)) {
      data.projects = raw.projects.filter((it) => it && typeof it === 'object').map((it) => ({
        id: makeId('proj', it.id),
        name: str(it.name),
        role: str(it.role),
        period: str(it.period),
        link: str(it.link),
        bullets: cleanBullets(it.bullets)
      }));
    }
    if (Array.isArray(raw.skills)) {
      data.skills = raw.skills.filter((it) => it && typeof it === 'object').map((it) => ({
        id: makeId('skill', it.id),
        label: str(it.label),
        items: str(it.items)
      }));
    }
    if (Array.isArray(raw.honors)) {
      data.honors = raw.honors.filter((it) => it && typeof it === 'object').map((it) => ({
        id: makeId('honor', it.id),
        year: str(it.year),
        text: str(it.text)
      }));
    }

    return data;
  }

  let loadedFromStorage = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        loadedFromStorage = true;
        return normalizeData(JSON.parse(raw));
      }
    } catch (error) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
    }
    return normalizeData(sampleData());
  }

  let state = loadState();

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('read-failed')); };
      reader.readAsDataURL(blob);
    });
  }

  async function hydrateServerState(raw) {
    const data = normalizeData(raw);
    const path = data.basics.photoPath ||
      (data.basics.photo && !str(data.basics.photo).startsWith('data:') ? data.basics.photo : '');
    if (path && !/^https?:/i.test(path)) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) throw new Error('photo-not-found');
        const blob = await response.blob();
        if (!blob.type || !blob.type.startsWith('image/')) throw new Error('photo-not-image');
        data.basics.photo = await blobToDataURL(blob);
        data.basics.photoPath = path;
      } catch (error) {
        // A missing local photo should not render as a broken image.
        data.basics.photo = '';
        data.basics.photoPath = '';
      }
    }
    return data;
  }

  function applyState(next) {
    state = normalizeData(next);
    ui.collapsedItems.clear();
    renderEditor();
    syncDesignControls();
    renderPreview({ refit: true });
    updateDocChrome();
  }


  const ui = {
    tab: 'content',
    openSections: {
      basics: true,
      experience: true,
      education: false,
      projects: false,
      skills: false,
      honors: false
    },
    collapsedItems: new Set(),
    photoAdjustOpen: false,
    noteDismissed: false,
    zoomMode: 'fit',
    zoom: 0.72,
    lastSaved: new Date()
  };

  let saveTimer = null;
  let previewRaf = null;
  let resizeRaf = null;
  let toastTimer = null;
  let confirmResolver = null;

  // Local-file sync (provided by scripts/local_server.py). When the app is
  // served as plain static files / GitHub Pages, these remain disabled and the
  // editor gracefully falls back to localStorage only.
  let syncAvailable = false;
  let syncBootstrapped = false;
  let serverSaveTimer = null;
  let serverSaveInFlight = false;
  let serverSaveQueued = false;

  /* ------------------------------------------------------------------------
     Contact / photo / shared render helpers
     ------------------------------------------------------------------------ */
  function contactList(basics) {
    const out = [];
    if (basics.phone) out.push({ icon: 'phone', text: basics.phone });
    if (basics.email) out.push({ icon: 'mail', text: basics.email });
    if (basics.city) out.push({ icon: 'pin', text: basics.city });
    if (basics.website) out.push({ icon: 'globe', text: displayUrl(basics.website) });
    return out;
  }

  function contactHTML(basics) {
    return contactList(basics).map((item) =>
      '<span>' + icon(item.icon) + esc(item.text) + '</span>'
    ).join('');
  }

  function photoHTML(basics, className) {
    if (!state.settings.showPhoto || !basics.photo) return '';
    const x = clampNumber(basics.photoX, 0, 100, 50);
    const y = clampNumber(basics.photoY, 0, 100, 40);
    const zoom = clampNumber(basics.photoZoom, 1, 2, 1);
    const style = 'object-position:' + x + '% ' + y + '%;transform:scale(' + zoom + ');';
    return '<div class="' + className + '"><img src="' + esc(basics.photo) + '" alt="" style="' + style + '"></div>';
  }

  function bulletsHTML(bullets) {
    const list = cleanBullets(bullets);
    if (!list.length) return '';
    return '<ul class="rs-bullets">' + list.map((line) => '<li>' + esc(line) + '</li>').join('') + '</ul>';
  }

  function sectionHeadHTML(title, en, continued) {
    return '<div class="rs-head"><h2>' + esc(title) +
      (continued ? '<span class="rs-cont">续</span>' : '') +
      '</h2><span class="en">' + esc(en) + '</span><span class="rule"></span></div>';
  }

  function sectionHTML(title, en, body, extraClass) {
    if (!body) return '';
    return '<section class="rs-section ' + (extraClass || '') + '">' +
      sectionHeadHTML(title, en, false) +
      body +
    '</section>';
  }

  function experienceEntryHTML(item) {
    const company = str(item.company).trim();
    const role = str(item.role).trim();
    const title = company || role;
    if (!title) return '';
    const meta = [];
    if (item.period) meta.push(esc(item.period));
    if (item.location) meta.push('<span class="place">' + esc(item.location) + '</span>');
    const when = meta.length ? '<div class="rs-when">' + meta.join('') + '</div>' : '';
    return '<div class="rs-entry">' +
      '<div class="rs-entry-grid' + (when ? '' : ' no-when') + '">' +
        when +
        '<div class="rs-entry-main">' +
          '<div class="rs-entry-top"><h3>' + esc(title) + '</h3>' +
            (company && role ? '<span class="at">' + esc(role) + '</span>' : '') +
          '</div>' +
          bulletsHTML(item.bullets) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function experienceBody(items) {
    return items.map(experienceEntryHTML).join('');
  }

  function projectEntryHTML(item) {
    const name = str(item.name).trim();
    const role = str(item.role).trim();
    const title = name || role;
    if (!title) return '';
    const meta = [];
    if (item.period) meta.push(esc(item.period));
    if (item.link) meta.push('<span class="place">' + esc(displayUrl(item.link)) + '</span>');
    const when = meta.length ? '<div class="rs-when">' + meta.join('') + '</div>' : '';
    return '<div class="rs-entry">' +
      '<div class="rs-entry-grid' + (when ? '' : ' no-when') + '">' +
        when +
        '<div class="rs-entry-main">' +
          '<div class="rs-entry-top"><h3>' + esc(title) + '</h3>' +
            (name && role ? '<span class="at">' + esc(role) + '</span>' : '') +
          '</div>' +
          bulletsHTML(item.bullets) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function projectBody(items) {
    return items.map(projectEntryHTML).join('');
  }

  function educationEntryHTML(item) {
    const school = str(item.school).trim();
    const degree = str(item.degree).trim();
    const title = school || degree;
    if (!title) return '';
    const meta = [school ? degree : '', item.location].filter(Boolean).join(' · ');
    return '<div class="rs-edu">' +
      '<div class="rs-edu-top"><h3>' + esc(title) + '</h3>' +
        (item.period ? '<span class="period">' + esc(item.period) + '</span>' : '') +
      '</div>' +
      (meta ? '<div class="rs-edu-degree">' + esc(meta) + '</div>' : '') +
      (item.detail ? '<div class="rs-edu-detail">' + esc(item.detail) + '</div>' : '') +
    '</div>';
  }

  function educationBody(items) {
    return items.map(educationEntryHTML).join('');
  }

  function skillEntryHTML(item) {
    const items = str(item.items).trim();
    if (!items) return '';
    const label = str(item.label).trim();
    return '<div class="rs-skill-row' + (label ? '' : ' no-label') + '">' +
      (label ? '<span class="rs-skill-label">' + esc(label) + '</span>' : '') +
      '<span class="rs-skill-items">' + esc(items) + '</span>' +
    '</div>';
  }

  function skillsBody(items) {
    return items.map(skillEntryHTML).join('');
  }

  function honorEntryHTML(item) {
    const text = str(item.text).trim();
    if (!text) return '';
    const year = str(item.year).trim();
    return '<div class="rs-honor' + (year ? '' : ' no-year') + '">' +
      (year ? '<span class="year">' + esc(year) + '</span>' : '') +
      '<span>' + esc(text) + '</span>' +
    '</div>';
  }

  function honorsBody(items) {
    return items.map(honorEntryHTML).join('');
  }

  function sideSectionHTML(title, en, body) {
    if (!body) return '';
    return '<section class="side-section">' +
      '<div class="side-head"><h2>' + esc(title) + '</h2><span class="en">' + esc(en) + '</span></div>' +
      body +
    '</section>';
  }

  function sideEducationBody(items) {
    return items.map((item) => {
      const school = str(item.school).trim();
      const degree = str(item.degree).trim();
      const title = school || degree;
      if (!title) return '';
      const meta = [school ? degree : '', item.location].filter(Boolean).join(' · ');
      return '<div class="side-edu">' +
        '<h3>' + esc(title) + '</h3>' +
        (meta ? '<p>' + esc(meta) + '</p>' : '') +
        (item.period ? '<p class="when">' + esc(item.period) + '</p>' : '') +
      '</div>';
    }).join('');
  }

  function sideSkillsBody(items) {
    return items.map((item) => {
      const itemsText = str(item.items).trim();
      if (!itemsText) return '';
      const label = str(item.label).trim();
      return '<div class="side-skill">' +
        (label ? '<b>' + esc(label) + '</b>' : '') +
        '<p>' + esc(itemsText) + '</p>' +
      '</div>';
    }).join('');
  }

  /* ------------------------------------------------------------------------
     Paper templates
     ------------------------------------------------------------------------ */
  function renderMinimal(data) {
    const b = data.basics;
    const contacts = contactHTML(b);
    const sections = [
      sectionHTML('工作经历', 'EXPERIENCE', experienceBody(data.experience)),
      sectionHTML('项目经历', 'PROJECTS', projectBody(data.projects)),
      sectionHTML('教育背景', 'EDUCATION', educationBody(data.education)),
      sectionHTML('技能', 'SKILLS', skillsBody(data.skills)),
      sectionHTML('荣誉', 'HONORS', honorsBody(data.honors))
    ].join('');

    return '<header class="masthead">' +
      '<div class="identity">' +
        (b.roleEn ? '<div class="kicker">' + esc(b.roleEn) + '</div>' : '') +
        '<h1>' + esc(b.name || '你的名字') + '</h1>' +
        (b.nameEn ? '<div class="name-en">' + esc(b.nameEn) + '</div>' : '') +
        (b.role ? '<div class="role">' + esc(b.role) + '</div>' : '') +
        (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : '') +
      '</div>' +
      photoHTML(b, 'photo') +
    '</header>' +
    (contacts ? '<div class="contact">' + contacts + '</div>' : '') +
    sections;
  }

  function renderSidebar(data) {
    const b = data.basics;
    const sideContacts = contactList(b).map((item) =>
      '<div>' + icon(item.icon) + '<span>' + esc(item.text) + '</span></div>'
    ).join('');

    const sideFooter = b.website
      ? '<footer class="side-foot"><span>' + esc(displayUrl(b.website)) + '</span><span>' + esc(b.city || '') + '</span></footer>'
      : '';

    const side = '<aside class="side">' +
      photoHTML(b, 'side-photo') +
      '<div class="side-name">' + esc(b.name || '你的名字') + '</div>' +
      (b.nameEn ? '<div class="side-name-en">' + esc(b.nameEn) + '</div>' : '') +
      (b.role ? '<div class="side-role">' + esc(b.role) + '</div>' : '') +
      (sideContacts ? '<div class="side-contact">' + sideContacts + '</div>' : '') +
      sideSectionHTML('技能', 'SKILLS', sideSkillsBody(data.skills)) +
      sideSectionHTML('教育', 'EDUCATION', sideEducationBody(data.education)) +
      sideFooter +
    '</aside>';

    const mainFooter = (b.website || b.city)
      ? '<footer class="rs-footer"><span>' + esc(displayUrl(b.website) || b.city) + '</span><span>CURRICULUM VITAE · ' + new Date().getFullYear() + '</span></footer>'
      : '';

    const main = '<main class="main">' +
      (b.tagline ? '<div class="main-intro"><div class="main-kicker">Profile</div><p>' + esc(b.tagline) + '</p></div>' : '') +
      sectionHTML('工作经历', 'EXPERIENCE', experienceBody(data.experience)) +
      sectionHTML('项目经历', 'PROJECTS', projectBody(data.projects)) +
      sectionHTML('荣誉', 'HONORS', honorsBody(data.honors)) +
      mainFooter +
    '</main>';

    return side + main;
  }

  function renderEditorial(data) {
    const b = data.basics;
    const contacts = contactList(b);
    const hasPhoto = state.settings.showPhoto && !!b.photo;
    const mastClass = 'masthead' + (hasPhoto ? '' : ' no-photo') + (contacts.length ? '' : ' no-contact');

    const contactCol = contacts.length
      ? '<div class="contact-col">' + contacts.map((item) =>
          '<div>' + icon(item.icon) + '<span>' + esc(item.text) + '</span></div>'
        ).join('') + '</div>'
      : '';

    const footerName = b.nameEn || b.name;
    const footer = '<footer class="ed-footer">' +
      (footerName ? '<span>' + esc(footerName) + '</span>' : '') +
      (b.website ? '<span>' + esc(displayUrl(b.website)) + '</span>' : '') +
      '<span>PORTFOLIO · ' + new Date().getFullYear() + '</span>' +
    '</footer>';

    return '<header class="' + mastClass + '">' +
      contactCol +
      '<div class="title-col">' +
        (b.roleEn ? '<span class="cv-kicker">' + esc(b.roleEn) + '</span>' : '') +
        '<h1>' + esc(b.name || '你的名字') + '</h1>' +
        (b.role ? '<div class="role-line">' + esc(b.role) + '</div>' : '') +
        (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : '') +
      '</div>' +
      photoHTML(b, 'photo') +
    '</header>' +
    '<div class="body-grid">' +
      '<div class="col-main">' +
        sectionHTML('工作经历', 'EXPERIENCE', experienceBody(data.experience)) +
        sectionHTML('项目经历', 'PROJECTS', projectBody(data.projects)) +
      '</div>' +
      '<aside class="col-side">' +
        sectionHTML('教育背景', 'EDUCATION', educationBody(data.education)) +
        sectionHTML('技能', 'SKILLS', skillsBody(data.skills)) +
        sectionHTML('荣誉', 'HONORS', honorsBody(data.honors)) +
      '</aside>' +
    '</div>' +
    footer;
  }

  const TEMPLATES = {
    minimal: renderMinimal,
    sidebar: renderSidebar,
    editorial: renderEditorial
  };

  /* ------------------------------------------------------------------------
     Multi-page page chrome & flow descriptors
     ------------------------------------------------------------------------ */
  function paperClass(extra) {
    const settings = state.settings;
    return 'paper tpl-' + settings.template + ' font-' + settings.typeface +
      (settings.bilingual ? '' : ' no-bilingual') +
      (extra ? ' ' + extra : '') +
      (!settings.showPhoto || !state.basics.photo ? ' no-photo' : '');
  }

  function applyPaperVars(element) {
    const settings = state.settings;
    element.style.setProperty('--accent', settings.accent);
    element.style.setProperty('--accent-soft', rgba(settings.accent, 0.1));
    element.style.setProperty('--accent-deep', mixHex(settings.accent, '#000000', 0.18));
    element.style.setProperty('--on-accent', readableOn(settings.accent));
    element.style.setProperty('--type-scale', String(settings.fontSize));
    element.style.setProperty('--lh', String(settings.lineHeight));
    element.style.setProperty('--lh-scale', String(settings.lineHeight / 1.55));
    element.style.setProperty('--margin', settings.margin + 'mm');
  }

  function makePaper(html, extraClass) {
    const element = document.createElement('div');
    element.className = paperClass(extraClass);
    applyPaperVars(element);
    element.innerHTML = html;
    return element;
  }

  function minimalHeaderHTML(data) {
    const b = data.basics;
    return '<header class="masthead">' +
      '<div class="identity">' +
        (b.roleEn ? '<div class="kicker">' + esc(b.roleEn) + '</div>' : '') +
        '<h1>' + esc(b.name || '你的名字') + '</h1>' +
        (b.nameEn ? '<div class="name-en">' + esc(b.nameEn) + '</div>' : '') +
        (b.role ? '<div class="role">' + esc(b.role) + '</div>' : '') +
        (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : '') +
      '</div>' +
      photoHTML(b, 'photo') +
    '</header>';
  }

  function minimalRunningHeadHTML(data) {
    const b = data.basics;
    const lines = [b.email, b.phone, b.city].filter(Boolean).map(esc);
    return '<header class="running-head">' +
      '<div class="running-id">' +
        '<span class="running-name">' + esc(b.name || '你的名字') + '</span>' +
        (b.role ? '<span class="running-role">' + esc(b.role) + '</span>' : '') +
      '</div>' +
      (lines.length ? '<div class="running-contact">' + lines.join('<br>') + '</div>' : '') +
    '</header>';
  }

  function minimalPageFooterHTML(data) {
    const b = data.basics;
    return '<footer class="page-foot">' +
      '<span>' + esc(b.name || '') + (b.role ? ' · ' + esc(b.role) : '') + '</span>' +
      '<span class="page-label" data-page-label></span>' +
    '</footer>';
  }

  function createMinimalPage(data, index) {
    const first = index === 0;
    const contacts = contactHTML(data.basics);
    const html = (first
      ? minimalHeaderHTML(data) + (contacts ? '<div class="contact">' + contacts + '</div>' : '')
      : minimalRunningHeadHTML(data)) +
      '<div class="page-flow"></div>' +
      minimalPageFooterHTML(data);
    return makePaper(html, 'page');
  }

  function sidebarAsideHTML(data, compact) {
    const b = data.basics;
    const sideContacts = contactList(b).map((item) =>
      '<div>' + icon(item.icon) + '<span>' + esc(item.text) + '</span></div>'
    ).join('');
    const photo = photoHTML(b, 'side-photo');
    const name = '<div class="side-name">' + esc(b.name || '你的名字') + '</div>';
    const nameEn = b.nameEn ? '<div class="side-name-en">' + esc(b.nameEn) + '</div>' : '';
    const role = b.role ? '<div class="side-role">' + esc(b.role) + '</div>' : '';
    const contacts = sideContacts ? '<div class="side-contact">' + sideContacts + '</div>' : '';

    if (compact) {
      return '<aside class="side compact">' +
        photo + name + nameEn + role + contacts +
        '<div class="side-cont"><span>Continued</span><span>' + esc(displayUrl(b.website) || '') + '</span></div>' +
      '</aside>';
    }

    const sideFooter = b.website
      ? '<footer class="side-foot"><span>' + esc(displayUrl(b.website)) + '</span><span>' + esc(b.city || '') + '</span></footer>'
      : '';

    return '<aside class="side">' +
      photo + name + nameEn + role + contacts +
      sideSectionHTML('技能', 'SKILLS', sideSkillsBody(data.skills)) +
      sideSectionHTML('教育', 'EDUCATION', sideEducationBody(data.education)) +
      sideFooter +
    '</aside>';
  }

  function sidebarIntroHTML(data) {
    const b = data.basics;
    return b.tagline
      ? '<div class="main-intro"><div class="main-kicker">Profile</div><p>' + esc(b.tagline) + '</p></div>'
      : '';
  }

  function sidebarPageFooterHTML(data) {
    const b = data.basics;
    return '<footer class="rs-footer">' +
      '<span>' + esc(displayUrl(b.website) || b.city || '') + '</span>' +
      '<span class="page-label" data-page-label></span>' +
    '</footer>';
  }

  function createSidebarPage(data, index) {
    const first = index === 0;
    return makePaper(
      sidebarAsideHTML(data, !first) +
      '<main class="main">' +
        (first ? sidebarIntroHTML(data) : '') +
        '<div class="page-flow"></div>' +
        sidebarPageFooterHTML(data) +
      '</main>',
      'page'
    );
  }

  function editorialMastheadHTML(data) {
    const b = data.basics;
    const contacts = contactList(b);
    const hasPhoto = state.settings.showPhoto && !!b.photo;
    const mastClass = 'masthead' + (hasPhoto ? '' : ' no-photo') + (contacts.length ? '' : ' no-contact');
    const contactCol = contacts.length
      ? '<div class="contact-col">' + contacts.map((item) =>
          '<div>' + icon(item.icon) + '<span>' + esc(item.text) + '</span></div>'
        ).join('') + '</div>'
      : '';
    return '<header class="' + mastClass + '">' +
      contactCol +
      '<div class="title-col">' +
        (b.roleEn ? '<span class="cv-kicker">' + esc(b.roleEn) + '</span>' : '') +
        '<h1>' + esc(b.name || '你的名字') + '</h1>' +
        (b.role ? '<div class="role-line">' + esc(b.role) + '</div>' : '') +
        (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : '') +
      '</div>' +
      photoHTML(b, 'photo') +
    '</header>';
  }

  function editorialSideSectionsHTML(data) {
    return sectionHTML('教育背景', 'EDUCATION', educationBody(data.education)) +
      sectionHTML('技能', 'SKILLS', skillsBody(data.skills)) +
      sectionHTML('荣誉', 'HONORS', honorsBody(data.honors));
  }

  function editorialFooterHTML(data) {
    const b = data.basics;
    const footerName = b.nameEn || b.name;
    return '<footer class="ed-footer">' +
      (footerName ? '<span>' + esc(footerName) + '</span>' : '') +
      (b.website ? '<span>' + esc(displayUrl(b.website)) + '</span>' : '') +
      '<span class="page-label" data-page-label></span>' +
    '</footer>';
  }

  function editorialRunningHeadHTML(data) {
    const b = data.basics;
    const meta = [b.email, b.phone, b.city].filter(Boolean).map(esc);
    return '<header class="ed-running">' +
      '<div class="run-title">' +
        '<h2>' + esc(b.name || '你的名字') + '</h2>' +
        (b.role ? '<span class="run-role">' + esc(b.role) + '</span>' : '') +
      '</div>' +
      (meta.length ? '<div class="run-meta">' + meta.join(' · ') + '</div>' : '') +
    '</header>';
  }

  function createEditorialPage(data, index) {
    const first = index === 0;
    if (first) {
      return makePaper(
        editorialMastheadHTML(data) +
        '<div class="body-grid">' +
          '<div class="col-main"><div class="page-flow"></div></div>' +
          '<aside class="col-side">' + editorialSideSectionsHTML(data) + '</aside>' +
        '</div>' +
        editorialFooterHTML(data),
        'page'
      );
    }
    return makePaper(
      editorialRunningHeadHTML(data) +
      '<div class="body-grid continuation">' +
        '<div class="col-main"><div class="page-flow"></div></div>' +
      '</div>' +
      editorialFooterHTML(data),
      'page'
    );
  }

  function createPageForTemplate(data, index) {
    if (data.settings.template === 'sidebar') return createSidebarPage(data, index);
    if (data.settings.template === 'editorial') return createEditorialPage(data, index);
    return createMinimalPage(data, index);
  }

  function makeFlowSection(key, title, en, items, kind) {
    const section = { key: key, title: title, en: en, entries: [] };
    section.entries = items.map((item) => ({ section: section, kind: kind, item: item }));
    return section;
  }

  function entryHasVisibleContent(kind, item) {
    if (kind === 'experience') return !!(str(item.company).trim() || str(item.role).trim());
    if (kind === 'project') return !!(str(item.name).trim() || str(item.role).trim());
    if (kind === 'education') return !!(str(item.school).trim() || str(item.degree).trim());
    if (kind === 'skill') return !!str(item.items).trim();
    if (kind === 'honor') return !!str(item.text).trim();
    return true;
  }

  function flowSections(data) {
    const template = data.settings.template;
    const sections = [];
    const experience = data.experience.filter((item) => entryHasVisibleContent('experience', item));
    const projects = data.projects.filter((item) => entryHasVisibleContent('project', item));
    const education = data.education.filter((item) => entryHasVisibleContent('education', item));
    const skills = data.skills.filter((item) => entryHasVisibleContent('skill', item));
    const honors = data.honors.filter((item) => entryHasVisibleContent('honor', item));

    if (template === 'sidebar') {
      if (experience.length) sections.push(makeFlowSection('experience', '工作经历', 'EXPERIENCE', experience, 'experience'));
      if (projects.length) sections.push(makeFlowSection('projects', '项目经历', 'PROJECTS', projects, 'project'));
      if (honors.length) sections.push(makeFlowSection('honors', '荣誉', 'HONORS', honors, 'honor'));
      return sections;
    }
    if (template === 'editorial') {
      if (experience.length) sections.push(makeFlowSection('experience', '工作经历', 'EXPERIENCE', experience, 'experience'));
      if (projects.length) sections.push(makeFlowSection('projects', '项目经历', 'PROJECTS', projects, 'project'));
      return sections;
    }
    if (experience.length) sections.push(makeFlowSection('experience', '工作经历', 'EXPERIENCE', experience, 'experience'));
    if (projects.length) sections.push(makeFlowSection('projects', '项目经历', 'PROJECTS', projects, 'project'));
    if (education.length) sections.push(makeFlowSection('education', '教育背景', 'EDUCATION', education, 'education'));
    if (skills.length) sections.push(makeFlowSection('skills', '技能', 'SKILLS', skills, 'skill'));
    if (honors.length) sections.push(makeFlowSection('honors', '荣誉', 'HONORS', honors, 'honor'));
    return sections;
  }

  function renderEntryByKind(kind, item, bullets) {
    if (kind === 'experience') {
      return experienceEntryHTML({ ...item, bullets: bullets || item.bullets || [] });
    }
    if (kind === 'project') {
      return projectEntryHTML({ ...item, bullets: bullets || item.bullets || [] });
    }
    if (kind === 'education') return educationEntryHTML(item);
    if (kind === 'skill') return skillEntryHTML(item);
    return honorEntryHTML(item);
  }

  function pageOverflows(page) {
    const flow = page._flow;
    return !flow || flow.scrollHeight > flow.clientHeight + 1;
  }

  function buildPaginatedPages(data, breakBefore) {
    const forcedBreaks = breakBefore || new Set();
    const lab = $('#pagination-lab');
    lab.replaceChildren();
    const pages = [];
    const seenSections = new Set();
    let overflow = false;

    function addPage() {
      const page = createPageForTemplate(data, pages.length);
      lab.appendChild(page);
      page._flow = page.querySelector('.page-flow');
      pages.push(page);
      return {
        page: page,
        flow: page._flow,
        sectionKey: null,
        sectionEl: null,
        count: 0
      };
    }

    let current = addPage();

    function openSection(section) {
      if (current.sectionKey === section.key) return false;
      const sectionElement = document.createElement('section');
      sectionElement.className = 'rs-section';
      sectionElement.setAttribute('data-section', section.key);
      sectionElement.innerHTML = sectionHeadHTML(section.title, section.en, seenSections.has(section.key));
      current.flow.appendChild(sectionElement);
      current.sectionKey = section.key;
      current.sectionEl = sectionElement;
      return true;
    }

    function removeEmptySection(created) {
      if (!created || !current.sectionEl) return;
      if (current.sectionEl.querySelector('.rs-entry, .rs-edu, .rs-skill-row, .rs-honor')) return;
      current.sectionEl.remove();
      current.sectionKey = null;
      current.sectionEl = null;
    }

    function appendEntry(entry, bullets) {
      const created = openSection(entry.section);
      const holder = document.createElement('div');
      holder.innerHTML = renderEntryByKind(entry.kind, entry.item, bullets);
      const node = holder.firstElementChild;
      current.sectionEl.appendChild(node);
      if (!pageOverflows(current.page)) {
        current.count += 1;
        seenSections.add(entry.section.key);
        return true;
      }
      node.remove();
      removeEmptySection(created);
      return false;
    }

    function appendForced(entry, bullets) {
      openSection(entry.section);
      const holder = document.createElement('div');
      holder.innerHTML = renderEntryByKind(entry.kind, entry.item, bullets);
      current.sectionEl.appendChild(holder.firstElementChild);
      current.count += 1;
      seenSections.add(entry.section.key);
      overflow = true;
    }

    const jobs = [];
    flowSections(data).forEach((section) => {
      const forceBreak = forcedBreaks.has(section.key);
      section.entries.forEach((entry, entryIndex) => {
        jobs.push({
          entry: entry,
          forceBreak: forceBreak && entryIndex === 0,
          bullets: (entry.kind === 'experience' || entry.kind === 'project')
            ? cleanBullets(entry.item.bullets)
            : null
        });
      });
    });

    let jobIndex = 0;
    while (jobIndex < jobs.length) {
      const job = jobs[jobIndex];
      const entry = job.entry;

      if (job.forceBreak && current.count > 0) {
        current = addPage();
        continue;
      }

      if (appendEntry(entry, job.bullets)) {
        jobIndex += 1;
        continue;
      }

      // Try splitting the entry before giving up on the current page. This
      // matters most on page one, where a very long first job should not leave
      // an empty cover page behind.
      const canSplit = (job.bullets && job.bullets.length > 1);
      if (canSplit) {
        let rest = null;
        for (let take = job.bullets.length - 1; take >= 1; take -= 1) {
          if (appendEntry(entry, job.bullets.slice(0, take))) {
            rest = job.bullets.slice(take);
            break;
          }
        }
        if (rest && rest.length) {
          jobs.splice(jobIndex + 1, 0, { entry: entry, bullets: rest });
          jobIndex += 1;
          continue;
        }
      }

      if (current.count > 0 || pages.length === 1) {
        current = addPage();
        continue;
      }

      appendForced(entry, job.bullets);
      jobIndex += 1;
    }

    const total = pages.length;
    pages.forEach((page, index) => {
      if (page.scrollHeight > page.clientHeight + 1) overflow = true;
      page.querySelectorAll('[data-page-label]').forEach((label) => {
        label.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      });
    });

    return { pages: pages, overflow: overflow };
  }

  function pageFillRatio(page) {
    const flow = page._flow;
    if (!flow || !flow.lastElementChild) return 0;
    const top = flow.getBoundingClientRect().top;
    const bottom = flow.lastElementChild.getBoundingClientRect().bottom;
    return (bottom - top) / Math.max(1, flow.clientHeight);
  }

  function buildBalancedPages(data) {
    const sections = flowSections(data);
    let forcedBreaks = new Set();
    let result = buildPaginatedPages(data, forcedBreaks);

    // Two-page resumes tend to leave the last page nearly empty with a purely
    // greedy fill. Pull whole sections forward until the two pages are better
    // balanced. This is intentionally conservative: never move the first
    // flowing section, and only accept a move when it improves the smaller page.
    if (result.pages.length === 2 && sections.length >= 2) {
      let guard = 0;
      while (guard < 3) {
        guard += 1;
        const fills = result.pages.map(pageFillRatio);
        if (fills[1] >= 0.46 || fills[0] < 0.25) break;
        const firstSection = result.pages[1].querySelector('.rs-section');
        const firstKey = firstSection ? firstSection.getAttribute('data-section') : null;
        const index = sections.findIndex((section) => section.key === firstKey);
        if (index < 0) break;
        const pageOneKeys = new Set(Array.from(result.pages[0].querySelectorAll('.rs-section'))
          .map((node) => node.getAttribute('data-section')));
        // If the first section on page two is already split across the break,
        // move its first half forward too. Otherwise pull the preceding section.
        const targetIndex = pageOneKeys.has(firstKey) ? index : index - 1;
        if (targetIndex <= 0) break;
        const target = sections[targetIndex];
        if (!target || forcedBreaks.has(target.key)) break;
        const candidateBreaks = new Set(forcedBreaks);
        candidateBreaks.add(target.key);
        const candidate = buildPaginatedPages(data, candidateBreaks);
        if (candidate.pages.length !== 2) break;
        const candidateFills = candidate.pages.map(pageFillRatio);
        if (Math.min.apply(null, candidateFills) <= Math.min.apply(null, fills) + 0.008) break;
        forcedBreaks = candidateBreaks;
        result = candidate;
      }
    }

    return result;
  }


  /* ------------------------------------------------------------------------
     Editor HTML
     ------------------------------------------------------------------------ */
  const SECTION_META = {
    basics: { no: '01', title: '基本信息', en: 'BASICS' },
    experience: { no: '02', title: '工作经历', en: 'EXPERIENCE' },
    projects: { no: '03', title: '项目经历', en: 'PROJECTS' },
    education: { no: '04', title: '教育背景', en: 'EDUCATION' },
    skills: { no: '05', title: '技能', en: 'SKILLS' },
    honors: { no: '06', title: '荣誉与证书', en: 'HONORS' }
  };

  function fieldHTML(options) {
    const wide = options.wide ? ' is-wide' : '';
    const optional = options.optional ? '<span class="optional">选填</span>' : '';
    const scopeAttrs = 'data-scope="' + esc(options.scope) + '" data-field="' + esc(options.field) + '"' +
      (options.id ? ' data-id="' + esc(options.id) + '"' : '');
    const placeholder = options.placeholder ? ' placeholder="' + esc(options.placeholder) + '"' : '';
    const type = options.type || 'text';
    return '<label class="field' + wide + '">' +
      '<span class="field-label"><span>' + esc(options.label) + '</span>' + optional + '</span>' +
      '<input class="control" type="' + esc(type) + '" value="' + esc(options.value) + '"' + placeholder +
        ' autocomplete="off" spellcheck="false" ' + scopeAttrs + '>' +
    '</label>';
  }

  function textareaHTML(options) {
    const wide = options.wide ? ' is-wide' : '';
    const scopeAttrs = 'data-scope="' + esc(options.scope) + '" data-field="' + esc(options.field) + '"' +
      (options.id ? ' data-id="' + esc(options.id) + '"' : '');
    return '<label class="field' + wide + '">' +
      '<span class="field-label"><span>' + esc(options.label) + '</span>' +
        (options.optional ? '<span class="optional">选填</span>' : '') +
      '</span>' +
      '<textarea class="control"' + (options.placeholder ? ' placeholder="' + esc(options.placeholder) + '"' : '') +
        ' spellcheck="false" ' + scopeAttrs + '>' + esc(options.value) + '</textarea>' +
      (options.hint ? '<p class="field-hint">' + options.hint + '</p>' : '') +
    '</label>';
  }

  function photoEditorHTML() {
    const b = state.basics;
    const hasPhoto = !!b.photo;
    const adjust = ui.photoAdjustOpen && hasPhoto;
    return '<div class="photo-card">' +
      '<div class="photo-thumb">' +
        (hasPhoto ? '<img src="' + esc(b.photo) + '" alt="">' : '照') +
      '</div>' +
      '<div class="photo-copy">' +
        '<strong>个人照片</strong>' +
        '<span>' + (hasPhoto ? '已添加 · 可在海报中直接裁切' : 'JPG / PNG / WebP，建议 3:4') + '</span>' +
        '<div class="photo-actions">' +
          '<button class="mini-btn" type="button" data-action="upload-photo">' + (hasPhoto ? '更换照片' : '上传照片') + '</button>' +
          (hasPhoto ? '<button class="mini-btn" type="button" data-action="toggle-photo-adjust">' + (adjust ? '收起调整' : '调整') + '</button>' : '') +
          (hasPhoto ? '<button class="mini-btn is-quiet" type="button" data-action="remove-photo">移除</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="photo-adjust' + (adjust ? ' is-open' : '') + '">' +
      '<label class="mini-range"><span>水平<output data-photo-out="x">' + Math.round(b.photoX) + '%</output></span>' +
        '<input type="range" min="0" max="100" step="1" value="' + Math.round(b.photoX) + '" data-photo-adjust="x"></label>' +
      '<label class="mini-range"><span>垂直<output data-photo-out="y">' + Math.round(b.photoY) + '%</output></span>' +
        '<input type="range" min="0" max="100" step="1" value="' + Math.round(b.photoY) + '" data-photo-adjust="y"></label>' +
      '<label class="mini-range"><span>缩放<output data-photo-out="zoom">' + Number(b.photoZoom).toFixed(1) + '×</output></span>' +
        '<input type="range" min="100" max="200" step="1" value="' + Math.round(b.photoZoom * 100) + '" data-photo-adjust="zoom"></label>' +
    '</div>';
  }

  function basicsSectionHTML() {
    const b = state.basics;
    return '<div class="field-grid">' +
      fieldHTML({ label: '姓名', value: b.name, scope: 'basics', field: 'name', placeholder: '你的名字' }) +
      fieldHTML({ label: '求职方向 / 职位', value: b.role, scope: 'basics', field: 'role', placeholder: '产品设计师' }) +
      fieldHTML({ label: '英文名', value: b.nameEn, scope: 'basics', field: 'nameEn', placeholder: 'ZHIXIA LIN', optional: true }) +
      fieldHTML({ label: '英文职位', value: b.roleEn, scope: 'basics', field: 'roleEn', placeholder: 'PRODUCT DESIGNER', optional: true }) +
      fieldHTML({ label: '电话', value: b.phone, scope: 'basics', field: 'phone', placeholder: '+86 138 0000 0000', type: 'tel' }) +
      fieldHTML({ label: '邮箱', value: b.email, scope: 'basics', field: 'email', placeholder: 'you@example.com', type: 'email' }) +
      fieldHTML({ label: '城市', value: b.city, scope: 'basics', field: 'city', placeholder: '上海 · 徐汇' }) +
      fieldHTML({ label: '个人网站', value: b.website, scope: 'basics', field: 'website', placeholder: 'yourname.design', optional: true }) +
      fieldHTML({ label: '一句话简介', value: b.tagline, scope: 'basics', field: 'tagline', placeholder: '用一句话说明你的价值与方向', wide: true }) +
    '</div>';
  }

  function itemCardHTML(section, item, index, total, summaryMain, summarySub, fields) {
    const collapsed = ui.collapsedItems.has(item.id);
    return '<article class="item-card' + (collapsed ? ' is-collapsed' : '') + '" data-item-id="' + esc(item.id) + '">' +
      '<div class="item-top">' +
        '<button class="item-summary" type="button" data-action="toggle-item" aria-expanded="' + (!collapsed) + '">' +
          '<span class="summary-main">' + esc(summaryMain || '未命名条目') + '</span>' +
          (summarySub ? '<span class="summary-sub">' + esc(summarySub) + '</span>' : '') +
        '</button>' +
        '<div class="item-tools">' +
          '<button class="item-tool" type="button" data-action="move-item" data-dir="-1" aria-label="上移" title="上移"' + (index === 0 ? ' disabled' : '') + '>' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>' +
          '<button class="item-tool" type="button" data-action="move-item" data-dir="1" aria-label="下移" title="下移"' + (index === total - 1 ? ' disabled' : '') + '>' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>' +
          '<button class="item-tool" type="button" data-action="delete-item" aria-label="删除" title="删除">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-9 0 1 13h10l1-13M10 11v5M14 11v5"/></svg></button>' +
        '</div>' +
      '</div>' +
      '<div class="item-body"><div class="field-grid">' + fields + '</div></div>' +
    '</article>';
  }

  function experienceItemsHTML() {
    if (!state.experience.length) {
      return '<div class="empty-hint">还没有工作经历，点击下方按钮添加第一段经历。</div>';
    }
    return state.experience.map((item, index) => {
      const fields =
        fieldHTML({ label: '公司 / 组织', value: item.company, scope: 'experience', id: item.id, field: 'company', placeholder: '公司名称' }) +
        fieldHTML({ label: '职位', value: item.role, scope: 'experience', id: item.id, field: 'role', placeholder: '职位名称' }) +
        fieldHTML({ label: '时间', value: item.period, scope: 'experience', id: item.id, field: 'period', placeholder: '2022.07 — 至今' }) +
        fieldHTML({ label: '地点', value: item.location, scope: 'experience', id: item.id, field: 'location', placeholder: '上海', optional: true }) +
        textareaHTML({
          label: '经历要点', value: (item.bullets || []).join('\n'), scope: 'experience', id: item.id, field: 'bullets',
          placeholder: '每行一条，建议用结果与数字说明影响',
          hint: '每行一条，自动生成项目符号。'
        });
      return itemCardHTML('experience', item, index, state.experience.length, item.company, item.role, fields);
    }).join('');
  }

  function projectsItemsHTML() {
    if (!state.projects.length) {
      return '<div class="empty-hint">还没有项目，添加一个最能代表你的作品。</div>';
    }
    return state.projects.map((item, index) => {
      const fields =
        fieldHTML({ label: '项目名称', value: item.name, scope: 'projects', id: item.id, field: 'name', placeholder: '项目名称' }) +
        fieldHTML({ label: '角色', value: item.role, scope: 'projects', id: item.id, field: 'role', placeholder: '你的角色' }) +
        fieldHTML({ label: '时间', value: item.period, scope: 'projects', id: item.id, field: 'period', placeholder: '2024.03 — 2024.09' }) +
        fieldHTML({ label: '链接', value: item.link, scope: 'projects', id: item.id, field: 'link', placeholder: 'project.design', optional: true }) +
        textareaHTML({
          label: '项目要点', value: (item.bullets || []).join('\n'), scope: 'projects', id: item.id, field: 'bullets',
          placeholder: '背景、你的动作、结果',
          hint: '每行一条，建议包含背景、行动与结果。'
        });
      return itemCardHTML('projects', item, index, state.projects.length, item.name, item.role, fields);
    }).join('');
  }

  function educationItemsHTML() {
    if (!state.education.length) {
      return '<div class="empty-hint">还没有教育经历，点击下方按钮添加。</div>';
    }
    return state.education.map((item, index) => {
      const fields =
        fieldHTML({ label: '学校', value: item.school, scope: 'education', id: item.id, field: 'school', placeholder: '学校名称' }) +
        fieldHTML({ label: '学位 / 专业', value: item.degree, scope: 'education', id: item.id, field: 'degree', placeholder: '设计学 硕士' }) +
        fieldHTML({ label: '时间', value: item.period, scope: 'education', id: item.id, field: 'period', placeholder: '2017.09 — 2020.06' }) +
        fieldHTML({ label: '地点', value: item.location, scope: 'education', id: item.id, field: 'location', placeholder: '上海', optional: true }) +
        textareaHTML({
          label: '补充信息', value: item.detail, scope: 'education', id: item.id, field: 'detail',
          placeholder: '研究方向 / GPA / 奖学金，可换行',
          hint: '支持换行，例如研究方向、GPA、奖学金各占一行。',
          wide: true, optional: true
        });
      return itemCardHTML('education', item, index, state.education.length, item.school, item.degree, fields);
    }).join('');
  }

  function skillsItemsHTML() {
    if (!state.skills.length) {
      return '<div class="empty-hint">还没有技能分组，添加一组技能。</div>';
    }
    return state.skills.map((item, index) => {
      const fields =
        fieldHTML({ label: '分组名称', value: item.label, scope: 'skills', id: item.id, field: 'label', placeholder: '设计 / 技术 / 语言' }) +
        fieldHTML({ label: '技能内容', value: item.items, scope: 'skills', id: item.id, field: 'items', placeholder: 'Figma / Sketch / Framer', wide: true });
      return itemCardHTML('skills', item, index, state.skills.length, item.label, item.items, fields);
    }).join('');
  }

  function honorsItemsHTML() {
    if (!state.honors.length) {
      return '<div class="empty-hint">还没有荣誉或证书，添加一条。</div>';
    }
    return state.honors.map((item, index) => {
      const fields =
        fieldHTML({ label: '年份', value: item.year, scope: 'honors', id: item.id, field: 'year', placeholder: '2024' }) +
        fieldHTML({ label: '荣誉 / 证书', value: item.text, scope: 'honors', id: item.id, field: 'text', placeholder: '奖项或证书名称' });
      return itemCardHTML('honors', item, index, state.honors.length, item.text, item.year, fields);
    }).join('');
  }

  function editorSectionHTML(key, bodyHTML, addLabel) {
    const meta = SECTION_META[key];
    const isOpen = ui.openSections[key];
    const count = key === 'basics' ? 0 : state[key].length;
    return '<section class="editor-section' + (isOpen ? ' is-open' : '') + '" data-section="' + key + '">' +
      '<button class="section-head" type="button" data-action="toggle-section" aria-expanded="' + isOpen + '">' +
        '<span class="section-no">' + meta.no + '</span>' +
        '<span class="section-title">' + meta.title + '<em>' + meta.en + '</em></span>' +
        (key === 'basics' ? '' : '<span class="section-count">' + count + '</span>') +
        '<span class="section-chevron"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span>' +
      '</button>' +
      '<div class="section-body">' +
        bodyHTML +
        (addLabel ? '<button class="add-btn" type="button" data-action="add-item" data-list="' + key + '"><span>＋</span>' + addLabel + '</button>' : '') +
      '</div>' +
    '</section>';
  }

  function renderEditor() {
    const panel = $('#contentPanel');
    if (!panel) return;
    const html =
      editorSectionHTML('basics', photoEditorHTML() + basicsSectionHTML(), null) +
      editorSectionHTML('experience', experienceItemsHTML(), '添加工作经历') +
      editorSectionHTML('projects', projectsItemsHTML(), '添加项目') +
      editorSectionHTML('education', educationItemsHTML(), '添加教育经历') +
      editorSectionHTML('skills', skillsItemsHTML(), '添加技能分组') +
      editorSectionHTML('honors', honorsItemsHTML(), '添加荣誉 / 证书');
    panel.innerHTML = html;
  }

  /* ------------------------------------------------------------------------
     Paper rendering & preview metrics
     ------------------------------------------------------------------------ */
  function updateDocChrome() {
    const name = state.basics.name || '未命名简历';
    const role = state.basics.role || '简历';
    $('#docTitle').textContent = name + ' · ' + role;
    document.title = name + ' · 简历 | 纸间';
  }

  function measureSinglePageHeight() {
    const lab = $('#pagination-lab');
    if (!lab) return PAGE_H_PX;
    const template = TEMPLATES[state.settings.template] || renderMinimal;
    const probe = makePaper('', '');
    probe.innerHTML = template(state);
    lab.replaceChildren(probe);
    const height = probe.offsetHeight;
    lab.replaceChildren();
    return height;
  }

  function renderPaper() {
    const lab = $('#pagination-lab');
    const stack = $('#paperStack');
    if (!lab || !stack) return;

    lab.replaceChildren();
    const template = TEMPLATES[state.settings.template] || renderMinimal;
    const single = makePaper('', '');
    single.innerHTML = template(state);
    lab.appendChild(single);
    let pages = [single];
    let paginated = false;
    let overflow = false;

    if (single.offsetHeight > PAGE_H_PX + 1) {
      const result = buildBalancedPages(state);
      pages = result.pages;
      paginated = true;
      overflow = result.overflow;
    }

    stack.replaceChildren(...pages);
    if (pages[0]) pages[0].id = 'paper';
    ui.pageCount = pages.length;
    ui.paginated = paginated;
    updatePageMetrics(pages.length, paginated, overflow);
    updateDocChrome();
  }

  function renderPreview(options) {
    const opts = options || {};
    renderPaper();
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = requestAnimationFrame(function () {
      previewRaf = null;
      if (opts.refit && ui.zoomMode === 'fit') {
        ui.zoom = computeFitZoom();
      }
      applyZoom(ui.zoom);
    });
  }

  function queuePreview() {
    if (previewRaf) return;
    previewRaf = requestAnimationFrame(function () {
      previewRaf = null;
      renderPaper();
      applyZoom(ui.zoom);
    });
  }

  function updatePageMetrics(pageCount, paginated, overflow) {
    const badge = $('#pageBadge');
    const fitButton = $('#fitPageBtn');
    if (badge) {
      badge.textContent = pageCount + ' 页 · A4';
      badge.classList.toggle('is-warn', overflow);
      badge.title = paginated
        ? (overflow ? '内容已分为 ' + pageCount + ' 页，有条目超过整页，建议拆分' : '内容已分为 ' + pageCount + ' 页 A4')
        : 'A4 单页';
    }
    if (fitButton) fitButton.hidden = pageCount <= 1;
  }

  function computeFitZoom() {
    const stack = $('#paperStack');
    const firstPage = stack && stack.querySelector('.paper');
    const scroll = $('#canvasScroll');
    if (!stack || !firstPage || !scroll) return 0.72;
    const availableWidth = Math.max(220, scroll.clientWidth - 88);
    const availableHeight = Math.max(260, scroll.clientHeight - 72);
    const visibleHeight = Math.min(firstPage.offsetHeight, PAGE_H_PX * 1.03);
    return clamp(Math.min(availableWidth / PAGE_W_PX, availableHeight / visibleHeight, 1), 0.3, 1);
  }

  function applyZoom(zoom) {
    const stack = $('#paperStack');
    const shell = $('#paperShell');
    const label = $('#zoomLabel');
    if (!stack || !shell) return;
    const value = clamp(zoom || 0.72, 0.3, 1.5);
    ui.zoom = value;
    const width = stack.offsetWidth;
    const height = stack.offsetHeight;
    shell.style.width = (width * value) + 'px';
    shell.style.height = (height * value) + 'px';
    stack.style.transform = 'scale(' + value + ')';
    if (label) label.textContent = Math.round(value * 100) + '%';
  }

  function setManualZoom(next) {
    ui.zoomMode = 'manual';
    applyZoom(clamp(next, 0.3, 1.5));
  }

  /* ------------------------------------------------------------------------
     Save / toast / confirm
     ------------------------------------------------------------------------ */
  function setSaveState(mode, text) {
    const node = $('#saveState');
    if (!node) return;
    node.classList.toggle('is-saving', mode === 'saving');
    node.classList.toggle('is-error', mode === 'error');
    const label = node.querySelector('span');
    if (label) label.textContent = text;
  }

  function saveNow(options) {
    const opts = options || {};
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    state.savedAt = (opts.keepSavedAt && state.savedAt) ? state.savedAt : new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      ui.lastSaved = new Date();
      setSaveState('saved', '已保存 ' + formatTime(ui.lastSaved));
    } catch (error) {
      setSaveState('error', '仅本次有效');
      if (!opts.quiet) showToast('浏览器存储空间不足，照片可能过大。可先导出 JSON 备份。');
    }
    if (!opts.skipServer) scheduleServerSync();
  }

  function queueSave() {
    setSaveState('saving', '保存中…');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveNow();
    }, 420);
  }

  function scheduleServerSync() {
    if (!syncAvailable) return;
    if (serverSaveTimer) clearTimeout(serverSaveTimer);
    serverSaveTimer = setTimeout(function () {
      serverSaveTimer = null;
      pushStateToServer();
    }, 120);
  }

  function serverPayload() {
    const copy = clone(state);
    // Once the image file exists on disk, subsequent saves only need its path.
    // This keeps ordinary edits tiny and makes sendBeacon safe for unload.
    if (copy.basics && copy.basics.photoPath && copy.basics.photo &&
        str(copy.basics.photo).startsWith('data:')) {
      copy.basics.photo = copy.basics.photoPath;
    }
    return JSON.stringify(copy);
  }

  async function pushStateToServer() {
    if (!syncAvailable) return false;
    if (serverSaveInFlight) {
      serverSaveQueued = true;
      return false;
    }
    serverSaveInFlight = true;
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serverPayload()
      });
      if (!response.ok) throw new Error('sync-failed');
      const info = await response.json();
      if (info && info.photo) state.basics.photoPath = info.photo;
      setSaveState('saved', '已同步 ' + formatTime(new Date()));
      return true;
    } catch (error) {
      setSaveState('error', '本地同步失败');
      return false;
    } finally {
      serverSaveInFlight = false;
      if (serverSaveQueued) {
        serverSaveQueued = false;
        setTimeout(pushStateToServer, 0);
      }
    }
  }

  function flushServerSync() {
    if (!syncAvailable) return;
    try {
      const payload = new Blob([serverPayload()], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon('/api/state', payload)) return;
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serverPayload(),
        keepalive: true
      }).catch(function () { /* best effort on unload */ });
    } catch (error) {
      // Best effort only.
    }
  }

  async function bootstrapLocalSync() {
    if (!/^https?:$/.test(location.protocol)) {
      syncBootstrapped = true;
      if (!loadedFromStorage) saveNow({ quiet: true });
      return;
    }
    try {
      const health = await fetch('/api/health', { cache: 'no-store' });
      if (!health.ok) throw new Error('no-local-api');
      const healthInfo = await health.json().catch(function () { return null; });
      if (!healthInfo || !healthInfo.ok) throw new Error('no-local-api');

      setSaveState('saving', '读取本地文件…');
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (response.ok) {
        const raw = await response.json();
        const serverSaved = Date.parse(raw.savedAt || '') || 0;
        const localSaved = Date.parse(state.savedAt || '') || 0;
        if (!localSaved || serverSaved >= localSaved) {
          const hydrated = await hydrateServerState(raw);
          applyState(hydrated);
          state.savedAt = raw.savedAt || state.savedAt;
          saveNow({ quiet: true, skipServer: true, keepSavedAt: true });
          setSaveState('saved', '已读取本地文件');
          showToast('已读取本地文件，修改会自动保存', { duration: 4200 });
        } else {
          syncAvailable = true;
          await pushStateToServer();
          showToast('已将当前修改同步到本地文件', { duration: 3500 });
        }
      } else if (response.status === 404) {
        syncAvailable = true;
        if (loadedFromStorage) {
          saveNow({ quiet: true, skipServer: true });
          await pushStateToServer();
          showToast('已开启本地自动保存', { duration: 3500 });
        } else {
          // Do not write the demo sample to disk on a brand-new browser;
          // wait for the first real edit so another browser's saved state is
          // never overwritten by a throwaway preview.
          setSaveState('saved', '本地文件已连接');
          showToast('已连接本地文件，编辑后会自动保存', { duration: 3500 });
        }
      } else {
        throw new Error('state-read-failed');
      }
      syncAvailable = true;
      syncBootstrapped = true;
      if (!document.querySelector('.toast')) setSaveState('saved', '本地文件已连接');
    } catch (error) {
      syncAvailable = false;
      syncBootstrapped = true;
      if (!loadedFromStorage) saveNow({ quiet: true });
      setSaveState('saved', '已保存 ' + formatTime(ui.lastSaved));
    }
  }

  function showToast(message, options) {
    const opts = options || {};
    const region = $('#toastRegion');
    if (!region) return;
    if (toastTimer) clearTimeout(toastTimer);
    region.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<span>' + esc(message) + '</span>' +
      (opts.action ? '<button type="button">' + esc(opts.action) + '</button>' : '');
    region.appendChild(toast);
    const actionButton = toast.querySelector('button');
    if (actionButton && typeof opts.onAction === 'function') {
      actionButton.addEventListener('click', function () {
        removeToast(toast);
        opts.onAction();
      }, { once: true });
    }
    toastTimer = setTimeout(function () { removeToast(toast); }, opts.duration || 3400);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('is-leaving');
    setTimeout(function () { toast.remove(); }, 190);
  }

  function confirmDialog(options) {
    const opts = options || {};
    const layer = $('#confirmLayer');
    if (!layer) return Promise.resolve(false);
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
    $('#confirmTitle').textContent = opts.title || '确认操作';
    $('#confirmMsg').textContent = opts.message || '';
    $('#confirmOk').textContent = opts.okLabel || '确认';
    $('#confirmOk').classList.toggle('btn-danger', opts.danger !== false);
    $('#confirmOk').classList.toggle('btn-primary', opts.danger === false);
    layer.hidden = false;
    return new Promise(function (resolve) {
      confirmResolver = resolve;
      requestAnimationFrame(function () { $('#confirmCancel').focus(); });
    });
  }

  function settleConfirm(value) {
    const layer = $('#confirmLayer');
    if (layer) layer.hidden = true;
    if (typeof confirmResolver === 'function') {
      const resolve = confirmResolver;
      confirmResolver = null;
      resolve(value);
    }
  }

  /* ------------------------------------------------------------------------
     Editor interactions
     ------------------------------------------------------------------------ */
  function getListItem(section, id) {
    const list = state[section];
    if (!Array.isArray(list)) return null;
    return list.find((item) => item.id === id) || null;
  }

  function handleEditorInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches('[data-photo-adjust]')) {
      const field = target.getAttribute('data-photo-adjust');
      const value = Number(target.value);
      if (field === 'zoom') {
        state.basics.photoZoom = clamp(value / 100, 1, 2);
        const out = $('[data-photo-out="zoom"]');
        if (out) out.textContent = state.basics.photoZoom.toFixed(1) + '×';
      } else if (field === 'x') {
        state.basics.photoX = clamp(value, 0, 100);
        const out = $('[data-photo-out="x"]');
        if (out) out.textContent = Math.round(state.basics.photoX) + '%';
      } else if (field === 'y') {
        state.basics.photoY = clamp(value, 0, 100);
        const out = $('[data-photo-out="y"]');
        if (out) out.textContent = Math.round(state.basics.photoY) + '%';
      }
      queuePreview();
      queueSave();
      return;
    }

    if (!target.matches('[data-scope]')) return;
    const scope = target.getAttribute('data-scope');
    const field = target.getAttribute('data-field');
    const id = target.getAttribute('data-id');
    if (!scope || !field) return;

    if (scope === 'basics') {
      state.basics[field] = target.value;
      updateDocChrome();
    } else {
      const item = getListItem(scope, id);
      if (!item) return;
      item[field] = field === 'bullets' ? cleanBullets(target.value) : target.value;
    }
    queuePreview();
    queueSave();
  }

  function makeNewItem(section) {
    const base = { id: uid(section) };
    if (section === 'experience') return Object.assign(base, { company: '', role: '', period: '', location: '', bullets: [] });
    if (section === 'projects') return Object.assign(base, { name: '', role: '', period: '', link: '', bullets: [] });
    if (section === 'education') return Object.assign(base, { school: '', degree: '', period: '', location: '', detail: '' });
    if (section === 'skills') return Object.assign(base, { label: '', items: '' });
    if (section === 'honors') return Object.assign(base, { year: '', text: '' });
    return base;
  }

  function addItem(section) {
    if (!Array.isArray(state[section])) return;
    const item = makeNewItem(section);
    state[section].push(item);
    ui.openSections[section] = true;
    ui.collapsedItems.delete(item.id);
    renderEditor();
    renderPreview();
    queueSave();
    requestAnimationFrame(function () {
      const card = document.querySelector('[data-item-id="' + item.id + '"]');
      if (!card) return;
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const input = card.querySelector('.control');
      if (input) input.focus();
    });
  }

  function deleteItem(section, id) {
    const list = state[section];
    if (!Array.isArray(list)) return;
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return;
    const snapshot = clone(state);
    list.splice(index, 1);
    ui.collapsedItems.delete(id);
    renderEditor();
    renderPreview();
    queueSave();
    showToast('已删除这一条', {
      action: '撤销',
      onAction: function () {
        state = snapshot;
        renderEditor();
        renderPreview({ refit: ui.zoomMode === 'fit' });
        queueSave();
        showToast('已恢复');
      },
      duration: 4500
    });
  }

  function moveItem(section, id, direction) {
    const list = state[section];
    if (!Array.isArray(list)) return;
    const index = list.findIndex((item) => item.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    const temp = list[index];
    list[index] = list[next];
    list[next] = temp;
    renderEditor();
    renderPreview();
    queueSave();
    const card = document.querySelector('[data-item-id="' + id + '"]');
    if (card) card.scrollIntoView({ block: 'nearest' });
  }

  function handleEditorClick(event) {
    const actionNode = event.target.closest('[data-action]');
    if (!actionNode) return;
    const action = actionNode.getAttribute('data-action');

    if (action === 'dismiss-note') {
      $('#demoNote').hidden = true;
      ui.noteDismissed = true;
      return;
    }

    if (action === 'toggle-section') {
      const section = actionNode.closest('.editor-section');
      if (!section) return;
      const key = section.getAttribute('data-section');
      ui.openSections[key] = !ui.openSections[key];
      section.classList.toggle('is-open', ui.openSections[key]);
      actionNode.setAttribute('aria-expanded', String(ui.openSections[key]));
      return;
    }

    if (action === 'toggle-item') {
      const card = actionNode.closest('.item-card');
      if (!card) return;
      const id = card.getAttribute('data-item-id');
      const collapsed = card.classList.toggle('is-collapsed');
      if (collapsed) ui.collapsedItems.add(id); else ui.collapsedItems.delete(id);
      actionNode.setAttribute('aria-expanded', String(!collapsed));
      return;
    }

    if (action === 'add-item') {
      addItem(actionNode.getAttribute('data-list'));
      return;
    }

    if (action === 'delete-item') {
      const card = actionNode.closest('.item-card');
      const section = actionNode.closest('.editor-section');
      if (!card || !section) return;
      deleteItem(section.getAttribute('data-section'), card.getAttribute('data-item-id'));
      return;
    }

    if (action === 'move-item') {
      const card = actionNode.closest('.item-card');
      const section = actionNode.closest('.editor-section');
      if (!card || !section) return;
      moveItem(section.getAttribute('data-section'), card.getAttribute('data-item-id'), Number(actionNode.getAttribute('data-dir')));
      return;
    }

    if (action === 'upload-photo') {
      const input = $('#photoInput');
      if (input) {
        input.value = '';
        input.click();
      }
      return;
    }

    if (action === 'remove-photo') {
      state.basics.photo = '';
      state.basics.photoPath = '';
      ui.photoAdjustOpen = false;
      renderEditor();
      renderPreview();
      queueSave();
      showToast('已移除照片');
      return;
    }

    if (action === 'toggle-photo-adjust') {
      ui.photoAdjustOpen = !ui.photoAdjustOpen;
      const adjust = $('.photo-adjust');
      if (adjust) adjust.classList.toggle('is-open', ui.photoAdjustOpen);
      actionNode.textContent = ui.photoAdjustOpen ? '收起调整' : '调整';
      return;
    }
  }

  /* ------------------------------------------------------------------------
     Photo upload
     ------------------------------------------------------------------------ */
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file.type.startsWith('image/')) {
        reject(new Error('not-image'));
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        reject(new Error('too-large'));
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        try {
          const maxDim = 1000;
          const ratio = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(1, Math.round(image.naturalWidth * ratio));
          const height = Math.max(1, Math.round(image.naturalHeight * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('load-failed'));
      };
      image.src = objectUrl;
    });
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    try {
      showToast('正在处理照片…', { duration: 1200 });
      const dataUrl = await compressImage(file);
      state.basics.photo = dataUrl;
      state.basics.photoPath = '';
      state.basics.photoX = 50;
      state.basics.photoY = 34;
      state.basics.photoZoom = 1;
      state.settings.showPhoto = true;
      ui.photoAdjustOpen = true;
      renderEditor();
      renderPreview({ refit: ui.zoomMode === 'fit' });
      syncDesignControls();
      saveNow();
      showToast('照片已添加，可调整位置与缩放');
    } catch (error) {
      const message = error && error.message === 'too-large'
        ? '照片超过 12MB，请先压缩后再上传。'
        : '无法读取这张照片，请换一张 JPG / PNG 图片。';
      showToast(message);
    }
  }

  /* ------------------------------------------------------------------------
     Design controls
     ------------------------------------------------------------------------ */
  function updateRangeFill(input) {
    if (!input) return;
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const percent = ((value - min) / (max - min)) * 100;
    input.style.setProperty('--fill', percent + '%');
  }

  function syncTemplateUI() {
    $$('[data-template]').forEach(function (button) {
      const active = button.getAttribute('data-template') === state.settings.template;
      button.classList.toggle('is-active', active);
      if (button.classList.contains('template-card')) {
        button.setAttribute('aria-pressed', String(active));
      }
    });
  }

  function syncAccentUI() {
    const accent = state.settings.accent.toLowerCase();
    let matched = false;
    $$('.swatch-row .swatch[data-accent]').forEach(function (button) {
      const active = button.getAttribute('data-accent').toLowerCase() === accent;
      button.classList.toggle('is-active', active);
      matched = matched || active;
    });
    const custom = $('.swatch-custom');
    if (custom) custom.classList.toggle('is-active', !matched);
    const picker = $('#customColor');
    if (picker) picker.value = state.settings.accent;
  }

  function syncDesignControls() {
    const settings = state.settings;
    syncTemplateUI();
    syncAccentUI();

    $$('#typefaceGroup button').forEach(function (button) {
      const active = button.getAttribute('data-typeface') === settings.typeface;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const fontInput = $('#fontSize');
    if (fontInput) {
      fontInput.value = String(Math.round(settings.fontSize * 100));
      updateRangeFill(fontInput);
    }
    const lineInput = $('#lineHeight');
    if (lineInput) {
      lineInput.value = String(Math.round(settings.lineHeight * 100));
      updateRangeFill(lineInput);
    }
    const marginInput = $('#pageMargin');
    if (marginInput) {
      marginInput.value = String(Math.round(settings.margin));
      updateRangeFill(marginInput);
    }
    const fontOut = $('#fontSizeOut');
    if (fontOut) fontOut.textContent = Math.round(settings.fontSize * 100) + '%';
    const lineOut = $('#lineHeightOut');
    if (lineOut) lineOut.textContent = settings.lineHeight.toFixed(2);
    const marginOut = $('#pageMarginOut');
    if (marginOut) marginOut.textContent = Math.round(settings.margin) + ' mm';

    const showPhoto = $('#showPhotoToggle');
    if (showPhoto) showPhoto.checked = settings.showPhoto;
    const bilingual = $('#bilingualToggle');
    if (bilingual) bilingual.checked = settings.bilingual;
  }

  function setTemplate(template) {
    if (!['minimal', 'sidebar', 'editorial'].includes(template) || template === state.settings.template) return;
    state.settings.template = template;
    syncTemplateUI();
    renderPreview({ refit: ui.zoomMode === 'fit' });
    queueSave();
  }

  function setAccent(accent) {
    const next = normalizeHex(accent, state.settings.accent);
    state.settings.accent = next;
    syncAccentUI();
    renderPreview();
    queueSave();
  }

  function setTypeface(typeface) {
    if (!['sans', 'serif', 'mix'].includes(typeface)) return;
    state.settings.typeface = typeface;
    $$('#typefaceGroup button').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-typeface') === typeface);
    });
    renderPreview();
    queueSave();
  }

  function bindDesignPanel() {
    const panel = $('#designPanel');
    if (!panel) return;

    panel.addEventListener('click', function (event) {
      const templateButton = event.target.closest('[data-template]');
      if (templateButton) {
        setTemplate(templateButton.getAttribute('data-template'));
        return;
      }
      const accentButton = event.target.closest('[data-accent]');
      if (accentButton) {
        setAccent(accentButton.getAttribute('data-accent'));
        return;
      }
      const typeButton = event.target.closest('[data-typeface]');
      if (typeButton) {
        setTypeface(typeButton.getAttribute('data-typeface'));
      }
    });

    const customColor = $('#customColor');
    if (customColor) {
      customColor.addEventListener('input', function (event) {
        setAccent(event.target.value);
      });
    }

    const fontInput = $('#fontSize');
    if (fontInput) {
      fontInput.addEventListener('input', function (event) {
        state.settings.fontSize = Number(event.target.value) / 100;
        $('#fontSizeOut').textContent = Math.round(state.settings.fontSize * 100) + '%';
        updateRangeFill(event.target);
        renderPreview({ refit: ui.zoomMode === 'fit' });
        queueSave();
      });
    }

    const lineInput = $('#lineHeight');
    if (lineInput) {
      lineInput.addEventListener('input', function (event) {
        state.settings.lineHeight = Number(event.target.value) / 100;
        $('#lineHeightOut').textContent = state.settings.lineHeight.toFixed(2);
        updateRangeFill(event.target);
        renderPreview({ refit: ui.zoomMode === 'fit' });
        queueSave();
      });
    }

    const marginInput = $('#pageMargin');
    if (marginInput) {
      marginInput.addEventListener('input', function (event) {
        state.settings.margin = Number(event.target.value);
        $('#pageMarginOut').textContent = Math.round(state.settings.margin) + ' mm';
        updateRangeFill(event.target);
        renderPreview({ refit: ui.zoomMode === 'fit' });
        queueSave();
      });
    }

    const showPhoto = $('#showPhotoToggle');
    if (showPhoto) {
      showPhoto.addEventListener('change', function (event) {
        state.settings.showPhoto = event.target.checked;
        renderPreview({ refit: ui.zoomMode === 'fit' });
        queueSave();
      });
    }

    const bilingual = $('#bilingualToggle');
    if (bilingual) {
      bilingual.addEventListener('change', function (event) {
        state.settings.bilingual = event.target.checked;
        renderPreview({ refit: ui.zoomMode === 'fit' });
        queueSave();
      });
    }
  }

  /* ------------------------------------------------------------------------
     Tabs / zoom / mobile
     ------------------------------------------------------------------------ */
  function switchTab(tab) {
    ui.tab = tab;
    $$('.editor-tab').forEach(function (button) {
      const active = button.getAttribute('data-tab') === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const content = $('#contentPanel');
    const design = $('#designPanel');
    if (content) content.hidden = tab !== 'content';
    if (design) design.hidden = tab !== 'design';
    if (tab === 'design') syncDesignControls();
    const scroll = $('#editorScroll');
    if (scroll) scroll.scrollTop = 0;
  }

  function bindZoom() {
    $('#zoomIn')?.addEventListener('click', function () { setManualZoom(ui.zoom + 0.1); });
    $('#zoomOut')?.addEventListener('click', function () { setManualZoom(ui.zoom - 0.1); });
    $('#fitBtn')?.addEventListener('click', function () {
      ui.zoomMode = 'fit';
      applyZoom(computeFitZoom());
    });
    $('#fitPageBtn')?.addEventListener('click', fitToOnePage);

    const scroll = $('#canvasScroll');
    if (scroll) {
      scroll.addEventListener('wheel', function (event) {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setManualZoom(ui.zoom + (event.deltaY > 0 ? -0.05 : 0.05));
      }, { passive: false });
    }
  }

  function fitToOnePage() {
    const startSettings = {
      fontSize: state.settings.fontSize,
      lineHeight: state.settings.lineHeight
    };
    const target = PAGE_H_PX + 0.5;
    let found = false;
    outer:
    for (let lh = Math.round(startSettings.lineHeight * 100); lh >= 135; lh -= 3) {
      for (let fs = Math.round(startSettings.fontSize * 100); fs >= 88; fs -= 2) {
        state.settings.lineHeight = lh / 100;
        state.settings.fontSize = fs / 100;
        if (measureSinglePageHeight() <= target) {
          found = true;
          break outer;
        }
      }
    }
    if (!found) {
      state.settings.fontSize = startSettings.fontSize;
      state.settings.lineHeight = startSettings.lineHeight;
      renderPaper();
      applyZoom(ui.zoom);
      showToast('内容较长，自动压缩仍超出一页，建议精简内容。');
      return;
    }
    syncDesignControls();
    renderPaper();
    if (ui.zoomMode === 'fit') applyZoom(computeFitZoom()); else applyZoom(ui.zoom);
    queueSave();
    showToast('已压缩至一页：字号 ' + Math.round(state.settings.fontSize * 100) + '%，行距 ' + state.settings.lineHeight.toFixed(2));
  }

  /* ------------------------------------------------------------------------
     Export / import
     ------------------------------------------------------------------------ */
  function safeFilename() {
    const name = (state.basics.name || '我的简历').replace(/[\\/:*?"<>|]/g, '').trim();
    const role = (state.basics.role || '').replace(/[\\/:*?"<>|]/g, '').trim();
    return (name + (role ? '-' + role : '') + '-简历').replace(/\s+/g, '-');
  }

  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function buildExportHTML() {
    const stack = $('#paperStack');
    const resumeCSS = $('#resume-styles').textContent;
    const stackClone = stack.cloneNode(true);
    stackClone.removeAttribute('id');
    stackClone.style.transform = '';
    stackClone.querySelectorAll('.paper').forEach((page) => {
      page.removeAttribute('id');
      page.style.transform = '';
    });
    const name = state.basics.name || '我的简历';
    const role = state.basics.role || '';

    return '<!doctype html>\n' +
'<html lang="zh-CN">\n<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <meta name="generator" content="纸间 Resume Studio">\n' +
'  <title>' + esc(name + (role ? ' · ' + role : '') + ' | 简历') + '</title>\n' +
'  <style>\n' +
'    /* ---- resume styles (copied from the studio) ---- */\n' +
resumeCSS +
'\n    /* ---- standalone pages ---- */\n' +
'    html, body { margin: 0; padding: 0; background: #e9e6df; color: #24211d; }\n' +
'    body { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 32px 18px 76px; }\n' +
'    .paper-stack { display: flex; flex-direction: column; align-items: stretch; gap: 26px; }\n' +
'    .paper { flex: 0 0 auto; box-shadow: 0 2px 4px rgba(42,35,26,.08), 0 24px 70px rgba(42,35,26,.18); }\n' +
'    .export-actions { position: fixed; right: 22px; bottom: 22px; display: flex; align-items: center; gap: 10px; z-index: 20; }\n' +
'    .export-hint { color: #6f675a; font: 11px/1.4 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: rgba(255,253,248,.92); border: 1px solid #ddd6c9; border-radius: 7px; padding: 7px 10px; box-shadow: 0 4px 16px rgba(40,33,24,.08); }\n' +
'    .export-print { border: 0; border-radius: 7px; background: #24211d; color: #fffdf8; font: 600 11px/1 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; padding: 11px 15px; cursor: pointer; box-shadow: 0 4px 14px rgba(40,33,24,.22); }\n' +
'    .export-print:hover { background: #11100e; }\n' +
'    @media (max-width: 860px) { body { padding: 14px 8px 70px; } .export-hint { display: none; } }\n' +
'    @media print { @page { size: A4; margin: 0; } html, body { background: #fff !important; padding: 0 !important; display: block !important; } .paper-stack { display: block !important; width: 210mm !important; gap: 0 !important; } .paper { width: 210mm !important; box-shadow: none !important; margin: 0 !important; transform: none !important; break-after: page; page-break-after: always; } .paper:last-child { break-after: auto; page-break-after: auto; } .export-actions { display: none !important; } }\n' +
'  </style>\n</head>\n<body>\n' +
stackClone.outerHTML + '\n' +
'  <div class="export-actions">\n' +
'    <span class="export-hint">在打印窗口中选择「存储为 PDF」</span>\n' +
'    <button class="export-print" type="button" onclick="window.print()">打印 / 保存为 PDF</button>\n' +
'  </div>\n' +
'</body>\n</html>\n';
  }

  function exportHTML() {
    const html = buildExportHTML();
    downloadBlob(safeFilename() + '.html', html, 'text/html;charset=utf-8');
    showToast('HTML 已导出，可直接打开或打印为 PDF');
  }

  function exportJSON() {
    downloadBlob(safeFilename() + '.json', JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    showToast('JSON 源文件已导出');
  }

  async function importJSON(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw = parsed && parsed.data && parsed.data.basics ? parsed.data : parsed;
      if (!raw || typeof raw !== 'object') throw new Error('invalid');
      const hydrated = await hydrateServerState(raw);
      state = hydrated;
      state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings);
      ui.collapsedItems.clear();
      ui.openSections.basics = true;
      ui.openSections.experience = true;
      renderEditor();
      syncDesignControls();
      renderPreview({ refit: true });
      saveNow();
      showToast('简历已导入');
    } catch (error) {
      showToast('导入失败：文件不是有效的简历 JSON');
    }
  }

  function printResume() {
    saveNow({ quiet: true });
    showToast('在打印窗口中选择「存储为 PDF」', { duration: 2600 });
    setTimeout(function () { window.print(); }, 160);
  }

  function bindPrintClone() {
    window.addEventListener('beforeprint', function () {
      const root = $('#print-root');
      const stack = $('#paperStack');
      if (!root || !stack) return;
      const clone = stack.cloneNode(true);
      clone.id = 'print-paper-stack';
      clone.style.transform = 'none';
      clone.querySelectorAll('.paper').forEach((page) => page.removeAttribute('id'));
      root.replaceChildren(clone);
    });
    window.addEventListener('afterprint', function () {
      const root = $('#print-root');
      if (root) root.replaceChildren();
    });
  }

  /* ------------------------------------------------------------------------
     Menu / reset / clear
     ------------------------------------------------------------------------ */
  function closeMenu() {
    const menu = $('#moreMenu');
    const button = $('#moreBtn');
    if (menu) menu.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    const menu = $('#moreMenu');
    const button = $('#moreBtn');
    if (!menu || !button) return;
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function resetToSample() {
    confirmDialog({
      title: '恢复示例简历？',
      message: '当前编辑的内容会被示例内容替换。建议先导出 JSON 备份。',
      okLabel: '恢复示例'
    }).then(function (ok) {
      if (!ok) return;
      state = normalizeData(sampleData());
      ui.collapsedItems.clear();
      ui.openSections = { basics: true, experience: true, education: false, projects: false, skills: false, honors: false };
      renderEditor();
      syncDesignControls();
      renderPreview({ refit: true });
      saveNow();
      showToast('已恢复示例简历');
    });
  }

  function loadMultipageSample() {
    confirmDialog({
      title: '载入两页示例？',
      message: '当前内容会被两页示例替换，可在右侧预览自动分页效果。',
      okLabel: '载入示例'
    }).then(function (ok) {
      if (!ok) return;
      state = normalizeData(multipageSampleData());
      ui.collapsedItems.clear();
      ui.openSections = { basics: true, experience: true, education: false, projects: false, skills: false, honors: false };
      renderEditor();
      syncDesignControls();
      renderPreview({ refit: true });
      saveNow();
      showToast('已载入两页示例，内容已自动分页');
    });
  }

  function clearAll() {
    confirmDialog({
      title: '清空全部内容？',
      message: '姓名、经历、照片等内容会被清空，当前版式设置会保留。此操作可以撤销。',
      okLabel: '清空内容'
    }).then(function (ok) {
      if (!ok) return;
      const snapshot = clone(state);
      state = emptyData(state.settings);
      ui.collapsedItems.clear();
      ui.openSections = { basics: true, experience: true, education: true, projects: false, skills: false, honors: false };
      renderEditor();
      syncDesignControls();
      renderPreview({ refit: true });
      saveNow();
      showToast('内容已清空', {
        action: '撤销',
        duration: 5000,
        onAction: function () {
          state = snapshot;
          renderEditor();
          syncDesignControls();
          renderPreview({ refit: true });
          saveNow();
          showToast('已恢复');
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Initialisation
     ------------------------------------------------------------------------ */
  function bindApp() {
    $('#exportPdfBtn')?.addEventListener('click', printResume);
    $('#exportHtmlBtn')?.addEventListener('click', exportHTML);

    $('#moreBtn')?.addEventListener('click', function (event) {
      event.stopPropagation();
      toggleMenu();
    });
    $('#moreMenu')?.addEventListener('click', function (event) {
      const item = event.target.closest('[data-menu-action]');
      if (!item) return;
      const action = item.getAttribute('data-menu-action');
      closeMenu();
      if (action === 'export-json') exportJSON();
      if (action === 'import-json') $('#importInput')?.click();
      if (action === 'reset') resetToSample();
      if (action === 'multipage') loadMultipageSample();
      if (action === 'clear') clearAll();
    });
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.more-wrap')) closeMenu();
    });

    $('#importInput')?.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      importJSON(file);
    });

    $('#photoInput')?.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      handlePhotoFile(file);
    });

    $('.editor-tabs')?.addEventListener('click', function (event) {
      const button = event.target.closest('[data-tab]');
      if (button) switchTab(button.getAttribute('data-tab'));
    });

    $('#templateSwitch')?.addEventListener('click', function (event) {
      const button = event.target.closest('[data-template]');
      if (button) setTemplate(button.getAttribute('data-template'));
    });

    $('#contentPanel')?.addEventListener('input', handleEditorInput);
    $('#contentPanel')?.addEventListener('click', handleEditorClick);
    $('#demoNote')?.addEventListener('click', handleEditorClick);

    bindDesignPanel();
    bindZoom();
    bindPrintClone();

    $('#confirmCancel')?.addEventListener('click', function () { settleConfirm(false); });
    $('#confirmOk')?.addEventListener('click', function () { settleConfirm(true); });
    $('#confirmLayer')?.addEventListener('click', function (event) {
      if (event.target === $('#confirmLayer')) settleConfirm(false);
    });

    $('#mobilePreviewBtn')?.addEventListener('click', function () {
      $('#app').classList.add('show-mobile-preview');
      requestAnimationFrame(function () {
        if (ui.zoomMode === 'fit') applyZoom(computeFitZoom());
        else applyZoom(ui.zoom);
      });
    });
    $('#mobileClosePreview')?.addEventListener('click', function () {
      $('#app').classList.remove('show-mobile-preview');
    });

    document.addEventListener('keydown', function (event) {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
        showToast('已保存到本地');
        return;
      }
      if (event.key === 'Escape') {
        closeMenu();
        if (!$('#confirmLayer')?.hidden) settleConfirm(false);
        $('#app')?.classList.remove('show-mobile-preview');
      }
    });

    window.addEventListener('beforeunload', function () {
      saveNow({ quiet: true, skipServer: true });
      flushServerSync();
    });
    window.addEventListener('pagehide', function () {
      flushServerSync();
    });

    window.addEventListener('resize', function () {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(function () {
        resizeRaf = null;
        if (ui.zoomMode === 'fit') applyZoom(computeFitZoom());
        else applyZoom(ui.zoom);
      });
    });
  }

  function init() {
    bindApp();
    syncDesignControls();
    renderEditor();
    renderPreview({ refit: true });
    setSaveState('saved', '已保存 ' + formatTime(ui.lastSaved));

    // If the local API is available, prefer the file in data/resume.json when
    // it is newer than localStorage. Plain static hosting simply falls back to
    // the browser-only copy.
    bootstrapLocalSync();

    // Re-measure once system fonts are ready; this is what makes the initial
    // fit-to-screen zoom land on a stable value.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (ui.zoomMode === 'fit') applyZoom(computeFitZoom());
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
