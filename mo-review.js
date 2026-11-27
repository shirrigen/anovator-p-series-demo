(function (root) {
  'use strict';

  root.ANOVATOR_ROUTE_REVIEW = true;

  const body = root.ANOVATOR_BODY_UI;
  const entry = root.ANOVATOR_ENTRY_UI;
  const driver = root.ANOVATOR_DEMO_DRIVER;
  const engine = root.ANOVATOR_ENGINE;
  const globalChrome = root.ANOVATOR_GLOBAL_CHROME;
  const focusView = root.ANOVATOR_BODY_RESULT;
  const assets = 'review-assets/';
  const motionAssets = assets + 'body-motion/';
  const chrome = 'assets/chrome-v04/';
  const film = 'assets/body-ui/mo-measuring.mp4';
  const titles = ['Thumbs on\nround pads.', '4 fingers on\nlong pads.', 'Arms off\nyour body.', 'Feet flat.'];
  const metricOrder = ['fat', 'musclePercent', 'water', 'visceral', 'subfat', 'height', 'weight', 'bmi', 'bone', 'protein', 'bmr'];
  const legends = { above: 'Above', within: 'Within', below: 'Below', value: 'Value only' };
  // The lengths and bands belong to the Figma example only. This demo has no reference-range service.
  const example = {
    fat: [25.7, 'above', 128], musclePercent: [40, 'value', 100], water: [55.2, 'within', 110],
    visceral: [7, 'within', 71], subfat: [23.3, 'above', 120], height: [165.2, 'value', 173],
    weight: [65.8, 'within', 110], bmi: [24.1, 'above', 123], bone: [2.8, 'within', 94],
    protein: [14.8, 'within', 98], bmr: [1422, 'below', 86]
  };
  root.ANOVATOR_DEMO_PROFILE = { height: example.height[0], weight: example.weight[0] };
  for (const field of root.ANOVATOR_CATALOG.bodyMetrics) {
    if (example[field.id]) field.value = example[field.id][0];
  }
  const reduction = matchMedia('(prefers-reduced-motion: reduce)');
  const isDirect = () => document.documentElement.classList.contains('direct-navigation');
  const at = (selector, scope = document) => scope.querySelector(selector);
  const enterEase = 'cubic-bezier(.22,1,.36,1)';
  const readEase = 'cubic-bezier(.24,.62,.36,1)';
  const trackReveal = 'cubic-bezier(.30,.10,.30,1)';
  const entryDuration = 2060;
  const filmStart = 1560;
  const topicPeriod = 8400;
  const measureTopics = [
    ['body_fat', 'Body fat', 'Visceral · Subcutaneous fat'],
    ['muscle', 'Muscle', 'Muscle percentage'],
    ['water', 'Body water', 'Body water percentage']
  ];
  const resultMotion = { duration: 4900, interactiveAt: 3300, arrivalAt: 1400, holdSeconds: 95 / 30 };
  const directResultMotion = { duration: 4380, interactiveAt: 1510, arrivalAt: 780, holdSeconds: 95 / 30 };
  let measuringEntry = null;
  let captureProgress = null;
  let topicClock = null;
  let topicFrame = 0;
  let resultHandoff = null;
  let focusFrame = null;
  let previousBodyStage = '';

  function fragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template;
  }
  function amount(record, id) {
    return record.values.find(value => value.id === id);
  }
  function exampleBand(record, id) {
    const value = amount(record, id);
    const spec = example[id];
    return record.sample && value?.value === spec?.[0] ? spec.slice(1) : ['value', 0];
  }
  function formatValue(node, value, id, overview) {
    if (!node || !value || !Number.isFinite(value.value)) return;
    const unit = id === 'bmr' ? (overview ? 'kcal' : 'kcal/day') : value.unit === '等级' ? '' : value.unit;
    const precision = id === 'bmr' ? 0 : 1;
    const number = node.querySelector('strong');
    const units = node.querySelector('small');
    if (number) number.textContent = value.value.toFixed(precision);
    if (units) {
      units.textContent = unit;
      units.hidden = !unit;
      units.classList.toggle('unit-percent', unit === '%');
    }
  }

  function renderGuide(state, panel) {
    const step = state.localTasks?.bodyGuide ?? 0;
    panel.dataset.guideStep = step;
    panel.dataset.guideManual = Boolean(state.localTasks?.bodyGuideManual);
    const conditions = panel.querySelectorAll('.body-position li');
    at('.body-position img', panel).src = assets + 'guide-body.png';
    at('span', conditions[0]).textContent = 'Thumbs on round pads.\n4 fingers on long pads.';
    at('span', conditions[1]).remove();
    at('strong', conditions[2]).textContent = 'Heels and forefeet\non all four contacts';
    at('span', conditions[2]).remove();
    at('.body-title', panel).textContent = 'Body composition';
    at('.body-chapter h3', panel).textContent = titles[step] || titles[0];
    at('.body-chapter-copy > p:last-child', panel).remove();
  }

  function paintProgress(cue, value, animate = false) {
    const direct = isDirect();
    const arc = at('.review-capture-value', cue);
    if (value === null) cue.removeAttribute('aria-valuenow');
    else cue.setAttribute('aria-valuenow', value);
    cue.setAttribute('role', value === null ? 'status' : 'progressbar');
    cue.setAttribute('aria-label', value === null ? 'Measuring; progress unavailable' : 'Capture progress');
    const number = at('.review-capture-percent', cue);
    at('span', number).textContent = value ?? (direct ? '' : '—');
    at('small', number).hidden = value === null;
    number.classList.toggle('is-three-digit', value >= 100);
    const dash = (value ?? 0) + ' 100';
    if (animate && !reduction.matches) {
      arc.animate([{ strokeDasharray: getComputedStyle(arc).strokeDasharray }, { strokeDasharray: dash }],
        { duration: direct ? 280 : 650, easing: direct ? enterEase : 'cubic-bezier(.2,0,.2,1)' });
    }
    arc.style.strokeDasharray = dash;
  }

  function renderMeasurement(state, panel) {
    const title = at('.body-title', panel);
    title.textContent = 'Body composition';
    const copy = at('.body-measure-copy', panel);
    copy.prepend(title);
    const cue = at('.body-capture-cue', panel);
    if (!cue) return;
    if (topicClock?.attempt !== state.acq.id) {
      topicClock = {
        attempt: state.acq.id,
        start: measuringEntry ? measuringEntry.startedAt + filmStart : performance.now()
      };
    }
    const status = at('h2', copy);
    const hint = at('p', copy);
    const statusLabel = document.createElement('p');
    statusLabel.className = 'review-capture-status';
    statusLabel.setAttribute('role', 'status');
    statusLabel.textContent = status.textContent;
    status.remove();
    hint.className = 'review-capture-hint';
    cue.before(statusLabel);
    cue.after(hint);
    copy.insertAdjacentHTML('beforeend', '<div class="review-measure-topic">' +
      '<div class="review-topic-heading"><img width="24" height="24" alt=""><h2></h2></div><p></p></div>');
    paintTopic(at('.review-measure-topic', copy), performance.now() - topicClock.start);
    cue.removeAttribute('aria-hidden');
    cue.innerHTML = '<svg viewBox="0 0 44 44" aria-hidden="true">' +
      '<circle class="review-capture-track" cx="22" cy="22" r="21.55"/>' +
      '<circle class="review-capture-value" cx="22" cy="22" r="21.55" pathLength="100"/></svg>' +
      '<strong class="review-capture-percent" aria-hidden="true"><span></span><small>%</small></strong>';
    paintProgress(cue, captureProgress?.attempt === state.acq.id ? captureProgress.value : null);
  }

  function renderOverview(panel, record) {
    at('.body-overview-art', panel).src = assets + 'overview-body.png';
    const legend = Object.entries(legends).map(([tone, label]) =>
      '<li data-tone="' + tone + '"><i></i>' + label + '</li>'
    ).join('');
    const count = at('.body-results-meta', panel);
    count.insertAdjacentHTML('afterend', '<ul class="review-legend" aria-label="Result classifications">' + legend + '</ul>');
    if (!record.needsReview) count.textContent = '11 results';
    const tabs = at('.body-tabs', panel);
    tabs.classList.add('review-overview-tabs');
    for (const [index, row] of [...panel.querySelectorAll('.body-metric-row')].entries()) {
      const id = metricOrder[index];
      const value = amount(record, id);
      const [tone, width] = exampleBand(record, id);
      const words = row.children[1];
      if (id === 'water') words.textContent = 'Body water';
      if (id === 'bmr') words.textContent = 'BMR';
      formatValue(at('.body-metric-value', row), value, id, true);
      row.dataset.tone = tone;
      row.setAttribute('aria-label', [words.textContent, value?.value, value?.unit, legends[tone]].filter(word => word !== undefined && word !== '').join(', '));
      at('.body-result-track', row)?.remove();
      row.insertAdjacentHTML('beforeend', '<span class="review-result-line" aria-hidden="true"><i style="width:' + width + 'px"></i></span>');
    }
    focusView.overview(panel);
  }

  function renderFocusMetric(panel, id, record) {
    const index = metricOrder.indexOf(id);
    const [tone] = exampleBand(record, id);
    const value = amount(record, id);
    const section = at('.body-focus-value', panel);
    formatValue(at('.body-reading', section), value, id, false);
    if (id === 'water') at('h2', section).textContent = 'Body water';
    if (id === 'bmr') at('h2', section).textContent = 'BMR';
    at('.body-focus-source', section).textContent = record.needsReview ? 'Profile changed · retest to update' : legends[tone];
    section.dataset.tone = tone;
    at('.body-focus-scale', section)?.remove();
    panel.insertAdjacentHTML('beforeend', index >= 0
      ? '<p class="review-metric-position">' + (index + 1) + ' / 11</p>'
      : '<p class="review-metric-position" hidden></p>');
    if (id === 'fat') {
      at('.body-focus-art', panel).src = assets + 'focus-body-fat.png';
    }
    focusView.focus(panel, id, value, record.needsReview ? 'value' : tone);
  }

  function previewFocus(state, controls, id) {
    const view = fragment(body.render({ ...state, selectedMetric: id }, 'focus', controls));
    const frame = at('.body-screen', view.content);
    renderFocusMetric(frame, id, controls.record);
    return frame;
  }

  function renderFocus(state, panel, template, controls) {
    renderFocusMetric(panel, state.selectedMetric, controls.record);
    at('.body-tabs', panel).remove();
    at('.task-actions', template.content).replaceChildren(fragment(
      controls.n('Back to overview', 'result/body', 'result-return review-focus-back')
    ).content);
    panel.querySelectorAll('.body-focus-rail button').forEach((button, index) => {
      const id = metricOrder[index];
      const [band] = exampleBand(controls.record, id);
      button.dataset.tone = band;
      button.dataset.reviewMetric = id;
    });
    focusFrame = id => previewFocus(state, controls, id);
  }

  root.ANOVATOR_BODY_UI = {
    ...body,
    sync(state, act, previousVideo) {
      const panel = at('.device .body-screen[data-body-stage="focus"]');
      if (panel && focusFrame) {
        focusView.bind(panel, focusFrame);
        focusFrame = null;
      }
      const shot = measuringEntry;
      if (shot && !reduction.matches && state.route === 'measure/body' && !state.stop &&
          performance.now() - shot.startedAt < filmStart) {
        shot.releaseFilm = () => body.sync(state, act, previousVideo);
      } else {
        if (shot) shot.releaseFilm = null;
        body.sync(state, act, previousVideo);
      }
    },
    render(state, kind, controls) {
      const template = fragment(body.render(state, kind, controls));
      const panel = at('.body-screen', template.content);
      if (!panel) return template.innerHTML;
      if (kind === 'prepare') renderGuide(state, panel);
      if (kind === 'measure') renderMeasurement(state, panel);
      if (kind === 'result') {
        if (!reduction.matches && previousPage === 'measure/body' && !controls.record.partial) {
          resultHandoff = captureResultHandoff();
        }
        renderOverview(panel, controls.record);
        focusView.warm(id => previewFocus(state, controls, id));
      }
      if (kind === 'focus') renderFocus(state, panel, template, controls);
      focusView.capture(at('.device .body-screen'), panel);
      return template.innerHTML;
    }
  };
  root.ANOVATOR_ENTRY_UI = {
    ...entry,
    render(state, controls) {
      const identity = state.identityDraft ?? (controls.demo ? '' : state.user?.id ?? state.reviewIdentity ?? '');
      const template = fragment(entry.render({ ...state, identityDraft: identity }, controls));
      at('[data-member-key="backspace"]', template.content).innerHTML = '<img src="' + assets + 'backspace.svg" alt="">';
      const field = at('#member-id', template.content);
      field.removeAttribute('style');
      if (!controls.demo) field.maxLength = 12;
      const [back, forward] = template.content.querySelectorAll('.entry-actions button');
      back.insertAdjacentHTML('afterbegin', '<img src="' + chrome + 'back.svg" alt="">');
      forward.innerHTML = '<span><img src="' + chrome + 'next.svg" alt="">Continue</span>';
      return template.innerHTML;
    }
  };

  function positionEntryAction(route) {
    const view = at('.device-main');
    const slot = at('.device-actions');
    if (!view || !slot) return;
    const profile = route === 'profile' && at('form[data-form="profile"]', view);
    const submit = profile ? at('button[type="submit"]', profile) : at('[data-action="consent"].primary', view);
    if (!submit) return;
    if (profile) {
      profile.id = 'review-profile';
      submit.setAttribute('form', profile.id);
    }
    const actions = document.createElement('div');
    actions.className = 'wrap task-actions';
    const exit = at('[data-action="end"]', view);
    if (exit) actions.append(exit);
    actions.append(submit);
    slot.replaceChildren(actions);
    slot.hidden = false;
  }
  root.ANOVATOR_GLOBAL_CHROME = {
    ...globalChrome,
    mount(state, rules) {
      if (state.route === 'consent' || state.route === 'profile') positionEntryAction(state.route);
      const device = at('.device');
      if (device && state.route === 'metric' && at('.body-screen[data-body-stage="focus"]', device)) {
        const bottom = at('.device-bottom', device);
        at('.gn-project-navigation', bottom)?.remove();
        at('.device-footer', bottom).replaceChildren();
      }
      root.ANOVATOR_REVIEW_EN?.surface(device);
      globalChrome.mount(state, rules);
    }
  };

  // This workbench opens the full capability scenario. Its ordinary engine and device events are shared with G01.
  root.ANOVATOR_ENGINE = { ...engine, fresh: (profile = 'all') => engine.fresh(profile) };
  // Same five simulated capture samples as 12B (4, 12, 20, 28, 34 s).
  // The last sample gets its full stroke animation before the result is displayed.
  const captureSteps = [
    { duration: 6000, samples: [[4000, 20]] },
    { duration: 22000, samples: [[6000, 40], [14000, 60]] },
    { duration: 6800, samples: [[0, 80], [6000, 100]] }
  ];
  root.ANOVATOR_DEMO_DRIVER = {
    create(options) {
      const clock = options.clock || root;
      const speed = () => root.ANOVATOR_PAGES_RELEASE && options.getState().settings.demoBodySpeed === 4 ? 4 : 1;
      let captureTimer = null;

      function cancelCapture(timer) {
        for (const sample of timer.samples) clock.clearTimeout(sample);
        clock.clearTimeout(timer.timeout);
      }

      function scheduleCapture(timer) {
        timer.rate = speed();
        timer.startedAt = performance.now();
        const wait = atTime => Math.max(0, Math.min(atTime, timer.lead) - timer.elapsed) +
          Math.max(0, atTime - Math.max(timer.elapsed, timer.lead)) / timer.rate;
        timer.samples = timer.step.samples.filter(([, value]) => value > (timer.progress.value ?? 0))
          .map(([atTime, value]) => clock.setTimeout(() => {
            const current = options.getState();
            if (captureTimer !== timer || captureProgress !== timer.progress ||
                current.acq?.id !== timer.progress.attempt || current.stop ||
                current.acq.step !== timer.stage || !options.enabled()) return;
            timer.progress.value = value;
            const cue = at('.device .body-capture-cue');
            if (cue) paintProgress(cue, value, true);
          }, wait(atTime)));
        timer.timeout = clock.setTimeout(() => {
          if (captureTimer !== timer) return;
          cancelCapture(timer);
          captureTimer = null;
          timer.callback();
        }, wait(timer.step.duration));
      }

      const simulator = driver.create({
        ...options,
        clock: {
          clearTimeout(timer) {
            if (timer === captureTimer) {
              cancelCapture(timer);
              captureTimer = null;
            } else clock.clearTimeout(timer);
          },
          setTimeout(callback, milliseconds) {
            const state = options.getState();
            const progress = captureProgress;
            const stage = state.acq?.step;
            const step = progress && milliseconds === 2200 ? captureSteps[stage] : null;
            if (!step) return clock.setTimeout(callback, milliseconds);
            captureTimer = { callback, step, stage, progress, elapsed: 0, lead: stage === 0 ? entryDuration : 0 };
            scheduleCapture(captureTimer);
            return captureTimer;
          }
        }
      });
      return {
        sync() {
          const state = options.getState();
          const active = options.enabled() && state.route === 'measure/body' && !state.stop &&
            !state.privacyLocked && state.acq?.testId === 'body';
          if (!active && captureProgress) {
            captureProgress = null;
            const cue = at('.device .body-capture-cue');
            if (cue) paintProgress(cue, null);
          }
          if (active && captureProgress?.attempt !== state.acq.id) {
            captureProgress = { attempt: state.acq.id, value: null };
          }
          simulator.sync();
        },
        retimeBody() {
          const video = at('.device .body-measure-media video');
          if (video) video.playbackRate = speed();
          const timer = captureTimer;
          if (!timer || timer.rate === speed()) return;
          const elapsed = performance.now() - timer.startedAt;
          const leadRemaining = Math.max(0, timer.lead - timer.elapsed);
          timer.elapsed += Math.min(leadRemaining, elapsed) + Math.max(0, elapsed - leadRemaining) * timer.rate;
          cancelCapture(timer);
          scheduleCapture(timer);
        },
        clear() {
          captureProgress = null;
          simulator.clear();
        }
      };
    }
  };

  document.documentElement.classList.add('mo-flow-review');
  const app = document.getElementById('app');
  const entryFilm = document.createElement('video');
  entryFilm.className = 'review-entry-film';
  entryFilm.muted = true;
  entryFilm.loop = true;
  entryFilm.playsInline = true;
  entryFilm.setAttribute('aria-hidden', 'true');
  entryFilm.addEventListener('playing', () => entryFilm.classList.add('is-playing'));
  entryFilm.addEventListener('error', () => entryFilm.classList.remove('is-playing'));
  let previousPage = null;
  let controlsOpen = true;

  function stageFilm(panel) {
    if (!panel || reduction.matches) {
      entryFilm.pause();
      entryFilm.remove();
      return;
    }
    if (!entryFilm.src) entryFilm.src = film;
    panel.prepend(entryFilm);
    entryFilm.play().catch(() => entryFilm.classList.remove('is-playing'));
  }
  function standby(main) {
    const prior = at('.splash', main);
    if (!prior) return null;
    const start = at('[data-action="start"]', prior);
    const scene = document.createElement('section');
    scene.className = 'review-standby';
    scene.setAttribute('aria-label', 'ANOVATOR standby');
    scene.innerHTML = '<img src="assets/entry-ui/member-id-mo.png" alt="">';
    start.textContent = 'Tap to begin';
    scene.append(start);
    prior.replaceWith(scene);
    return scene;
  }
  function revealIdentity(panel) {
    if (!panel || reduction.matches) return;
    const parts = panel.querySelectorAll('.entry-intro, .entry-field, .entry-keypad, .entry-actions');
    parts.forEach((node, index) => node.animate(
      [{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 420, delay: index * 68, easing: 'cubic-bezier(.21,.72,.25,1)', fill: 'backwards' }
    ));
  }

  function reveal(node, delay = 0, duration = 170, distance = 0, easing = enterEase) {
    const frames = [{ opacity: 0 }, { opacity: 1 }];
    if (distance) {
      frames[0].translate = '0 ' + distance + 'px';
      frames[1].translate = 'none';
    }
    node?.animate(frames, { duration, delay, easing, fill: 'backwards' });
  }

  function revealDecodedImage(image, delay, duration) {
    if (!image) return;
    if (image.complete && image.naturalWidth) {
      reveal(image, delay, duration);
      return;
    }
    image.style.visibility = 'hidden';
    image.decode().then(() => {
      if (!image.isConnected) return;
      image.style.removeProperty('visibility');
      if (!reduction.matches) reveal(image, 0, duration);
    }, () => {});
  }

  function revealPreparation(panel) {
    const stage = panel?.dataset.bodyStage;
    const key = stage === 'guide' ? 'guide-' + panel.dataset.guideStep : stage;
    if (key === previousBodyStage) return;
    const prior = previousBodyStage;
    previousBodyStage = key || '';
    if (reduction.matches || !panel) return;
    if (stage === 'intro') {
      reveal(at('.body-intro-media', panel), 0, 320);
      reveal(at('.body-intro-title', panel), 40, 210, 6);
      reveal(at('.body-intro-report', panel), 92, 170, 4);
      reveal(at('.body-intro-metrics', panel), 130, 192, 4);
    }
    if (stage !== 'guide') return;
    const entering = !prior.startsWith('guide-');
    if (entering) {
      reveal(at('.body-guide-title', panel), 0, 170, 4);
      reveal(at('.body-position', panel), 44, 192);
    }
    const delay = entering ? 100 : 0;
    revealDecodedImage(at('.body-chapter > img', panel), delay, 170);
    reveal(at('.body-chapter-copy', panel), delay, 170, entering ? 4 : 0);
    reveal(at('.body-guide-tabs [aria-pressed="true"]', panel), delay, 170);
  }

  root.ANOVATOR_DIRECT_VITALS = {
    pressure(screen, field, previous) {
      if (!screen || !field || reduction.matches || !previous || screen.dataset.bpId !== previous.id) return true;
      const { bpStage: stage, bpPressure: pressure } = screen.dataset;
      const phaseChanged = stage !== previous.stage;
      const sampleChanged = pressure !== previous.pressure;
      if (!phaseChanged && !sampleChanged) return true;
      const { transform, opacity, filter } = getComputedStyle(field);
      const paired = screen.hasAttribute('data-bp-pair');
      const landing = phaseChanged && stage === 'locked';
      field.animate([previous.field, { transform, opacity, filter }],
        { duration: landing ? 360 : sampleChanged ? 160 : 170, easing: landing ? readEase : enterEase });
      if (landing && paired) {
        reveal(at('.bp-pair', screen), 72, 192, 4, readEase);
        for (const line of screen.querySelectorAll('.bp-pair-line')) {
          line.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }],
            { delay: 116, duration: 192, easing: trackReveal, fill: 'backwards' });
        }
      } else if (screen.hasAttribute('data-bp-live') && previous.pressure === '') {
        reveal(at('.bp-live', screen), 0, 170, 4, readEase);
      }
      return true;
    }
  };
  function easedTime(ms, from, to) {
    const t = Math.max(0, Math.min(1, (ms - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }

  function paintTopic(topic, elapsed) {
    const ms = reduction.matches ? 0 : Math.max(0, elapsed);
    const index = Math.floor(ms / topicPeriod) % measureTopics.length;
    const local = ms % topicPeriod;
    const phase = Math.max(0, (local - 7000) / 1400);
    const entering = phase >= .43;
    const [icon, title, detail] = measureTopics[(index + Number(entering)) % measureTopics.length];
    const heading = at('.review-topic-heading', topic);
    const caption = at('p', topic);
    if (topic.dataset.topic !== icon) {
      at('img', heading).src = motionAssets + icon + '-72.svg';
      at('h2', heading).textContent = title;
      caption.textContent = detail;
      topic.dataset.topic = icon;
    }
    const leaving = easedTime(phase, 0, .35);
    const enterHeading = easedTime(phase, .43, 1);
    const enterCaption = easedTime(phase, .55, 1);
    heading.style.opacity = entering ? enterHeading : 1 - leaving;
    heading.style.transform = 'translateY(' + (entering ? 2.67 * (1 - enterHeading) : -2 * leaving) + 'px)';
    caption.style.opacity = entering ? enterCaption : 1 - leaving;
    caption.style.transform = 'translateY(' + (entering ? 2 * (1 - enterCaption) : 0) + 'px)';
  }

  function cycleMeasureTopic(topic) {
    cancelAnimationFrame(topicFrame);
    if (!topic || !topicClock) return;
    const start = topicClock.start;
    function tick(now) {
      if (!topic.isConnected) return;
      paintTopic(topic, now - start);
      if (!reduction.matches) topicFrame = requestAnimationFrame(tick);
    }
    tick(performance.now());
  }

  function captureResultHandoff() {
    const prior = at('.device .body-screen[data-body-stage="measure"]');
    const cue = prior && at('.body-capture-cue', prior);
    if (!cue) return null;
    const reading = document.createElement('div');
    reading.className = 'review-capture-outgoing';
    reading.inert = true;
    reading.setAttribute('aria-hidden', 'true');
    for (const part of [at('.body-measure-copy', prior), at('.review-capture-status', prior), cue]) {
      reading.append(part.cloneNode(true));
    }
    const topic = at('.review-measure-topic', reading);
    for (const part of topic.children) part.style.cssText = '';
    at('.review-capture-status', reading).textContent = 'Captured';
    const badge = at('.body-capture-cue', reading);
    badge.innerHTML = '<img class="review-capture-badge" src="' + motionAssets + 'capture-complete.svg" alt="">';
    return { reading, media: at('.body-measure-media', prior) };
  }

  function revealResult(device, panel, outgoing) {
    const direct = isDirect();
    const art = at('.body-overview-art', panel);
    const list = at('.body-metric-list', panel);
    const more = at('.body-more', panel);
    const actions = at('.device-actions', device);
    const resultIndex = at('.h10-result-index', device);
    const { reading, media } = outgoing;
    const oldFilm = at('video', media);
    const arrival = document.createElement('div');
    arrival.className = 'review-result-arrival';
    arrival.setAttribute('aria-hidden', 'true');
    arrival.innerHTML = '<video class="review-result-walk" muted playsinline preload="auto" poster="' +
      motionAssets + 'MO-C2-arrival-first.png" src="' + motionAssets + 'MO-C2-arrival-no-edge.mp4"></video>' +
      '<img src="' + motionAssets + 'MO-C2-arrival-hold.png" alt="">';
    const walk = at('video', arrival);
    const poster = direct ? new Image() : null;
    if (poster) poster.src = walk.poster;
    const hold = at('img', arrival);
    walk.playbackRate = 1;
    panel.append(media, arrival, reading);
    oldFilm?.play().catch(() => {});
    const controls = [list, more, actions, resultIndex].filter(node => node && !node.inert);
    controls.forEach(node => { node.inert = true; });

    function appear(node, from, to, distance = 5) {
      node.animate([{ opacity: 0, transform: 'translateY(' + distance + 'px)' },
        { opacity: 1, transform: 'translateY(0)' }],
      { delay: from, duration: to - from, easing: 'cubic-bezier(.42,0,.58,1)', fill: 'backwards' });
    }
    if (direct) {
      reveal(at('.body-title', panel), 470, 170, 5);
      reveal(at('.body-results-meta', panel), 515, 170);
      reveal(at('.review-legend', panel), 555, 170, 0, readEase);
      Array.from(list.children).forEach((row, index) => {
        const delay = 670 + Math.floor(index / 4) * 64 + (index % 4) * 12;
        reveal(row, delay, 170, 0, readEase);
        const band = at('.review-result-line i', row);
        band?.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }],
          { delay: delay + 26, duration: 192, easing: trackReveal, fill: 'backwards' });
        reveal(at('.body-metric-value', row), delay + 90, 170, 0, readEase);
      });
      if (actions && !actions.hidden) reveal(at('.gn-task-native', actions) || actions, 1220, 170);
    } else {
      appear(at('.body-title', panel), 700, 1260, 6);
      appear(at('.body-results-meta', panel), 920, 1540);
      appear(at('.review-legend', panel), 920, 1540);
      Array.from(list.children).forEach((row, index) => appear(row, 1400 + index * 32, 2000 + index * 32));
      if (more) appear(more, 2700, 3300);
      if (actions && !actions.hidden) appear(at('.gn-task-native', actions) || actions, 2700, 3300, 0);
      if (resultIndex) appear(resultIndex, 2700, 3300, 0);
    }

    const start = performance.now();
    let playing = false;
    let held = false;
    let failed = false;
    let released = false;
    let overlapAt = null;
    const { arrivalAt, holdSeconds, interactiveAt, duration } = direct ? directResultMotion : resultMotion;
    const filmExit = 1100;
    const readingExit = direct ? 660 : 900;
    function tick(now) {
      if (!device.isConnected) {
        oldFilm?.pause();
        walk.pause();
        return;
      }
      const ms = reduction.matches ? duration : now - start;
      if (!direct && ms >= filmExit && media.isConnected) {
        oldFilm?.pause();
        media.remove();
      } else if (!direct && ms < filmExit) media.style.opacity = 1 - easedTime(ms, 450, filmExit);
      if (ms >= readingExit) reading.remove();
      else {
        const leave = easedTime(ms, 450, readingExit);
        reading.style.opacity = 1 - leave;
        reading.style.transform = 'translateY(' + (direct ? 4 : -2) * leave + 'px)';
      }
      if (ms >= arrivalAt && !playing && ms < duration) {
        playing = true;
        walk.play().catch(() => { failed = true; });
      }
      if (playing && !held) {
        failed ||= Boolean(walk.error) || (ms > arrivalAt + 1800 && walk.currentTime < .05);
        if (failed || walk.currentTime >= holdSeconds || walk.ended) {
          held = true;
          walk.pause();
          if (!failed) walk.currentTime = holdSeconds;
        }
      }
      if (failed && (!direct || (hold.complete && hold.naturalWidth))) arrival.dataset.fallback = 'true';
      const settle = !direct || (art.complete && art.naturalWidth) ? easedTime(ms, duration - 320, duration) : 0;
      let incoming = easedTime(ms, arrivalAt, arrivalAt + 500);
      if (direct) {
        const pictureReady = arrival.hasAttribute('data-fallback') ? hold.complete && hold.naturalWidth :
          walk.readyState >= 2 || (poster.complete && poster.naturalWidth);
        if (overlapAt === null && ms >= arrivalAt && pictureReady) overlapAt = ms;
        incoming = overlapAt === null ? 0 : easedTime(ms, overlapAt, overlapAt + 380);
        if (media.isConnected) {
          const outgoingOpacity = (1 - incoming) * (1 - settle);
          media.style.opacity = outgoingOpacity;
          if (!outgoingOpacity) {
            oldFilm?.pause();
            media.remove();
          }
        }
      }
      art.style.opacity = settle;
      arrival.style.opacity = incoming * (1 - settle);
      device.dataset.bodyResultMotion = ms < 450 ? 'captured' : ms < arrivalAt ? 'results-lead' :
        held ? 'settling' : 'body-arrival';
      if (ms >= interactiveAt && !released) {
        released = true;
        controls.forEach(node => { node.inert = false; });
      }
      if (ms < duration || (direct && !art.complete)) requestAnimationFrame(tick);
      else {
        oldFilm?.pause();
        walk.pause();
        if (!direct || art.naturalWidth) arrival.remove();
        art.style.removeProperty('opacity');
        device.dataset.bodyResultMotion = 'settled';
      }
    }
    tick(start);
  }

  function bezier(a, b, c, d, t) {
    const rest = 1 - t;
    return rest ** 3 * a + 3 * rest ** 2 * t * b + 3 * rest * t ** 2 * c + t ** 3 * d;
  }

  // Bend the open stroke around its lower midpoint until the two ends meet at the top.
  function ringStroke(closure, radius) {
    const bend = Math.PI * closure;
    if (bend < .01) return 'M' + (-radius * Math.PI / 2) + ' 0 H' + (radius * Math.PI / 2);
    const arcRadius = radius * (.5 + .5 * closure) * Math.PI / bend;
    const x = arcRadius * Math.sin(bend);
    const bottom = radius * closure;
    const end = bottom - arcRadius * (1 - Math.cos(bend));
    const arc = ' A' + arcRadius + ' ' + arcRadius + ' 0 0 0 ';
    return 'M' + -x + ' ' + end + arc + '0 ' + bottom + arc + x + ' ' + end;
  }

  function startHandoff(device, main, cue, shot) {
    const bounds = device.getBoundingClientRect();
    const end = cue.getBoundingClientRect();
    const scale = bounds.width / 360;
    const targetX = (end.left + end.width / 2 - bounds.left) / scale;
    const targetY = (end.top + end.height / 2 - bounds.top) / scale;
    const ghost = document.createElement('div');
    ghost.className = 'review-guide-outgoing';
    ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.append(shot.guide);
    main.append(ghost);
    const marker = document.createElement('div');
    marker.className = 'review-measure-entry';
    marker.setAttribute('aria-hidden', 'true');
    marker.append(shot.pill);
    marker.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 360 640"><path/></svg>');
    device.append(marker);
    const path = at('path', marker);
    const { x, y, width, height } = shot.origin;

    function paint(now) {
      if (!device.isConnected || measuringEntry !== shot) return;
      const ms = reduction.matches ? entryDuration : Math.max(0, now - shot.startedAt);
      const exit = easedTime(ms, 100, 450);
      const enter = easedTime(ms, 450, 1260);
      const outgoing = ms < 450;
      const cx = outgoing ? bezier(x, x + 18, x + 48, 392, exit) : bezier(-53, 93, targetX, targetX, enter);
      const cy = outgoing ? y : bezier(y, y, y - 4, targetY, enter);
      const press = ms < 100 ? 1 - .08 * Math.sin(ms / 100 * Math.PI) : 1;
      const radius = (height / 2) * (1 - enter) + 21.55 * enter;
      const pillWidth = outgoing ? width + (height - width) * exit : 2 * radius;
      const pillHeight = outgoing ? height : 2 * radius;
      shot.pill.style.width = pillWidth + 'px';
      shot.pill.style.height = pillHeight + 'px';
      shot.pill.style.transform = 'translate(' + (cx - pillWidth / 2) + 'px,' + (cy - pillHeight / 2) + 'px) scale(' + press + ')';
      shot.pill.style.opacity = 1 - easedTime(ms, 620, 1120);
      shot.pill.style.setProperty('--start-label', 1 - easedTime(ms, 110, 390));
      const blend = easedTime(ms, 1340, 1480);
      path.setAttribute('d', ringStroke(easedTime(ms, 680, 1260), radius));
      path.setAttribute('transform', 'translate(' + cx + ' ' + cy + ')');
      path.style.opacity = easedTime(ms, 620, 1030) * (1 - blend);
      ghost.style.transform = 'translateX(' + (-560 * easedTime(ms, 100, 1040)) + 'px)';
      ghost.style.opacity = 1 - easedTime(ms, 660, 1060);
      device.style.setProperty('--entry-ring', blend);
      device.style.setProperty('--entry-copy', easedTime(ms, 1480, 1990));
      device.style.setProperty('--entry-status', easedTime(ms, 1330, 1680));
      device.style.setProperty('--entry-hint', easedTime(ms, 1570, 2010));
      device.style.setProperty('--entry-film', easedTime(ms, filmStart, entryDuration));
      // The ring crosses the disabled project icons on its way up from the lower action row.
      const passingNavigation = easedTime(ms, 540, 780) * (1 - easedTime(ms, 1060, 1330));
      device.style.setProperty('--entry-nav', 1 - .82 * passingNavigation);
      device.dataset.bodyEntry = outgoing ? 'exit' : ms < 1260 ? 'outline' : ms < filmStart ? 'settle' : 'film';
      if (ms >= filmStart && shot.releaseFilm) {
        shot.releaseFilm();
        shot.releaseFilm = null;
      }
      if (ms < entryDuration) requestAnimationFrame(paint);
      else {
        delete device.dataset.bodyEntry;
        for (const name of ['--entry-ring', '--entry-copy', '--entry-status', '--entry-hint', '--entry-film', '--entry-nav']) {
          device.style.removeProperty(name);
        }
        ghost.remove();
        marker.remove();
        measuringEntry = null;
      }
    }
    paint(performance.now());
  }

  function decorate() {
    const route = root.ANOVATOR_REVIEW?.getPage();
    const device = at('.device', app);
    const main = at('.device-main', device || app);
    if (!device || !main || !route) return;
    device.dataset.reviewPage = route;
    const panel = route === 'standby' ? standby(main) : at('.entry-screen', main);
    stageFilm(panel);
    if (route === 'identity' && previousPage === 'standby') revealIdentity(panel);
    if (isDirect()) {
      revealPreparation(at('.body-screen', main));
      if (route === 'prepare/bp' && previousPage !== route && !reduction.matches) {
        reveal(at('.bp-ready-copy', main), 0, 170, 5);
        revealDecodedImage(at('.bp-seat', main), 45, 210);
        reveal(at('.bp-ready-status', main), 98, 170, 3);
      }
    }
    const cue = route === 'measure/body' && at('.body-capture-cue', main);
    if (!cue) {
      measuringEntry = null;
      topicClock = null;
    } else if (measuringEntry && !reduction.matches) startHandoff(device, main, cue, measuringEntry);
    cycleMeasureTopic(cue && at('.review-measure-topic', main));
    const result = route === 'result/body' && at('.body-screen[data-body-stage="overview"]', main);
    if (result && resultHandoff && !reduction.matches) revealResult(device, result, resultHandoff);
    resultHandoff = null;
    focusView.mount(at('.body-screen', main));
    const note = root.ANOVATOR_PAGES_RELEASE ? null : at('.screen-note', app);
    if (note) {
      note.textContent = route === 'standby' || route === 'identity'
        ? 'Enter a member ID to try the demo.'
        : 'Demo session with sample readings.';
      const options = at('.entry-options', main);
      if (options) note.after(options);
    }
    const caption = root.ANOVATOR_PAGES_RELEASE ? null : at('.screen-caption > span', app);
    if (caption) caption.textContent = 'ANOVATOR measurement preview';
    for (const surface of app.querySelectorAll('.screen-caption, .fullscreen-tools, .entry-options')) {
      root.ANOVATOR_REVIEW_EN?.surface(surface);
    }
    const reviewPanel = at('details#demo-controls', app);
    if (reviewPanel && !document.body.classList.contains('screen-fullscreen')) {
      reviewPanel.open = controlsOpen;
      reviewPanel.addEventListener('toggle', () => {
        if(reviewPanel.isConnected&&!document.body.classList.contains('screen-fullscreen'))controlsOpen=reviewPanel.open;
      });
    }
    previousPage = route;
  }
  document.addEventListener('click', event => {
    const start = event.target.closest?.('[data-action="start-measure"][data-payload*="body"]');
    if (!start || start.disabled || reduction.matches || root.ANOVATOR_REVIEW?.getPage() !== 'prepare/body') return;
    const device = start.closest('.device');
    const guide = device && at('.body-wrap', device);
    const pill = at('.gn-action-visual', start);
    if (!guide || !pill) return;
    const bounds = device.getBoundingClientRect();
    const box = pill.getBoundingClientRect();
    const scale = bounds.width / 360;
    measuringEntry = {
      startedAt: performance.now(),
      guide: guide.cloneNode(true),
      pill: pill.cloneNode(true),
      origin: {
        x: (box.left + box.width / 2 - bounds.left) / scale,
        y: (box.top + box.height / 2 - bounds.top) / scale,
        width: box.width / scale,
        height: box.height / scale
      }
    };
    const shot = measuringEntry;
    setTimeout(() => {
      if (measuringEntry === shot && root.ANOVATOR_REVIEW.getPage() !== 'measure/body') measuringEntry = null;
    }, 0);
  }, true);
  new MutationObserver(decorate).observe(app, { childList: true });
  reduction.addEventListener('change', () => {
    const panel = at('.review-standby, .entry-screen', app);
    stageFilm(panel);
    cycleMeasureTopic(at('.review-measure-topic', app));
  });
})(globalThis);
