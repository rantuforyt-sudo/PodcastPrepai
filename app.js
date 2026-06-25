/* ============================================
   PODCAST PREP AI — MAIN APPLICATION JS
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  const state = {
    subscriptionToken: null,
    currentResults: null,
    guestName: '',
    paypalLoaded: false,
    paypalButtonsRendered: false,
  };

  // ============================================
  // ELEMENTS
  // ============================================
  const $ = (id) => document.getElementById(id);

  const els = {
    nav: $('nav'),
    navHamburger: $('navHamburger'),
    navMobile: $('navMobile'),
    navCtaBtn: $('navCtaBtn'),
    navMobileCtaBtn: $('navMobileCtaBtn'),
    heroCtaBtn: $('heroCtaBtn'),
    pricingCtaBtn: $('pricingCtaBtn'),
    ctaSectionBtn: $('ctaSectionBtn'),

    paymentModal: $('paymentModal'),
    modalClose: $('modalClose'),
    paypalButtonContainer: $('paypalButtonContainer'),
    paymentError: $('paymentError'),

    appSection: $('appSection'),
    backToLandingBtn: $('backToLandingBtn'),
    guestInfo: $('guestInfo'),
    guestName: $('guestName'),
    podcastTopic: $('podcastTopic'),
    charCount: $('charCount'),
    generateBtn: $('generateBtn'),
    generateBtnText: $('generateBtnText'),
    generateBtnIcon: $('generateBtnIcon'),
    appError: $('appError'),

    loadingState: $('loadingState'),
    progressSteps: $('progressSteps'),

    resultsSection: $('resultsSection'),
    resultsTitle: $('resultsTitle'),
    resultsCards: $('resultsCards'),
    newPrepBtn: $('newPrepBtn'),
    exportBtn: $('exportBtn'),
  };

  // ============================================
  // INIT
  // ============================================
  function init() {
    loadSubscriptionFromStorage();
    bindEvents();
    initFAQ();
    initNavScroll();
    checkPaymentReturn();
  }

  function loadSubscriptionFromStorage() {
    const token = localStorage.getItem('ppai_subscription_token');
    if (token) {
      verifyToken(token).then((valid) => {
        if (valid) {
          state.subscriptionToken = token;
        } else {
          localStorage.removeItem('ppai_subscription_token');
        }
      });
    }
  }

  async function verifyToken(token) {
    try {
      const res = await fetch('/api/subscription/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      return data.valid === true;
    } catch {
      return false;
    }
  }

  function checkPaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'cancelled') {
      window.history.replaceState({}, '', '/');
    }
  }

  // ============================================
  // EVENTS
  // ============================================
  function bindEvents() {
    // CTA buttons — open payment modal or app
    [els.navCtaBtn, els.navMobileCtaBtn, els.heroCtaBtn, els.pricingCtaBtn, els.ctaSectionBtn].forEach((btn) => {
      if (btn) btn.addEventListener('click', handleCtaClick);
    });

    // Modal
    els.modalClose.addEventListener('click', closeModal);
    els.paymentModal.addEventListener('click', (e) => {
      if (e.target === els.paymentModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // App
    els.backToLandingBtn.addEventListener('click', showLanding);
    els.newPrepBtn.addEventListener('click', resetToInput);
    els.guestInfo.addEventListener('input', updateCharCount);
    els.generateBtn.addEventListener('click', handleGenerate);
    els.exportBtn.addEventListener('click', exportResults);

    // Nav hamburger
    els.navHamburger.addEventListener('click', () => {
      els.navMobile.classList.toggle('open');
    });

    // Close mobile nav on link click
    document.querySelectorAll('.nav-mobile a').forEach((a) => {
      a.addEventListener('click', () => els.navMobile.classList.remove('open'));
    });
  }

  function handleCtaClick() {
    if (state.subscriptionToken) {
      showApp();
    } else {
      openModal();
    }
  }

  // ============================================
  // MODAL
  // ============================================
  async function openModal() {
    els.paymentModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    hidePaymentError();

    if (!state.paypalButtonsRendered) {
      await loadPayPalButtons();
    }
  }

  function closeModal() {
    els.paymentModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function loadPayPalButtons() {
    try {
      // Fetch PayPal config
      const configRes = await fetch('/api/payment/config');
      if (!configRes.ok) throw new Error('Payment not configured');
      const config = await configRes.json();

      // Load PayPal SDK dynamically with client ID
      await loadPayPalSDK(config.clientId, config.currency);

      // Render buttons
      if (window.paypal) {
        window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'pay',
            height: 48,
          },
          createOrder: async () => {
            hidePaymentError();
            const res = await fetch('/api/payment/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Failed to create order');
            }
            const order = await res.json();
            return order.id;
          },
          onApprove: async (data) => {
            try {
              const res = await fetch('/api/payment/capture-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID }),
              });
              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Payment capture failed');
              }
              const result = await res.json();
              if (result.success && result.subscriptionToken) {
                state.subscriptionToken = result.subscriptionToken;
                localStorage.setItem('ppai_subscription_token', result.subscriptionToken);
                closeModal();
                showApp();
              } else {
                throw new Error('Payment processing error');
              }
            } catch (err) {
              showPaymentError(err.message || 'Payment failed. Please try again.');
            }
          },
          onError: (err) => {
            console.error('PayPal error:', err);
            showPaymentError('Payment failed. Please try again or use a different payment method.');
          },
          onCancel: () => {
            hidePaymentError();
          },
        }).render('#paypalButtonContainer');

        state.paypalButtonsRendered = true;
      }
    } catch (err) {
      console.error('PayPal load error:', err.message);
      showPaymentError('Payment service unavailable. Please try again later.');
    }
  }

  function loadPayPalSDK(clientId, currency) {
    return new Promise((resolve, reject) => {
      // Remove existing SDK if any
      const existing = document.getElementById('paypal-sdk-loaded');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id = 'paypal-sdk-loaded';
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture`;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load PayPal'));
      document.head.appendChild(script);
    });
  }

  function showPaymentError(msg) {
    els.paymentError.textContent = msg;
    els.paymentError.classList.add('visible');
  }

  function hidePaymentError() {
    els.paymentError.textContent = '';
    els.paymentError.classList.remove('visible');
  }

  // ============================================
  // LANDING / APP TOGGLE
  // ============================================
  function showApp() {
    document.querySelector('.nav').style.display = 'none';
    document.querySelectorAll('.hero, .features, .how-it-works, .pricing, .faq, .cta-section, .footer').forEach((el) => {
      el.style.display = 'none';
    });
    els.appSection.classList.add('visible');
    window.scrollTo(0, 0);
    resetToInput();
  }

  function showLanding() {
    els.appSection.classList.remove('visible');
    document.querySelector('.nav').style.display = '';
    document.querySelectorAll('.hero, .features, .how-it-works, .pricing, .faq, .cta-section, .footer').forEach((el) => {
      el.style.display = '';
    });
    window.scrollTo(0, 0);
  }

  function resetToInput() {
    hideAll();
    showElement(els.appSection.querySelector('.app-input-panel'));
    hideAppError();
  }

  function hideAll() {
    document.querySelector('.app-input-panel')?.style && (document.querySelector('.app-input-panel').style.display = '');
    els.loadingState.classList.remove('visible');
    els.resultsSection.classList.remove('visible');
  }

  function showElement(el) {
    if (el) el.style.display = '';
  }

  // ============================================
  // CHAR COUNT
  // ============================================
  function updateCharCount() {
    els.charCount.textContent = els.guestInfo.value.length;
  }

  // ============================================
  // GENERATE
  // ============================================
  async function handleGenerate() {
    hideAppError();
    const guestInfo = els.guestInfo.value.trim();
    const guestName = els.guestName.value.trim();
    const podcastTopic = els.podcastTopic.value.trim();

    if (!guestInfo) {
      showAppError('Please paste guest information before generating.');
      return;
    }
    if (guestInfo.length < 50) {
      showAppError('Please provide at least 50 characters of guest information for meaningful results.');
      return;
    }
    if (!state.subscriptionToken) {
      openModal();
      return;
    }

    state.guestName = guestName;

    // Hide input, show loading
    document.querySelector('.app-input-panel').style.display = 'none';
    els.resultsSection.classList.remove('visible');
    els.loadingState.classList.add('visible');

    startProgressAnimation();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-subscription-token': state.subscriptionToken,
        },
        body: JSON.stringify({ guestInfo, guestName, podcastTopic }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          // Subscription invalid
          state.subscriptionToken = null;
          localStorage.removeItem('ppai_subscription_token');
          els.loadingState.classList.remove('visible');
          document.querySelector('.app-input-panel').style.display = '';
          openModal();
          return;
        }
        throw new Error(data.error || 'Generation failed');
      }

      state.currentResults = data.data;
      completeProgressAnimation();

      setTimeout(() => {
        els.loadingState.classList.remove('visible');
        renderResults(data.data, guestName);
        els.resultsSection.classList.add('visible');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 600);
    } catch (err) {
      els.loadingState.classList.remove('visible');
      document.querySelector('.app-input-panel').style.display = '';
      showAppError(err.message || 'Failed to generate prep package. Please try again.');
    }
  }

  // ============================================
  // PROGRESS ANIMATION
  // ============================================
  let progressTimer = null;
  let progressIndex = 0;

  function startProgressAnimation() {
    progressIndex = 0;
    const steps = els.progressSteps.querySelectorAll('.progress-step');
    steps.forEach((s) => s.classList.remove('active', 'done'));
    steps[0].classList.add('active');

    progressTimer = setInterval(() => {
      if (progressIndex < steps.length - 1) {
        steps[progressIndex].classList.remove('active');
        steps[progressIndex].classList.add('done');
        progressIndex++;
        steps[progressIndex].classList.add('active');
      }
    }, 4500);
  }

  function completeProgressAnimation() {
    clearInterval(progressTimer);
    const steps = els.progressSteps.querySelectorAll('.progress-step');
    steps.forEach((s) => { s.classList.remove('active'); s.classList.add('done'); });
  }

  // ============================================
  // RENDER RESULTS
  // ============================================
  function renderResults(data, guestName) {
    const title = guestName ? `Interview Prep — ${guestName}` : 'Your Interview Prep Package';
    els.resultsTitle.textContent = title;
    els.resultsCards.innerHTML = '';

    const cards = [
      renderExecutiveSummary(data.executiveSummary),
      renderBackgroundInfo(data.backgroundInfo),
      renderDiscussionTopics(data.discussionTopics),
      renderQuestionList('🎙️', '15 Personalized Interview Questions', data.interviewQuestions),
      renderQuestionList('🔍', '10 Deep Follow-Up Questions', data.followUpQuestions),
      renderQuestionList('☀️', 'Icebreaker Questions', data.icebreakers),
      renderQuestionList('⚡', 'Contrarian Questions', data.contrarianQuestions),
      renderUniqueAngles(data.uniqueAngles),
      renderEpisodeStructure(data.episodeStructure),
      renderSimpleList('🎯', 'Key Takeaways For Your Audience', data.keyTakeaways),
      renderEpisodeTitles(data.episodeTitles),
      renderSocialMedia(data.socialMediaAngles),
    ];

    cards.forEach((card) => {
      if (card) els.resultsCards.appendChild(card);
    });
  }

  function createCard(icon, title, contentEl, copyText) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'result-card-title';
    titleEl.innerHTML = `<div class="card-icon">${icon}</div>${escHtml(title)}`;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      copyToClipboard(typeof copyText === 'function' ? copyText() : copyText);
      copyBtn.textContent = '✓ Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    });

    header.appendChild(titleEl);
    header.appendChild(copyBtn);
    card.appendChild(header);
    card.appendChild(contentEl);

    return card;
  }

  function renderExecutiveSummary(data) {
    if (!data) return null;
    const el = document.createElement('div');

    const headline = document.createElement('div');
    headline.className = 'summary-headline';
    headline.textContent = data.headline || '';
    el.appendChild(headline);

    const overview = document.createElement('div');
    overview.className = 'summary-overview';
    overview.textContent = data.overview || '';
    el.appendChild(overview);

    if (data.keyStats && data.keyStats.length) {
      const statsEl = document.createElement('div');
      statsEl.className = 'key-stats';
      data.keyStats.forEach((stat) => {
        const s = document.createElement('div');
        s.className = 'key-stat';
        s.textContent = stat;
        statsEl.appendChild(s);
      });
      el.appendChild(statsEl);
    }

    const copyText = () =>
      `EXECUTIVE SUMMARY\n\n${data.headline}\n\n${data.overview}\n\nKEY STATS:\n${(data.keyStats || []).map((s) => `• ${s}`).join('\n')}`;

    return createCard('◈', 'Executive Guest Summary', el, copyText);
  }

  function renderBackgroundInfo(data) {
    if (!data) return null;
    const el = document.createElement('div');

    const sections = [
      { label: 'Career Journey', value: data.careerJourney },
      { label: 'Current Focus', value: data.currentFocus },
      { label: 'Controversies / Challenges', value: data.controversiesOrChallenges },
      { label: 'Personal Details', value: data.personalDetails },
    ];

    sections.forEach(({ label, value }) => {
      if (!value) return;
      const s = document.createElement('div');
      s.className = 'bg-info-section';
      s.innerHTML = `<div class="bg-info-label">${escHtml(label)}</div><div class="bg-info-text">${escHtml(value)}</div>`;
      el.appendChild(s);
    });

    if (data.expertise && data.expertise.length) {
      const s = document.createElement('div');
      s.className = 'bg-info-section';
      s.innerHTML = `<div class="bg-info-label">Areas of Expertise</div>`;
      const tags = document.createElement('div');
      tags.className = 'expertise-tags';
      data.expertise.forEach((e) => {
        const tag = document.createElement('span');
        tag.className = 'expertise-tag';
        tag.textContent = e;
        tags.appendChild(tag);
      });
      s.appendChild(tags);
      el.appendChild(s);
    }

    if (data.notableAchievements && data.notableAchievements.length) {
      const s = document.createElement('div');
      s.className = 'bg-info-section';
      s.innerHTML = `<div class="bg-info-label">Notable Achievements</div>`;
      const list = document.createElement('div');
      list.className = 'key-stats';
      data.notableAchievements.forEach((a) => {
        const item = document.createElement('div');
        item.className = 'key-stat';
        item.textContent = a;
        list.appendChild(item);
      });
      s.appendChild(list);
      el.appendChild(s);
    }

    const copyText = () => {
      let text = 'BACKGROUND INFORMATION\n\n';
      if (data.careerJourney) text += `Career Journey:\n${data.careerJourney}\n\n`;
      if (data.expertise) text += `Expertise:\n${data.expertise.map((e) => `• ${e}`).join('\n')}\n\n`;
      if (data.notableAchievements) text += `Notable Achievements:\n${data.notableAchievements.map((a) => `• ${a}`).join('\n')}\n\n`;
      if (data.currentFocus) text += `Current Focus:\n${data.currentFocus}\n\n`;
      if (data.controversiesOrChallenges) text += `Controversies/Challenges:\n${data.controversiesOrChallenges}\n\n`;
      if (data.personalDetails) text += `Personal Details:\n${data.personalDetails}`;
      return text;
    };

    return createCard('◎', 'Key Background Information', el, copyText);
  }

  function renderDiscussionTopics(topics) {
    if (!topics || !topics.length) return null;
    const el = document.createElement('div');

    topics.forEach((topic) => {
      const card = document.createElement('div');
      card.className = 'topic-card';
      card.innerHTML = `
        <div class="topic-title">${escHtml(topic.topic)}</div>
        <div class="topic-label">Why this matters</div>
        <div class="topic-why">${escHtml(topic.why)}</div>
        <div class="topic-label">Angle to take</div>
        <div class="topic-angle">${escHtml(topic.angle)}</div>
      `;
      el.appendChild(card);
    });

    const copyText = () =>
      `MAIN DISCUSSION TOPICS\n\n${topics.map((t, i) => `${i + 1}. ${t.topic}\nWhy: ${t.why}\nAngle: ${t.angle}`).join('\n\n')}`;

    return createCard('◐', 'Main Discussion Topics', el, copyText);
  }

  function renderQuestionList(icon, title, questions) {
    if (!questions || !questions.length) return null;
    const el = document.createElement('ul');
    el.className = 'result-list';

    questions.forEach((q, i) => {
      const li = document.createElement('li');
      li.className = 'result-list-item';
      li.innerHTML = `<span class="list-num">${i + 1}</span><span>${escHtml(q)}</span>`;
      el.appendChild(li);
    });

    const copyText = () =>
      `${title.toUpperCase()}\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}`;

    return createCard(icon, title, el, copyText);
  }

  function renderUniqueAngles(angles) {
    if (!angles || !angles.length) return null;
    const el = document.createElement('div');

    angles.forEach((a) => {
      const card = document.createElement('div');
      card.className = 'angle-card';
      card.innerHTML = `<div class="angle-title">◆ ${escHtml(a.angle)}</div><div class="angle-desc">${escHtml(a.description)}</div>`;
      el.appendChild(card);
    });

    const copyText = () =>
      `UNIQUE ANGLES MOST HOSTS MISS\n\n${angles.map((a, i) => `${i + 1}. ${a.angle}\n${a.description}`).join('\n\n')}`;

    return createCard('◑', 'Unique Angles Most Hosts Miss', el, copyText);
  }

  function renderEpisodeStructure(structure) {
    if (!structure) return null;
    const el = document.createElement('div');

    const textBlocks = [
      { label: 'Cold Open (first 60 seconds)', value: structure.coldOpen },
      { label: 'Guest Introduction', value: structure.intro },
    ];

    textBlocks.forEach(({ label, value }) => {
      if (!value) return;
      const block = document.createElement('div');
      block.innerHTML = `<div class="structure-text-label">${escHtml(label)}</div><div class="structure-text-block">${escHtml(value)}</div>`;
      el.appendChild(block);
    });

    const acts = [structure.actOne, structure.actTwo, structure.actThree].filter(Boolean);
    acts.forEach((act) => {
      const card = document.createElement('div');
      card.className = 'act-card';
      card.innerHTML = `
        <div class="act-header">
          <div class="act-title">${escHtml(act.title || '')}</div>
          ${act.duration ? `<div class="act-duration">${escHtml(act.duration)}</div>` : ''}
        </div>
        <div class="act-focus">${escHtml(act.focus || '')}</div>
        ${act.keyQuestions && act.keyQuestions.length ? `
          <div class="act-questions">
            ${act.keyQuestions.map((q) => `<div class="act-question">${escHtml(q)}</div>`).join('')}
          </div>
        ` : ''}
      `;
      el.appendChild(card);
    });

    if (structure.closingSegment) {
      const block = document.createElement('div');
      block.innerHTML = `<div class="structure-text-label">Closing Segment</div><div class="structure-text-block">${escHtml(structure.closingSegment)}</div>`;
      el.appendChild(block);
    }
    if (structure.signOff) {
      const block = document.createElement('div');
      block.innerHTML = `<div class="structure-text-label">Sign-Off & Call to Action</div><div class="structure-text-block">${escHtml(structure.signOff)}</div>`;
      el.appendChild(block);
    }

    const copyText = () => {
      let text = 'EPISODE STRUCTURE\n\n';
      if (structure.coldOpen) text += `COLD OPEN:\n${structure.coldOpen}\n\n`;
      if (structure.intro) text += `INTRODUCTION:\n${structure.intro}\n\n`;
      [structure.actOne, structure.actTwo, structure.actThree].filter(Boolean).forEach((act) => {
        text += `${act.title} (${act.duration}):\n${act.focus}\n`;
        if (act.keyQuestions) text += act.keyQuestions.map((q) => `  → ${q}`).join('\n') + '\n';
        text += '\n';
      });
      if (structure.closingSegment) text += `CLOSING:\n${structure.closingSegment}\n\n`;
      if (structure.signOff) text += `SIGN-OFF:\n${structure.signOff}`;
      return text;
    };

    return createCard('◉', 'Episode Structure Blueprint', el, copyText);
  }

  function renderSimpleList(icon, title, items) {
    if (!items || !items.length) return null;
    const el = document.createElement('ul');
    el.className = 'result-list';

    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'result-list-item';
      li.innerHTML = `<span class="list-num">${i + 1}</span><span>${escHtml(item)}</span>`;
      el.appendChild(li);
    });

    const copyText = () =>
      `${title.toUpperCase()}\n\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;

    return createCard(icon, title, el, copyText);
  }

  function renderEpisodeTitles(titles) {
    if (!titles || !titles.length) return null;
    const el = document.createElement('div');

    titles.forEach((title, i) => {
      const item = document.createElement('div');
      item.className = 'title-item';
      item.innerHTML = `
        <span class="title-num">${i + 1}</span>
        <span class="title-text">${escHtml(title)}</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify(title)}).then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='Copy',1500)})">Copy</button>
      `;
      el.appendChild(item);
    });

    const copyText = () =>
      `EPISODE TITLE IDEAS\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

    return createCard('📝', '10 Episode Title Ideas', el, copyText);
  }

  function renderSocialMedia(angles) {
    if (!angles || !angles.length) return null;
    const el = document.createElement('div');

    angles.forEach((a) => {
      const card = document.createElement('div');
      card.className = 'social-card';
      card.innerHTML = `
        <div class="social-platform">${escHtml(a.platform)}</div>
        <div class="social-angle">${escHtml(a.angle)}</div>
        <div class="social-post">${escHtml(a.samplePost)}</div>
      `;
      el.appendChild(card);
    });

    const copyText = () =>
      `SOCIAL MEDIA PROMOTION ANGLES\n\n${angles.map((a) => `${a.platform.toUpperCase()}\nAngle: ${a.angle}\n${a.samplePost}`).join('\n\n')}`;

    return createCard('📱', 'Social Media Promotion Angles', el, copyText);
  }

  // ============================================
  // EXPORT
  // ============================================
  function exportResults() {
    if (!state.currentResults) return;
    const d = state.currentResults;
    const name = state.guestName || 'Guest';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let text = `PODCAST PREP AI — INTERVIEW PREPARATION PACKAGE\n`;
    text += `Guest: ${name}\n`;
    text += `Generated: ${date}\n`;
    text += `${'='.repeat(60)}\n\n`;

    if (d.executiveSummary) {
      text += `EXECUTIVE SUMMARY\n${'-'.repeat(40)}\n`;
      text += `${d.executiveSummary.headline}\n\n`;
      text += `${d.executiveSummary.overview}\n\n`;
      if (d.executiveSummary.keyStats) {
        text += `Key Stats:\n${d.executiveSummary.keyStats.map((s) => `• ${s}`).join('\n')}\n\n`;
      }
    }

    if (d.backgroundInfo) {
      text += `BACKGROUND INFORMATION\n${'-'.repeat(40)}\n`;
      const bi = d.backgroundInfo;
      if (bi.careerJourney) text += `Career Journey:\n${bi.careerJourney}\n\n`;
      if (bi.expertise) text += `Expertise:\n${bi.expertise.map((e) => `• ${e}`).join('\n')}\n\n`;
      if (bi.notableAchievements) text += `Notable Achievements:\n${bi.notableAchievements.map((a) => `• ${a}`).join('\n')}\n\n`;
      if (bi.currentFocus) text += `Current Focus:\n${bi.currentFocus}\n\n`;
    }

    if (d.discussionTopics) {
      text += `MAIN DISCUSSION TOPICS\n${'-'.repeat(40)}\n`;
      d.discussionTopics.forEach((t, i) => {
        text += `${i + 1}. ${t.topic}\n   Why: ${t.why}\n   Angle: ${t.angle}\n\n`;
      });
    }

    if (d.interviewQuestions) {
      text += `15 PERSONALIZED INTERVIEW QUESTIONS\n${'-'.repeat(40)}\n`;
      d.interviewQuestions.forEach((q, i) => { text += `${i + 1}. ${q}\n\n`; });
    }

    if (d.followUpQuestions) {
      text += `10 DEEP FOLLOW-UP QUESTIONS\n${'-'.repeat(40)}\n`;
      d.followUpQuestions.forEach((q, i) => { text += `${i + 1}. ${q}\n\n`; });
    }

    if (d.icebreakers) {
      text += `ICEBREAKER QUESTIONS\n${'-'.repeat(40)}\n`;
      d.icebreakers.forEach((q, i) => { text += `${i + 1}. ${q}\n\n`; });
    }

    if (d.contrarianQuestions) {
      text += `CONTRARIAN QUESTIONS\n${'-'.repeat(40)}\n`;
      d.contrarianQuestions.forEach((q, i) => { text += `${i + 1}. ${q}\n\n`; });
    }

    if (d.uniqueAngles) {
      text += `UNIQUE ANGLES MOST HOSTS MISS\n${'-'.repeat(40)}\n`;
      d.uniqueAngles.forEach((a, i) => { text += `${i + 1}. ${a.angle}\n${a.description}\n\n`; });
    }

    if (d.episodeStructure) {
      const s = d.episodeStructure;
      text += `EPISODE STRUCTURE\n${'-'.repeat(40)}\n`;
      if (s.coldOpen) text += `Cold Open:\n${s.coldOpen}\n\n`;
      if (s.intro) text += `Introduction:\n${s.intro}\n\n`;
      [s.actOne, s.actTwo, s.actThree].filter(Boolean).forEach((act) => {
        text += `${act.title} (${act.duration}):\n${act.focus}\n`;
        if (act.keyQuestions) text += act.keyQuestions.map((q) => `  → ${q}`).join('\n') + '\n';
        text += '\n';
      });
      if (s.closingSegment) text += `Closing:\n${s.closingSegment}\n\n`;
      if (s.signOff) text += `Sign-Off:\n${s.signOff}\n\n`;
    }

    if (d.keyTakeaways) {
      text += `KEY TAKEAWAYS FOR YOUR AUDIENCE\n${'-'.repeat(40)}\n`;
      d.keyTakeaways.forEach((t, i) => { text += `${i + 1}. ${t}\n`; });
      text += '\n';
    }

    if (d.episodeTitles) {
      text += `EPISODE TITLE IDEAS\n${'-'.repeat(40)}\n`;
      d.episodeTitles.forEach((t, i) => { text += `${i + 1}. ${t}\n`; });
      text += '\n';
    }

    if (d.socialMediaAngles) {
      text += `SOCIAL MEDIA PROMOTION ANGLES\n${'-'.repeat(40)}\n`;
      d.socialMediaAngles.forEach((a) => {
        text += `${a.platform.toUpperCase()}\nAngle: ${a.angle}\n${a.samplePost}\n\n`;
      });
    }

    text += `\n${'='.repeat(60)}\nGenerated by Podcast Prep AI — podcastprepai.com\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = name ? `podcast-prep-${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt` : 'podcast-prep.txt';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================
  // ERROR MESSAGES
  // ============================================
  function showAppError(msg) {
    els.appError.textContent = msg;
    els.appError.classList.add('visible');
  }

  function hideAppError() {
    els.appError.textContent = '';
    els.appError.classList.remove('visible');
  }

  // ============================================
  // FAQ ACCORDION
  // ============================================
  function initFAQ() {
    document.querySelectorAll('.faq-question').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach((i) => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  // ============================================
  // NAV SCROLL
  // ============================================
  function initNavScroll() {
    const nav = document.querySelector('.nav');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        nav.style.background = 'rgba(8, 12, 20, 0.97)';
      } else {
        nav.style.background = 'rgba(8, 12, 20, 0.85)';
      }
    });
  }

  // ============================================
  // CLIPBOARD UTILITY
  // ============================================
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }

  // ============================================
  // HTML ESCAPE
  // ============================================
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================
  // BOOT
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
