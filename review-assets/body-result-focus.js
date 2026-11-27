(function (root) {
  'use strict';

  // The A15 result view supplies the icon boxes. The waveform and timing come
  // from the standalone A12 C05 / MO prototype, at one third of its 1080 px grid.
  const metricLayout = {
    fat: [5, 5, 19, 18, 40],
    musclePercent: [4, 3, 21, 22],
    water: [7, 3, 15, 22, 100],
    visceral: [3, 5, 23, 18, 20],
    subfat: [3, 8, 22, 12, 40],
    height: [6, 4, 16, 20],
    weight: [5, 5, 19, 18, 120],
    bmi: [7, 3, 15, 23, 40],
    bone: [5, 6, 19, 17, 6],
    protein: [3, 7, 22, 15, 30],
    bmr: [5, 5, 18, 19, 3200],
  };
  const waveform = [[0, 0], [.25, -58], [.5, -55], [.69, -108], [1, -28]];
  const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (node, selector) => node.querySelector(selector);
  const all = (node, selector) => Array.from(node.querySelectorAll(selector));
  const clamp = value => Math.max(0, Math.min(1, value));
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const duration = 1360;
  const travelEnd = 770;
  const switchDuration = 460;
  const switchCommit = 126;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const photographPose = new WeakMap();
  const focusPictures = new Map();
  const still = { alpha: 1, x: 0, y: 0, scale: 1, blur: 0 };
  let warming = false;
  let pending = null;
  let active = null;

  function easing(x1, y1, x2, y2) {
    const cubic = (p, a, b) => 3 * (1 - p) ** 2 * p * a + 3 * (1 - p) * p ** 2 * b + p ** 3;
    return progress => {
      if (progress <= 0 || progress >= 1) return clamp(progress);
      let low = 0, high = 1;
      for (let i = 0; i < 18; i++) {
        const p = (low + high) / 2;
        if (cubic(p, x1, x2) < progress) low = p;
        else high = p;
      }
      return cubic((low + high) / 2, y1, y2);
    };
  }

  const closeEase = easing(.22, .74, .18, 1);
  const fieldEase = easing(.34, .04, .14, 1);
  const dissolve = easing(.35, 0, .34, 1);
  const cue = (ms, start, length, ease = closeEase) => ease(clamp((ms - start) / length));
  const travel = ms => cue(ms, 0, travelEnd, fieldEase);

  // C05's page clock and held presentation, using the current A15 layout.
  function pageCues(ms, hold, opening) {
    const channels = {
      travel: travel(ms),
      retreat: cue(ms, 65, 440, dissolve),
      reveal: cue(ms, 360, 500, dissolve),
      clarity: cue(ms, 415, 525),
      ticks: cue(ms, 710, 270),
      value: cue(ms, 835, 255),
      result: cue(ms, 945, 218),
      status: cue(ms, 975, 232),
      navigation: cue(ms, 995, 365),
    };
    if (!hold) return channels;
    const ratio = hold.travel > 0 ? clamp(channels.travel / hold.travel) : 0;
    const retained = smooth((ratio - .36) / .64);
    for (const key of ['ticks', 'value', 'result', 'status', 'navigation']) {
      const held = hold[key] * retained;
      channels[key] = opening ? Math.max(channels[key], held) : held;
    }
    for (const key of ['retreat', 'reveal', 'clarity']) {
      channels[key] = Math.max(channels[key], hold[key] * retained);
    }
    return channels;
  }

  function detailCues(detail) {
    return { ticks: cue(detail, .025, .375), value: cue(detail, .27, .49),
      result: cue(detail, .41, .5), status: cue(detail, .52, .48) };
  }

  function chartPoint(progress) {
    const segment = waveform.findIndex(([t]) => t >= progress);
    const [from, start] = waveform[Math.max(0, segment - 1)];
    const [to, end] = waveform[Math.max(1, segment)];
    return { x: (90 + 775 * progress) / 3,
      y: (1070 + lerp(start, end, smooth((progress - from) / (to - from)))) / 3 - 48 };
  }

  const axisPoints = Array.from({ length: 85 }, (_, i) => chartPoint(i / 84));
  function path(points) {
    return points.map(({ x, y }, index) => (index ? 'L' : 'M') + x.toFixed(3) + ' ' + y.toFixed(3)).join(' ');
  }

  function svg(tag, attributes) {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function overview(panel) {
    for (const row of all(panel, '.body-metric-row')) {
      const { id } = JSON.parse(row.dataset.payload);
      const [left, top, width, height] = metricLayout[id];
      row.dataset.reviewMetric = id;
      const icon = $(row, 'img');
      Object.assign(icon.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
    }
  }

  function focusPicture(src) {
    const key = new URL(src, document.baseURI).href;
    if (!focusPictures.has(key)) {
      const picture = new Image();
      picture.className = 'body-focus-art';
      picture.alt = '';
      picture.draggable = false;
      picture.decoding = 'async';
      picture.fetchPriority = 'low';
      picture.src = key;
      focusPictures.set(key, picture);
    }
    return focusPictures.get(key);
  }

  function warm(renderMetric) {
    if (warming) return;
    warming = true;
    const ids = Object.keys(metricLayout);
    const decodeNext = async () => {
      while (ids.length) {
        const frame = renderMetric(ids.shift());
        const picture = focusPicture($(frame, '.body-focus-art').getAttribute('src'));
        await picture.decode().catch(() => { /* The reading can still be shown. */ });
      }
    };
    const load = () => { void Promise.all([decodeNext(), decodeNext(), decodeNext()]); };
    if (root.requestIdleCallback) root.requestIdleCallback(load, { timeout: 1000 });
    else root.setTimeout(load, 0);
  }

  function focus(panel, id, reading, tone) {
    panel.dataset.reviewMetric = id;
    const limit = metricLayout[id]?.[4];
    if (tone === 'value' || !limit || !Number.isFinite(reading?.value) || reading.pending) return;
    const unit = $(panel, '.body-reading small:not([hidden])')?.textContent;
    const name = $(panel, '.body-focus-value h2').textContent;
    const plot = svg('svg', {
      class: 'review-focus-plot' + (id === 'fat' ? ' review-fat-chart' : ''),
      viewBox: '0 0 360 503', role: 'img',
      'aria-label': name + ' chart, demo scale 0 to ' + limit + ', result ' + reading.value + (unit ? ' ' + unit : ''),
      'data-tone': tone,
      'data-result-position': clamp(reading.value / limit),
    });
    plot.append(svg('path', { class: 'review-focus-axis', d: path(axisPoints) }));

    const ticks = svg('g', { class: 'review-focus-ticks' });
    const end = axisPoints.at(-1);
    for (const [point, label, x, y] of [[axisPoints[0], 0, 24, 333], [end, limit, limit >= 1000 ? 268 : 280, 321]]) {
      const text = svg('text', { x, y });
      text.textContent = label;
      ticks.append(svg('circle', { cx: point.x, cy: point.y, r: .75 }), text);
    }
    const point = chartPoint(clamp(reading.value / limit));
    const marker = svg('g', { class: 'review-focus-point' });
    marker.append(svg('circle', { cx: point.x, cy: point.y, r: 7.5, fill: 'none', stroke: 'currentColor' }),
      svg('circle', { cx: point.x, cy: point.y, r: 4, fill: 'currentColor' }));
    plot.append(ticks, marker);
    panel.append(plot);
  }

  function replica(panel) {
    const copy = panel.cloneNode(true);
    $(copy, '.review-body-motion')?.remove();
    $(copy, '.review-focus-scrub')?.remove();
    all(copy, '[data-review-pending]').forEach(button => button.removeAttribute('data-review-pending'));
    delete copy.dataset.reviewMotion;
    delete copy.dataset.reviewBrowsing;
    copy.classList.add('review-body-replica');
    return copy;
  }

  function capture(before, next) {
    pending = null;
    if (reduced.matches || !before || !next) return;
    const from = before.dataset.bodyStage;
    const to = next.dataset.bodyStage;
    if (!['overview', 'focus'].includes(from) || !['overview', 'focus'].includes(to)) return;
    const prior = active?.panel === before ? active : null;
    const visible = prior?.switching ? prior.presentation : null;
    const id = (to === 'focus' ? next : visible?.panel || before).dataset.reviewMetric;
    if (!metricLayout[id] || (from === to && before.dataset.reviewMetric === id)) return;
    const resuming = from !== to && prior?.id === id && !prior.switching;
    const previous = replica(visible?.panel || before);
    if (visible) previous.prepend(visible.art.cloneNode(false));
    pending = {
      from, to, id, previous, time: resuming ? prior.time : null,
      hold: (to === 'overview' || resuming) ? prior?.presentation?.channels || pageCues(duration) : null,
      previousChannels: visible?.channels,
      previousIdentity: prior?.presentation?.identity ?? 1,
      portraits: from === to ? capturePhotos(before, prior) : [],
    };
  }

  function rect(node, panel) {
    const parent = panel.getBoundingClientRect(), box = node.getBoundingClientRect();
    const unit = parent.width / 360;
    return [(box.left - parent.left) / unit, (box.top - parent.top) / unit, box.width / unit, box.height / unit];
  }

  function share(before, after, graphic, layer) {
    const original = before.getBoundingClientRect();
    if (!original.width || !after.getBoundingClientRect().width) return () => {};
    const from = rect(before, layer), to = rect(after, layer);
    let paint;
    if (graphic) {
      const image = after.cloneNode(false);
      image.removeAttribute('style');
      image.className = 'review-body-move-icon';
      layer.append(image);
      paint = (progress, opacity) => {
        const [left, top, width, height] = from.map((v, i) => lerp(v, to[i], progress));
        Object.assign(image.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px', opacity });
      };
    } else {
      const label = document.createElement('span');
      label.className = 'review-body-move-label';
      label.textContent = after.textContent;
      const start = getComputedStyle(before), end = getComputedStyle(after);
      const size = [parseFloat(start.fontSize), parseFloat(end.fontSize)];
      const height = [parseFloat(start.lineHeight), parseFloat(end.lineHeight)];
      layer.append(label);
      paint = (progress, opacity) => Object.assign(label.style, {
        left: lerp(from[0], to[0], progress) + 'px', top: lerp(from[1], to[1], progress) + 'px',
        fontSize: lerp(...size, progress) + 'px', lineHeight: lerp(...height, progress) + 'px', opacity,
      });
    }
    before.style.visibility = after.style.visibility = 'hidden';
    return paint;
  }

  function makeViewport(panel, before) {
    const layer = document.createElement('div');
    layer.className = 'review-body-motion';
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    layer.append(before, replica(panel));
    panel.append(layer);
    return layer;
  }

  function photo(image, alpha, y, scale, blur, x = 0) {
    photographPose.set(image, { alpha, x, y, scale, blur });
    Object.assign(image.style, { opacity: alpha, transform: 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')',
      filter: blur > .02 ? 'blur(' + blur + 'px)' : 'none' });
  }

  function portraitLayer(viewport) {
    const layer = document.createElement('div');
    layer.className = 'review-motion-portraits';
    viewport.append(layer);
    return layer;
  }

  function capturePhotos(panel, motion) {
    const blend = $(panel, ':scope > .review-focus-scrub:not([hidden])');
    const pictures = motion ? all(motion.layer, '.review-motion-portraits img')
      : blend ? all(blend, 'img') : [$(panel, ':scope > .body-focus-art')];
    return pictures.map(picture => ({
      image: picture.cloneNode(false), pose: photographPose.get(picture) || still,
    })).filter(frame => frame.pose.alpha > .002);
  }

  function revealPoint(point, progress, opacity = progress) {
    if (!point) return;
    point.style.opacity = opacity;
    point.lastElementChild.setAttribute('r', lerp(3.28, 4, progress));
  }

  function scalePaint(viewport, { id, hold, to, previousIdentity }) {
    const overview = $(viewport, '.review-body-replica[data-body-stage="overview"]');
    const focus = $(viewport, '.review-body-replica[data-body-stage="focus"]');
    const row = $(overview, '.body-metric-row[data-review-metric="' + id + '"]');
    const value = $(focus, '.body-focus-value');
    value.style.opacity = '';
    const moveIcon = share($(row, 'img'), $(value, 'img'), true, viewport);
    const moveName = share($(row, 'span'), $(value, 'h2'), false, viewport);
    const fromLine = $(row, '.review-result-line');
    const chart = $(focus, '.review-focus-plot');
    const oldNumber = $(row, '.body-metric-value');
    const newNumber = $(value, '.body-reading');
    const status = $(value, '.body-focus-source');
    const overviewArt = $(overview, '.body-overview-art');
    const focusArt = $(focus, '.body-focus-art');
    portraitLayer(viewport).append(overviewArt, focusArt);
    const rail = $(focus, '.body-focus-rail');
    const step = $(focus, '.review-metric-position');
    const retiring = all(overview, '.body-results-meta,.review-legend,.body-more');
    const rows = all(overview, '.body-metric-row');
    const selected = rows.indexOf(row);

    const [lineX, lineY, lineWidth] = rect(fromLine, viewport);
    const colored = rect($(fromLine, 'i'), viewport)[2] / lineWidth;
    const sourceColor = getComputedStyle(fromLine).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
    const sourceWeight = rect(fromLine, viewport)[3];
    fromLine.style.visibility = 'hidden';
    const track = svg('svg', { class: 'review-focus-plot review-moving-axis', viewBox: '0 0 360 503', 'data-tone': row.dataset.tone });
    const guide = svg('path', { class: 'review-focus-axis' });
    const signal = svg('path', { class: 'review-moving-signal' });
    const endpoint = svg('rect', { class: 'review-moving-endpoint', fill: 'currentColor' });
    track.append(guide, signal, endpoint);
    viewport.append(track);

    const ticks = chart && $(chart, '.review-focus-ticks');
    const point = chart && $(chart, '.review-focus-point');
    const resultPosition = chart ? Number(chart.dataset.resultPosition) : colored;
    // Match the visible A15 bar end to the measured C05 position before bending.
    function rowPosition(t) {
      if (resultPosition <= 0 || resultPosition >= 1 || !chart) return t;
      return t <= resultPosition ? lerp(0, colored, t / resultPosition)
        : lerp(colored, 1, (t - resultPosition) / (1 - resultPosition));
    }
    if (chart) {
      chart.style.opacity = '';
      $(chart, '.review-focus-axis').style.visibility = 'hidden';
    }
    return ms => {
      const channels = pageCues(ms, hold, to === 'focus');
      const { travel: position, retreat, reveal, clarity, navigation: nav } = channels;
      let identity = 1;
      if (hold && previousIdentity < 1) {
        const fraction = to === 'overview' ? clamp(position / (hold.travel || 1))
          : 1 - clamp((position - hold.travel) / (1 - hold.travel || 1));
        identity = lerp(1, previousIdentity, fraction);
      }
      photo(overviewArt, 1 - retreat, -4 * retreat, 1 + .009 * retreat, 4 / 3 * retreat);
      photo(focusArt, reveal, 3 * (1 - clarity), 1 + .015 * (1 - clarity), 3.2 / 3 * (1 - clarity), 5 / 3 * (1 - clarity));
      overview.style.setProperty('--review-overview-shade', 1 - retreat);
      const release = smooth((position - .025) / .53);
      const oldSignals = smooth((position - .025) / .24);
      retiring.forEach(node => { node.style.opacity = 1 - release; });
      rows.forEach((other, index) => {
        if (index === selected) return;
        const distance = Math.min(1, Math.abs(index - selected) / 4);
        const displacement = smooth((position - .02 - distance * .045) / .43);
        other.style.opacity = 1 - displacement;
        other.style.transform = 'translateY(' + (index < selected ? -1 : 1) * displacement * (10 + distance * 10.67) + 'px)';
      });
      moveIcon(position, identity);
      moveName(position, identity);
      oldNumber.style.opacity = 1 - oldSignals;
      newNumber.style.opacity = channels.value * identity;
      newNumber.style.transform = 'translateY(' + 2 * (1 - channels.value) + 'px)';
      status.style.opacity = channels.status * identity;
      rail.style.opacity = nav;
      rail.style.transform = 'translateX(' + 64 / 3 * (1 - nav) + 'px)';
      const navSettled = position > .93 && nav > .94;
      rail.classList.toggle('review-motion-hide-dots', !navSettled);
      if (step) step.style.opacity = Number(navSettled);
      row.toggleAttribute('data-review-returned', to === 'overview' && ms < .08 * duration);

      const morph = (point, progress) => ({
        x: lerp(lineX + lineWidth * rowPosition(progress), point.x, chart ? position : 0),
        y: lerp(lineY + sourceWeight / 2, point.y, chart ? position : 0),
      });
      guide.setAttribute('d', path(axisPoints.map((point, index) => morph(point, index / 84))));
      guide.style.opacity = chart ? identity : 1 - oldSignals;
      guide.style.strokeWidth = lerp(sourceWeight, 2.5 / 3, position);
      guide.style.stroke = 'rgb(' + sourceColor.map((value, i) => Math.round(lerp(value, [146, 149, 156][i], position))).join(',') + ')';
      signal.setAttribute('d', path(Array.from({ length: 20 }, (_, i) => {
        const progress = resultPosition * i / 19;
        return morph(chartPoint(progress), progress);
      })));
      signal.style.strokeWidth = lerp(4, 1.4, position);
      signal.style.opacity = colored > 0 ? 1 - oldSignals : 0;
      const end = morph(chartPoint(resultPosition), resultPosition);
      const width = lerp(2, 4.6, position), height = lerp(4, 16, position);
      endpoint.setAttribute('x', end.x - width / 2);
      endpoint.setAttribute('y', end.y - height / 2);
      endpoint.setAttribute('width', width);
      endpoint.setAttribute('height', height);
      endpoint.setAttribute('rx', width / 2);
      endpoint.style.opacity = chart && colored > 0 ? clamp(position * 8) * (1 - oldSignals) : 0;
      if (ticks) ticks.style.opacity = channels.ticks * identity;
      revealPoint(point, channels.result, channels.result * identity);
      return { channels, identity };
    };
  }

  function switchPaint(viewport, { portraits, previousChannels, id }) {
    const [before, after] = viewport.children;
    const oldContent = all(before, '.body-focus-value,.review-focus-plot');
    const oldOpacityAtStart = oldContent.map(node => Number(node.style.opacity || 1));
    const newContent = all(after, '.body-focus-value,.review-focus-plot');
    const oldIndex = all(before, '.body-focus-rail,.review-metric-position');
    const newIndex = all(after, '.body-focus-rail,.review-metric-position');
    const oldArt = $(before, '.body-focus-art'), newArt = $(after, '.body-focus-art');
    const field = portraitLayer(viewport);
    oldArt.remove();
    newArt.remove();
    field.append(...portraits.map(frame => frame.image));
    const alreadyVisible = portraits.find(frame => frame.image.src === newArt.src);
    const incoming = alreadyVisible?.image || newArt;
    const incomingPose = alreadyVisible?.pose ||
      { alpha: 0, x: 0, y: 8 / 3, scale: 1.013, blur: 3.4 / 3 };
    if (!alreadyVisible) field.append(incoming);
    const targetIndex = $(before, '.body-focus-rail button[data-review-metric="' + id + '"]');
    if (targetIndex) targetIndex.dataset.reviewPending = '';
    const value = $(after, '.body-reading'), status = $(after, '.body-focus-source');
    const ticks = $(after, '.review-focus-ticks'), point = $(after, '.review-focus-point');
    const restChannels = pageCues(duration);
    return ms => {
      const committed = ms >= switchCommit;
      const detail = detailCues(clamp((ms - switchCommit) / (switchDuration - switchCommit)));
      const oldOpacity = 1 - cue(ms, 0, switchCommit, dissolve);
      const newOpacity = cue(ms, switchCommit, 128);
      oldContent.forEach((node, index) => { node.style.opacity = oldOpacityAtStart[index] * oldOpacity; });
      newContent.forEach(node => { node.style.opacity = newOpacity; });
      oldIndex.forEach(node => { node.style.visibility = committed ? 'hidden' : 'visible'; });
      newIndex.forEach(node => { node.style.visibility = committed ? 'visible' : 'hidden'; });
      value.style.opacity = detail.value;
      value.style.transform = 'translateY(' + 2 * (1 - detail.value) + 'px)';
      status.style.opacity = detail.status;
      if (ticks) ticks.style.opacity = detail.ticks;
      revealPoint(point, detail.result);

      const shotOut = cue(ms, 0, 204, dissolve);
      for (const { image, pose } of portraits) {
        if (committed && image === incoming) continue;
        photo(image, pose.alpha * (1 - shotOut), pose.y - 2 * shotOut, pose.scale - .006 * shotOut,
          pose.blur + .8 * shotOut, pose.x);
      }
      const clarity = cue(ms, 145, 315);
      if (committed || !alreadyVisible) {
        const reveal = cue(ms, 145, 234, dissolve);
        photo(incoming, lerp(incomingPose.alpha * (1 - shotOut), 1, reveal), incomingPose.y * (1 - clarity),
          lerp(incomingPose.scale, 1, clarity), incomingPose.blur * (1 - clarity), incomingPose.x * (1 - clarity));
      }

      return {
        panel: committed ? after : before, art: committed ? newArt : oldArt,
        channels: committed ? { ...restChannels, ...detail } : previousChannels || restChannels,
        identity: committed ? newOpacity : oldOpacityAtStart[0] * oldOpacity,
      };
    };
  }

  function clear() {
    if (!active) return;
    cancelAnimationFrame(active.frame);
    active.layer.remove();
    delete active.panel.dataset.reviewMotion;
    delete active.panel.dataset.reviewRailReady;
    active = null;
  }

  function retreatClock(from, elapsed, tail, length) {
    if (tail && elapsed < tail) return lerp(from, travelEnd, elapsed / tail);
    const wanted = travel(from) * (1 - closeEase(clamp((elapsed - tail) / length)));
    let low = 0, high = travelEnd;
    for (let i = 0; i < 15; i++) {
      const middle = (low + high) / 2;
      if (travel(middle) < wanted) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  }

  function mount(panel) {
    const handoff = pending;
    pending = null;
    if (active && active.panel !== panel) clear();
    if (!handoff || reduced.matches || panel?.dataset.bodyStage !== handoff.to) return;
    const switching = handoff.from === handoff.to;
    const returning = handoff.to === 'overview';
    const start = handoff.time ?? (returning ? duration : 0);
    const tail = returning ? Math.max(0, (start - travelEnd) / duration * 285) : 0;
    const retreat = returning ? Math.max(130, 680 * Math.sqrt(travel(start))) : 0;
    const length = switching ? switchDuration : returning ? tail + retreat : duration - start;
    const viewport = makeViewport(panel, handoff.previous);
    const paint = switching ? switchPaint(viewport, handoff) : scalePaint(viewport, handoff);
    const begin = performance.now();
    panel.dataset.reviewMotion = switching ? 'switch' : returning ? 'return' : 'focus';
    const transition = { panel, layer: viewport, id: handoff.id, switching, time: start, frame: 0, presentation: null };
    active = transition;
    function frame(now) {
      if (active !== transition) return;
      const elapsed = Math.max(0, now - begin);
      if (!panel.isConnected) { clear(); return; }
      if (elapsed >= length) {
        if (returning) $(panel, '.body-metric-row[data-review-metric="' + handoff.id + '"]')?.setAttribute('data-review-returned', '');
        clear();
        return;
      }
      transition.time = returning ? retreatClock(start, elapsed, tail, retreat) : start + elapsed;
      transition.presentation = paint(transition.time);
      if (!switching && !returning) {
        const { travel, navigation } = transition.presentation.channels;
        if (travel > .999 && navigation > .94) panel.dataset.reviewRailReady = '';
      }
      transition.frame = requestAnimationFrame(frame);
    }
    frame(begin);
  }

  function bind(panel, renderMetric) {
    const rail = $(panel, '.body-focus-rail');
    const buttons = all(rail, 'button');
    const ids = buttons.map(button => button.dataset.reviewMetric);
    const initial = panel.dataset.reviewMetric;
    const last = ids.length - 1;
    const art = $(panel, '.body-focus-art');
    const position = $(panel, '.review-metric-position');
    const pictures = document.createElement('div');
    pictures.className = 'review-focus-scrub';
    pictures.hidden = true;
    pictures.setAttribute('aria-hidden', 'true');
    panel.prepend(pictures);

    const frames = new Map();
    let cursor = Math.max(0, ids.indexOf(initial));
    let geometry = null;
    let drag = null;
    let snapFrame = 0;
    let suppressClick = false;

    function frameAt(index) {
      const id = ids[index];
      if (frames.has(id)) return frames.get(id);
      const source = id === initial ? panel : renderMetric(id);
      const picture = focusPicture($(source, ':scope > .body-focus-art').getAttribute('src'));
      if (!picture.complete) picture.addEventListener('load', () => {
        if (panel.isConnected && panel.dataset.reviewBrowsing) paintPictures(Math.round(cursor));
      }, { once: true });
      const frame = {
        picture,
        reading: $(source, '.body-focus-value').cloneNode(true),
        plot: $(source, '.review-focus-plot')?.cloneNode(true),
      };
      frames.set(id, frame);
      return frame;
    }

    function paintPictures(selected) {
      if (reduced.matches) { pictures.hidden = true; return; }
      const base = Math.floor(cursor);
      const part = cursor - base;
      const softness = Math.abs(cursor - selected) * 2;
      const visible = [];
      for (const [index, weight] of [[base, 1 - part], [base + 1, part]]) {
        if (!weight) continue;
        const { picture } = frameAt(index);
        if (!picture.complete || !picture.naturalWidth) continue;
        visible.push(picture);
        if (!pictures.contains(picture)) pictures.append(picture);
        photo(picture, weight ** 1.5 * (index === selected ? 1 : .45), 0, 1 + .004 * softness, .63 * softness);
      }
      for (const picture of [...pictures.children]) if (!visible.includes(picture)) picture.remove();
      pictures.hidden = !visible.length;
    }

    function paint(next) {
      cursor = Math.min(last, Math.max(0, next));
      const selected = Math.round(cursor);
      const id = ids[selected];
      if (id !== panel.dataset.reviewMetric) {
        const frame = frameAt(selected);
        $(panel, '.body-focus-value').replaceWith(frame.reading.cloneNode(true));
        $(panel, '.review-focus-plot')?.remove();
        if (frame.plot) panel.append(frame.plot.cloneNode(true));
        art.src = frame.picture.src;
        position.hidden = false;
        position.textContent = selected + 1 + ' / ' + ids.length;
        panel.dataset.reviewMetric = id;
      }
      const railCursor = reduced.matches ? selected : cursor;
      rail.style.setProperty('--review-rail-y', ((geometry.first + railCursor * geometry.step - geometry.top) / geometry.scale - 9) + 'px');
      buttons.forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === selected));
        button.style.setProperty('--review-index-weight', Math.max(0, 1 - Math.abs(railCursor - index)));
      });
      paintPictures(selected);
    }

    function settle() {
      if (!panel.dataset.reviewBrowsing) return;
      const from = cursor;
      const target = Math.round(from);
      const finish = () => {
        paint(target);
        pictures.hidden = true;
        delete panel.dataset.reviewBrowsing;
        if (ids[target] !== initial) buttons[target].click();
      };
      if (reduced.matches || Math.abs(from - target) < .002) { finish(); return; }
      const started = performance.now();
      panel.dataset.reviewBrowsing = 'settling';
      const tick = now => {
        if (!panel.isConnected) return;
        const t = clamp((now - started) / 280);
        if (t === 1) finish();
        else {
          paint(lerp(from, target, closeEase(t)));
          snapFrame = requestAnimationFrame(tick);
        }
      };
      snapFrame = requestAnimationFrame(tick);
    }

    const center = button => {
      const bounds = button.getBoundingClientRect();
      return bounds.top + bounds.height / 2;
    };
    const railCursorAt = y => (y - geometry.first) / geometry.step;
    panel.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || drag || event.target.closest('.body-title') ||
          (panel.dataset.reviewMotion === 'focus' && !panel.hasAttribute('data-review-rail-ready'))) return;
      suppressClick = false;
      cancelAnimationFrame(snapFrame);
      if (active?.panel === panel && active.switching) {
        const visible = ids.indexOf(active.presentation.panel.dataset.reviewMetric);
        if (visible >= 0) cursor = visible;
      }
      const first = center(buttons[0]);
      geometry = { first, step: (center(buttons[last]) - first) / last,
        top: rail.getBoundingClientRect().top, scale: panel.getBoundingClientRect().width / 360 };
      const button = event.target.closest('.body-focus-rail button');
      const capture = button || panel;
      const events = new AbortController();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: cursor,
        area: rail.contains(event.target) ? 'rail' : 'content', button, capture, events, moved: false };
      capture.setPointerCapture(event.pointerId);
      const options = { signal: events.signal };
      document.addEventListener('pointermove', onPointerMove, options);
      document.addEventListener('pointerup', endDrag, options);
      document.addEventListener('pointercancel', endDrag, options);
      for (let index = Math.max(0, Math.round(cursor) - 1); index <= Math.min(last, Math.round(cursor) + 1); index++) {
        frameAt(index);
      }
    });
    function move(event) {
      const dy = event.clientY - drag.y;
      if (!drag.moved) {
        const distance = drag.area === 'rail' ? Math.hypot(event.clientX - drag.x, dy) : Math.abs(dy);
        if (distance <= 6 * geometry.scale) return;
        drag.moved = true;
        if (active?.panel === panel) clear();
        panel.dataset.reviewBrowsing = drag.area;
        if (event.type === 'pointermove' && drag.capture !== panel) {
          drag.capture = panel;
          panel.setPointerCapture(event.pointerId);
        }
      }
      event.preventDefault();
      paint(drag.area === 'rail' ? railCursorAt(event.clientY) : drag.start - dy / (50 * geometry.scale));
    }
    function onPointerMove(event) {
      if (event.pointerId !== drag?.id) return;
      if (panel.isConnected) move(event);
      else endDrag(event);
    }
    function endDrag(event) {
      if (event.pointerId !== drag?.id) return;
      if (panel.isConnected && event.type === 'pointerup') move(event);
      suppressClick = drag.moved;
      const marginTap = event.type === 'pointerup' && !drag.moved && drag.area === 'rail' && !drag.button;
      drag.events.abort();
      const capture = drag.capture;
      drag = null;
      if (capture.hasPointerCapture(event.pointerId)) capture.releasePointerCapture(event.pointerId);
      if (!panel.isConnected) return;
      if (marginTap) buttons[Math.min(last, Math.max(0, Math.round(railCursorAt(event.clientY))))].click();
      else settle();
    }
    panel.addEventListener('lostpointercapture', event => { if (event.target === drag?.capture) endDrag(event); });
    panel.addEventListener('dragstart', event => event.preventDefault());
    panel.addEventListener('click', event => {
      const indexButton = event.target.closest('.body-focus-rail button');
      const pendingRepeat = active?.panel === panel && active.switching && indexButton?.dataset.reviewMetric === active.id;
      if (!pendingRepeat && (!suppressClick || event.detail === 0)) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    rail.addEventListener('keydown', event => {
      const index = buttons.indexOf(event.target);
      if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? last
        : Math.min(last, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
      event.preventDefault();
      buttons[next].click();
      document.querySelector('.body-focus-rail button[data-review-metric="' + ids[next] + '"]')?.focus({ preventScroll: true });
    });
  }

  reduced.addEventListener('change', clear);
  root.ANOVATOR_BODY_RESULT = { overview, focus, warm, capture, mount, bind };
})(globalThis);
