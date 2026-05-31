/**
 * Medijus Collapsible Sidebar
 * Vanilla JS implementation with localStorage persistence,
 * hover-expand, mobile drawer, and filter controls.
 */

(function () {
  const STORAGE_KEY = 'medijus-sidebar-collapsed';
  let collapsed = false;
  let hoverExpanded = false;
  let mobileOpen = false;
  let hoverTimer = null;

  // Read saved state
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) collapsed = JSON.parse(saved);
  } catch {}

  // SVG icons
  const ICONS = {
    chevronLeft: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    chevronRight: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
    x: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    menu: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
    sliders: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    camera: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    video: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    scissors: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    palette: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    mapPin: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    dollar: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    star: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  };

  const ICONS_SUB = {
    person: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>',
    heart: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>',
    building: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>',
    home: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>',
    car: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>',
    sparkle: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/></svg>',
    box: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25"/></svg>',
    tent: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z"/></svg>',
    music: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.34A1.125 1.125 0 0017.81 1.3l-1.06.3M9 9v10.553a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"/></svg>',
    phone: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>',
    logo: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/></svg>',
    doc: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>',
    globe: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>',
    book: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>',
    frame: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>',
    chevronDown: '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>',
  };

  const SUBCATEGORIES = {
    fotografai: [
      { icon: 'person', name: 'Asmenims', hint: '', slug: 'foto-asmenims' },
      { icon: 'heart', name: 'Vestuvės', hint: '', slug: 'foto-vestuves' },
      { icon: 'building', name: 'Verslui', hint: '', slug: 'foto-verslui' },
      { icon: 'home', name: 'Nekilnojamasis Turtas', hint: '', slug: 'foto-nekilnojamas' },
      { icon: 'car', name: 'Automobiliai', hint: '', slug: 'foto-automobiliai' },
      { icon: 'sparkle', name: 'Kūrybiniai Projektai', hint: '', slug: 'foto-kurybiniai' },
    ],
    videografai: [
      { icon: 'person', name: 'Asmeniniai Projektai', hint: '', slug: 'video-asmeniniai' },
      { icon: 'heart', name: 'Vestuvės', hint: '', slug: 'video-vestuves' },
      { icon: 'building', name: 'Verslo Video', hint: '', slug: 'video-verslo' },
      { icon: 'box', name: 'Produktų Video', hint: '', slug: 'video-produktu' },
      { icon: 'tent', name: 'Renginiai', hint: '', slug: 'video-renginiai' },
      { icon: 'home', name: 'Nekilnojamasis Turtas', hint: '', slug: 'video-nekilnojamas' },
      { icon: 'music', name: 'Muzika', hint: '', slug: 'video-muzika' },
      { icon: 'phone', name: 'Socialinė Medija', hint: '', slug: 'video-socialine' },
    ],
    montazuotojai: [
      { icon: 'person', name: 'Asmeniniai Projektai', hint: '', slug: 'mont-asmeniniai' },
      { icon: 'heart', name: 'Vestuvės', hint: '', slug: 'mont-vestuves' },
      { icon: 'building', name: 'Verslo Video', hint: '', slug: 'mont-verslo' },
      { icon: 'box', name: 'Produktų Video', hint: '', slug: 'mont-produktu' },
      { icon: 'tent', name: 'Renginiai', hint: '', slug: 'mont-renginiai' },
      { icon: 'music', name: 'Muzika', hint: '', slug: 'mont-muzika' },
      { icon: 'phone', name: 'Socialinė Medija', hint: '', slug: 'mont-socialine' },
      { icon: 'sparkle', name: 'Kūrybiniai Projektai', hint: '', slug: 'mont-kurybiniai' },
    ],
    dizaineriai: [
      { icon: 'logo', name: 'Logotipai ir Branding', hint: '', slug: 'diz-logotipai' },
      { icon: 'phone', name: 'Socialinė Medija', hint: '', slug: 'diz-socialine' },
      { icon: 'doc', name: 'Spausdinta Medžiaga', hint: '', slug: 'diz-spausdinta' },
      { icon: 'box', name: 'Pakuotės Dizainas', hint: '', slug: 'diz-pakuotes' },
      { icon: 'globe', name: 'Web Dizainas', hint: '', slug: 'diz-web' },
      { icon: 'book', name: 'Leidiniai', hint: '', slug: 'diz-leidiniai' },
      { icon: 'tent', name: 'Renginiai', hint: '', slug: 'diz-renginiai' },
      { icon: 'frame', name: 'Iliustracijos ir Menas', hint: '', slug: 'diz-iliustracijos' },
    ],
  };

  // Track which dropdowns are open by slug
  var dropdownState = { fotografai: false, videografai: false, montazuotojai: false, dizaineriai: false };

  const CATEGORIES = [
    { icon: 'camera', name: 'Fotografai', slug: 'fotografai', hasDropdown: true },
    { icon: 'video', name: 'Videografai', slug: 'videografai', hasDropdown: true },
    { icon: 'scissors', name: 'Montažuotojai', slug: 'montazuotojai', hasDropdown: true },
    { icon: 'palette', name: 'Dizaineriai', slug: 'dizaineriai', hasDropdown: true },
  ];

  const CITIES = ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys'];

  function buildSidebarContent(isMobile) {
    const isExpanded = !collapsed || hoverExpanded || isMobile;

    let html = '';

    // Header
    html += '<div class="sidebar-header">';
    if (isExpanded) {
      html += '<span class="sidebar-header-title">Filtrai</span>';
    } else {
      html += '<span style="margin:0 auto;color:#6b7280">' + ICONS.sliders + '</span>';
    }
    if (!isMobile) {
      html += '<button class="sidebar-toggle-btn" data-action="toggle" title="Sutraukti/Išskleisti">';
      html += collapsed ? ICONS.chevronRight : ICONS.chevronLeft;
      html += '</button>';
    }
    if (isMobile) {
      html += '<button class="sidebar-close-btn" data-action="close-mobile">' + ICONS.x + '</button>';
    }
    html += '</div>';

    // Categories
    html += '<div class="sidebar-section">';
    if (isExpanded) {
      html += '<div class="sidebar-section-title">Kategorijos</div>';
    }
    html += '<div class="sidebar-nav">';
    CATEGORIES.forEach(function (cat) {
      if (cat.hasDropdown && isExpanded) {
        var isOpen = dropdownState[cat.slug] || false;
        html += '<button class="sidebar-nav-item" data-action="toggle-dropdown" data-slug="' + cat.slug + '">';
        html += ICONS[cat.icon];
        html += '<span class="sidebar-nav-label">' + cat.name + '</span>';
        html += '<span class="sidebar-chevron' + (isOpen ? ' open' : '') + '">' + ICONS_SUB.chevronDown + '</span>';
        html += '</button>';
        html += '<div class="sidebar-sub-menu' + (isOpen ? ' open' : '') + '">';
        (SUBCATEGORIES[cat.slug] || []).forEach(function (sub) {
          var isActive = (typeof selectedCategorySlugs !== 'undefined' && selectedCategorySlugs.indexOf(sub.slug) !== -1);
          html += '<button class="sidebar-sub-item' + (isActive ? ' active' : '') + '" data-action="sub-category" data-slug="' + sub.slug + '">';
          html += ICONS_SUB[sub.icon];
          html += '<span>' + sub.name + '</span>';
          if (sub.hint) {
            html += '<span class="sidebar-sub-hint">' + sub.hint + '</span>';
          }
          html += '</button>';
        });
        html += '</div>';
      } else if (cat.hasDropdown && !isExpanded) {
        html += '<button class="sidebar-nav-item" data-action="category" data-slug="' + cat.slug + '">';
        html += ICONS[cat.icon];
        html += '</button>';
      } else {
        html += '<button class="sidebar-nav-item" data-action="category" data-slug="' + cat.slug + '">';
        html += ICONS[cat.icon];
        if (isExpanded) {
          html += '<span class="sidebar-nav-label">' + cat.name + '</span>';
        }
        html += '</button>';
      }
    });
    html += '</div></div>';

    // Filters (only when expanded)
    if (isExpanded) {
      html += '<div class="sidebar-section sidebar-filters">';
      html += '<div class="sidebar-section-title">Filtrai</div>';

      // City
      var curCity = (typeof selectedCity !== 'undefined') ? selectedCity : '';
      html += '<div class="sidebar-filter-section">';
      html += '<label class="sidebar-filter-label">' + ICONS.mapPin + '<span>Miestas</span></label>';
      html += '<select class="sidebar-select" data-action="city-filter">';
      html += '<option value=""' + (curCity === '' ? ' selected' : '') + '>Visi miestai</option>';
      CITIES.forEach(function (city) {
        html += '<option value="' + city + '"' + (curCity === city ? ' selected' : '') + '>' + city + '</option>';
      });
      html += '</select></div>';

      // Price
      var curPrice = (typeof maxPrice !== 'undefined') ? maxPrice : 500;
      html += '<div class="sidebar-filter-section">';
      html += '<label class="sidebar-filter-label">' + ICONS.dollar + '<span>Kaina</span></label>';
      html += '<div><input type="range" min="0" max="500" value="' + curPrice + '" class="sidebar-range" data-action="price-filter">';
      html += '<div class="sidebar-price-labels"><span>€0</span><span data-price-max>€' + curPrice + '</span></div></div></div>';

      // Rating
      var curRating = (typeof minRating !== 'undefined') ? minRating : 0;
      html += '<div class="sidebar-filter-section">';
      html += '<label class="sidebar-filter-label">' + ICONS.star + '<span>Min. reitingas</span></label>';
      html += '<div class="sidebar-rating">';
      [0, 3, 3.5, 4, 4.5].forEach(function (r) {
        var label = r === 0 ? 'Visi' : r + '+';
        var activeClass = r === curRating ? ' active' : '';
        html += '<button class="sidebar-rating-btn' + activeClass + '" data-action="rating" data-rating="' + r + '">' + label + '</button>';
      });
      html += '</div></div>';

      // Reset
      html += '<button class="sidebar-reset-btn" data-action="reset">Išvalyti filtrus</button>';
      html += '</div>';
    }

    return html;
  }

  function render() {
    var sidebar = document.getElementById('medijus-sidebar');
    var mobileDrawer = document.getElementById('medijus-sidebar-mobile');
    var mainContent = document.querySelector('.main-content');
    var mainFooter = document.querySelector('.main-footer');

    if (sidebar) {
      sidebar.innerHTML = buildSidebarContent(false);
      sidebar.className = 'sidebar' + (collapsed ? ' collapsed' : '') + (hoverExpanded ? ' hover-expanded' : '');
    }

    if (mobileDrawer) {
      mobileDrawer.innerHTML = buildSidebarContent(true);
      mobileDrawer.className = 'sidebar-mobile-drawer' + (mobileOpen ? ' open' : '');
    }

    var overlay = document.getElementById('medijus-sidebar-overlay');
    if (overlay) {
      overlay.className = 'sidebar-overlay' + (mobileOpen ? ' visible' : '');
    }

    if (mainContent) {
      if (collapsed) {
        mainContent.classList.add('sidebar-collapsed');
      } else {
        mainContent.classList.remove('sidebar-collapsed');
      }
    }

    if (mainFooter) {
      if (collapsed) {
        mainFooter.classList.add('sidebar-collapsed');
      } else {
        mainFooter.classList.remove('sidebar-collapsed');
      }
    }

    // Lock body scroll when mobile drawer is open
    document.body.style.overflow = mobileOpen ? 'hidden' : '';

    // Sync active category
    syncActiveCategory();
  }

  function syncActiveCategory() {
    // Highlight active sidebar category based on current filter-pill selection
    var activePill = document.querySelector('.filter-pill.active');
    var activeSlug = '';
    if (activePill) {
      var cat = activePill.getAttribute('data-category');
      // Map filter pill categories to sidebar slugs
      var mapping = {
        'vestuves': 'fotografai',
        'corporate': 'videografai',
        'produktai': 'dizaineriai',
        'video': 'videografai',
        'portretai': 'fotografai',
        'dronas': 'videografai',
      };
      activeSlug = mapping[cat] || '';
    }

    document.querySelectorAll('.sidebar-nav-item').forEach(function (item) {
      if (item.getAttribute('data-slug') === activeSlug && activeSlug) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  function handleAction(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var action = target.getAttribute('data-action');

    switch (action) {
      case 'toggle':
        collapsed = !collapsed;
        hoverExpanded = false;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed)); } catch {}
        render();
        break;

      case 'close-mobile':
        mobileOpen = false;
        render();
        break;

      case 'toggle-dropdown':
        var ddSlug = target.getAttribute('data-slug');
        dropdownState[ddSlug] = !dropdownState[ddSlug];
        render();
        break;

      case 'sub-category':
        var subSlug = target.getAttribute('data-slug');
        if (typeof selectedCategorySlugs !== 'undefined') {
          var idx = selectedCategorySlugs.indexOf(subSlug);
          if (idx === -1) {
            selectedCategorySlugs.push(subSlug);
            target.classList.add('active');
          } else {
            selectedCategorySlugs.splice(idx, 1);
            target.classList.remove('active');
          }
          currentPage = 0;
          allLoaded = false;
          loadCreators(true);
        }
        // Close mobile drawer
        if (mobileOpen) { mobileOpen = false; render(); }
        break;

      case 'category':
        var slug = target.getAttribute('data-slug');
        // Click corresponding filter pill or trigger search
        document.querySelectorAll('.sidebar-nav-item').forEach(function (item) {
          item.classList.remove('active');
        });
        document.querySelectorAll('.sidebar-sub-item').forEach(function (item) {
          item.classList.remove('active');
        });
        target.classList.add('active');
        break;

      case 'city-filter':
        if (typeof selectedCity !== 'undefined') {
          selectedCity = target.value;
          currentPage = 0; allLoaded = false;
          loadCreators(true);
        }
        break;

      case 'price-filter':
        var val = target.value;
        var label = target.closest('.sidebar-filter-section').querySelector('[data-price-max]');
        if (label) label.textContent = '€' + val;
        if (typeof maxPrice !== 'undefined') {
          maxPrice = parseInt(val);
          currentPage = 0; allLoaded = false;
          loadCreators(true);
        }
        break;

      case 'rating':
        document.querySelectorAll('.sidebar-rating-btn').forEach(function (btn) {
          btn.classList.remove('active');
        });
        target.classList.add('active');
        if (typeof minRating !== 'undefined') {
          minRating = parseFloat(target.getAttribute('data-rating'));
          currentPage = 0; allLoaded = false;
          loadCreators(true);
        }
        break;

      case 'reset':
        // Reset creators.js filter state
        if (typeof selectedCategorySlugs !== 'undefined') {
          selectedCategorySlugs.length = 0;
          selectedCity = '';
          maxPrice = 500;
          minRating = 0;
          currentPage = 0; allLoaded = false;
        }
        // Reset filter UI
        document.querySelectorAll('.sidebar-select').forEach(function (s) { s.value = ''; });
        document.querySelectorAll('.sidebar-range').forEach(function (r) { r.value = 500; });
        document.querySelectorAll('.sidebar-rating-btn').forEach(function (b) {
          b.classList.remove('active');
          if (b.getAttribute('data-rating') === '0') b.classList.add('active');
        });
        document.querySelectorAll('[data-price-max]').forEach(function (l) { l.textContent = '€500'; });
        document.querySelectorAll('.sidebar-nav-item, .sidebar-sub-item').forEach(function (i) { i.classList.remove('active'); });
        if (typeof loadCreators !== 'undefined') loadCreators(true);
        break;
    }
  }

  function init() {
    // Find the old sidebar and replace structure
    var oldSidebar = document.querySelector('aside.hidden.lg\\:block');
    var mainEl = document.querySelector('main.lg\\:pl-64') || document.querySelector('main');
    var footerEl = document.querySelector('footer');
    var flexWrapper = document.querySelector('.flex.pt-16');

    // Create new sidebar element
    var sidebar = document.createElement('aside');
    sidebar.id = 'medijus-sidebar';
    document.body.appendChild(sidebar);

    // Create mobile drawer
    var mobileDrawer = document.createElement('aside');
    mobileDrawer.id = 'medijus-sidebar-mobile';
    document.body.appendChild(mobileDrawer);

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'medijus-sidebar-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function () {
      mobileOpen = false;
      render();
    });

    // Create mobile trigger
    var trigger = document.createElement('button');
    trigger.className = 'sidebar-mobile-trigger';
    trigger.setAttribute('aria-label', 'Atidaryti filtrus');
    trigger.innerHTML = ICONS.menu;
    document.body.appendChild(trigger);
    trigger.addEventListener('click', function () {
      mobileOpen = true;
      render();
    });

    // Remove old sidebar
    if (oldSidebar) {
      oldSidebar.remove();
    }

    // Update main content class
    if (mainEl) {
      mainEl.classList.remove('lg:pl-64');
      mainEl.classList.add('main-content');
    }

    // Update flex wrapper - remove flex layout since sidebar is now fixed
    if (flexWrapper) {
      flexWrapper.classList.remove('flex');
    }

    // Update footer
    if (footerEl) {
      footerEl.classList.remove('lg:pl-64');
      footerEl.classList.add('main-footer');
    }

    // Event delegation
    document.addEventListener('click', handleAction);
    document.addEventListener('change', function (e) {
      if (e.target.matches('[data-action]')) handleAction(e);
    });
    document.addEventListener('input', function (e) {
      if (e.target.matches('[data-action="price-filter"]')) handleAction(e);
    });

    // Hover expand (desktop only)
    sidebar.addEventListener('mouseenter', function () {
      if (!collapsed) return;
      hoverTimer = setTimeout(function () {
        hoverExpanded = true;
        render();
      }, 200);
    });

    sidebar.addEventListener('mouseleave', function () {
      clearTimeout(hoverTimer);
      if (hoverExpanded) {
        hoverExpanded = false;
        render();
      }
    });

    // ESC to close mobile
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileOpen) {
        mobileOpen = false;
        render();
      }
    });

    render();
  }

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
