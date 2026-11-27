(function (root) {
  'use strict';

  const chrome = root.ANOVATOR_GLOBAL_CHROME;
  const assets = 'assets/chrome-v04/';
  const reportRoutes = ['report', 'report-preview', 'delivery'];
  const enterRoutes = ['home', 'results'];
  const focusedPreparationTests = new Set([
    'body', 'bp', 'posture', 'grip',
    'vision', 'color', 'astigmatism', 'balance', 'agility', 'pushups', 'jump', 'rope',
  ]);
  const localDetailProject = { health: 'body', segments: 'body', 'posture-summary': 'posture' };
  const gripRetestLabel = /^Retest (left|right) hand$/;
  const copy = {
    'End session': 'End',
    'Exit session': 'Exit',
    'Measure separately': 'Test separately',
    'Start both tests': 'Start both',
    'Stop both tests': 'Stop both',
    Stopping: 'Stopping…',
    'Get ready again': 'Prepare again',
    'Make up test': 'Prepare',
    'Retest both eyes': 'Retest both',
    'Exit without collecting': 'Exit without a copy',
    'This session': 'My tests',
  };

  function labelFor(button, label, state) {
    const action = button.dataset.action;
    if (action === 'apply-plan') return 'Save plan';
    if (action === 'start-measure') return 'Start';
    if (action === 'posture-start-view') return 'Capture';
    if (action === 'posture-retake-view' || /^Retake (front|side) view$/.test(label)) return 'Retake';
    if (button.dataset.h10Slot === 'middle' && /^Capture (front|side) view$/.test(label)) return 'Capture';
    if (button.dataset.h10Slot === 'middle' && /^Measure (left|right) (forward|side) raise$/i.test(label)) return 'Make up';
    if (action === 'continue-eye' || (label === 'Continue' && button.dataset.payload?.includes('"continue-eye"'))) return 'Next eye';
    if (action === 'resume-pending') return 'Back to test';
    if (action === 'return-reading' && /Back to .* result$/.test(label)) return 'Back to result';
    if (action === 'resume-assessment' && label === 'Resume session') return 'Continue testing';
    if (state.route === 'end' && action === 'fill-test') return 'Resume test';
    if (action === 'fill-test' && label === 'Try again' && enterRoutes.includes(state.route)) return 'Prepare again';
    if (state.route === 'result/grip' && gripRetestLabel.test(label)) return label.replace(/ hand$/, '');
    if (action === 'retest' && /^Measure (left|right) (hand|forward raise|side raise)$/i.test(label)) {
      return 'Test ' + label.slice('Measure '.length).toLowerCase();
    }
    if (label === 'Restart' && action === 'retry') return 'Retry';
    return copy[label] || label;
  }

  function span(text, className) {
    const el = document.createElement('span');
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function glyph(name, size) {
    const holder = span('', 'gn-utility');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.setProperty('--gn-icon', size + 'px');
    holder.style.setProperty('--gn-icon-scale', String(size / 48));
    const img = document.createElement('img');
    img.src = assets + name + '.svg';
    img.alt = '';
    img.width = img.height = 48;
    holder.append(img);
    return holder;
  }

  function setForward(button, caption, target) {
    const words = span('', 'gn-forward-copy');
    const destination = document.createElement('strong');
    destination.textContent = target;
    words.append(span(caption, 'gn-action-caption'), destination);
    const disc = span('', 'gn-forward-disc');
    disc.append(glyph(caption === 'Back to' ? 'back' : 'next', 18));
    button.replaceChildren(words, disc);
    button.classList.remove('gn-primary');
    button.classList.add('gn-forward');
  }

  function shortenProjectName(target) {
    if (target?.textContent === 'Posture & dimensions') target.textContent = 'Posture';
  }

  function visibleLabel(button, label, state) {
    // The accessible name retains the object when the current view supplies it visually.
    if (label === 'Retest both eyes') return label;
    if (state.route === 'result/grip' && gripRetestLabel.test(label)) return label;
    if (/^Retake (front|side) view$/.test(label)) return label;
    if (/^Capture (front|side) view$/.test(label)) return label;
    if (button.dataset.h10Slot === 'middle' && /^Measure (left|right) (forward|side) raise$/i.test(label)) return label;
    if (button.dataset.action === 'start-measure' && state.route === 'prepare/grip') {
      const hand = JSON.parse(button.dataset.payload || '{}').view;
      if (hand === 'left' || hand === 'right') return 'Start ' + hand + '-hand grip test';
    }
    return '';
  }

  function setActionCopy(button, state) {
    if (button.classList.contains('result-return')) return;
    const original = button.getAttribute('aria-label') || button.textContent.trim();
    const caption = button.querySelector('.gn-action-caption');
    const target = button.querySelector('.gn-forward-copy strong');
    let label = labelFor(button, original, state);
    if (/^Retest(?: ·)? body composition$/i.test(original)) {
      setForward(button, 'Retest', 'Body composition');
      label = 'Retest · Body composition';
    } else if (caption && target) {
      if (target.textContent === 'Body composition & blood pressure' && state.route === 'group-result') {
        target.textContent = 'Both tests';
        label = caption.textContent + ' · Both tests (body composition and blood pressure)';
      }
      shortenProjectName(target);
    } else if (button.classList.contains('gn-stop')) {
      const stop = span('', 'gn-action-visual');
      stop.append(glyph('stop', 14), span(label));
      button.replaceChildren(stop);
    } else if (button.classList.contains('gn-primary')) {
      // The MO entry transition reads and clones this visual at Start.
      const visual = button.querySelector('.gn-action-visual') || span('', 'gn-action-visual');
      const icon = button.dataset.action === 'body-get-ready' ? visual.querySelector('.gn-utility') : null;
      visual.replaceChildren(...[icon, span(label)].filter(Boolean));
      button.replaceChildren(visual);
    } else if (button.classList.contains('gn-session')) {
      const icon = button.querySelector('.gn-utility') || glyph('end', 14);
      button.replaceChildren(icon, span(label));
    } else {
      const displayLabel = button.dataset.action === 'posture-finish-view'
        ? label.replace(/^Finish with /, 'Finish with\n')
        : label;
      button.replaceChildren(span(displayLabel));
    }
    button.setAttribute('aria-label', visibleLabel(button, original, state) || label);
  }

  function placeRow(row, state) {
    const buttons = Array.from(row.children).filter(el => el.matches('button'));
    if (!buttons.length) return;
    const active = button => button.dataset.action;
    const stop = buttons.find(b => b.classList.contains('gn-stop') || active(b) === 'retry-stop');
    if (stop) {
      stop.classList.remove('gn-primary');
      stop.classList.add('gn-stop');
    }
    const primary = buttons.find(b => b !== stop && b.matches('.gn-primary,.gn-forward')) ||
      (reportRoutes.includes(state.route) ? buttons.find(b => active(b) === 'finish-session') : null);
    const ending = buttons.find(b => b.matches('.gn-session') || active(b) === 'exit-session');
    if (ending) ending.classList.add('gn-session');
    const quiet = buttons.filter(b => b !== primary && b !== ending && b !== stop);
    const cancelRetest = !ending && state.mode === 'retest' && taskLayer(state) === 'prepare'
      ? quiet.findIndex(button => active(button) === 'skip') : -1;
    const left = ending || (cancelRetest >= 0 ? quiet.splice(cancelRetest, 1)[0] : null) ||
      (state.route === 'plan' || state.route === 'end' || reportRoutes.includes(state.route) ? quiet.shift() : null);
    const middle = stop || quiet.shift();
    const right = primary || quiet.shift();
    // Rare management combinations retain their ordinary flow layout.
    if (quiet.length || buttons.some(b => b !== left && b !== middle && b !== right)) return;
    row.classList.add('h10-row');
    if (left) left.dataset.h10Slot = ending ? 'session' : 'return';
    if (middle) middle.dataset.h10Slot = stop ? (right && !left ? 'stop-with-action' : 'stop') : 'middle';
    if (right) right.dataset.h10Slot = 'right';
    buttons.forEach(b => setActionCopy(b, state));
    if (right && !middle && (
      right.getAttribute('aria-label') === 'Exit without a copy' ||
      /^Test (left|right) (forward|side) raise$/.test(right.getAttribute('aria-label')) ||
      right.querySelector('.gn-forward-copy strong')?.textContent === 'Body composition & blood pressure'
    )) right.dataset.h10Slot = 'wide';
    row.append(...[left, middle, right].filter(Boolean));
  }

  function exitChoices(device, state) {
    if (state.route !== 'end') return;
    const main = device.querySelector('.device-main');
    const resume = main?.querySelector('button[data-action="fill-test"]');
    const exit = main?.querySelector('button[data-action="confirm-end"]');
    const slot = device.querySelector('.device-actions');
    if (!resume || !exit || !slot) return;
    const native = document.createElement('div');
    native.className = 'gn-task-native';
    const row = document.createElement('div');
    row.className = 'task-actions gn-action-row';
    for (const btn of [exit, resume]) {
      btn.setAttribute('aria-label', btn.textContent.trim());
      btn.classList.add('gn-action', btn === resume ? 'gn-primary' : 'gn-secondary');
      row.append(btn);
    }
    native.append(row);
    slot.replaceChildren(native);
    slot.hidden = false;
  }

  function paperActions(device, state) {
    if (!reportRoutes.includes(state.route)) return;
    const body = device.querySelector('.device-main');
    if (!body) return;
    const commands = {
      report: [['navigate', 'Preview report', 'preview'], ['delivery', 'Get report', 'main'], ['report-retry', 'Retry', 'main']],
      'report-preview': [['report-page', 'Previous', 'previous'], ['report-page', 'Next', 'next'], ['report-zoom', 'Zoom', 'zoom'], ['report', 'Back to report', 'back']],
      delivery: [['report', 'Back to report', 'return'], ['deliver', 'Print', 'print'], ['deliver', 'Show QR code', 'main']],
    }[state.route];
    let row;
    const previousRows = new Set();
    for (const [action, label, slot] of commands) {
      const button = Array.from(body.querySelectorAll('button[data-action="' + action + '"]')).find(el => {
        const data = JSON.parse(el.dataset.payload || '{}');
        if (action === 'navigate') return data.page === 'report-preview';
        if (action === 'report-page') return data.delta === (slot === 'previous' ? -1 : 1);
        if (action === 'deliver') return data.kind === (slot === 'print' ? 'print' : 'qr');
        return true;
      });
      if (!button) continue;
      const previousRow = button.closest('.wrap');
      row ||= previousRow;
      if (action === 'delivery' && /failed/.test(state.report?.stage || '')) {
        button.hidden = true;
        continue;
      }
      button.dataset.h10Paper = slot;
      button.textContent = label;
      button.setAttribute('aria-label', label);
      if (action === 'delivery' && button.disabled) button.title = 'Available after the report is saved';
      if (row) {
        if (previousRow && previousRow !== row) previousRows.add(previousRow);
        row.append(button);
      }
    }
    for (const previousRow of previousRows) {
      if (!previousRow.children.length && !previousRow.textContent.trim()) previousRow.remove();
    }
    row?.classList.add('h10-paper');
  }

  function updateNavigation(device, state) {
    const home = device.querySelector('.gn-overview-entry');
    const label = home?.querySelector('.gn-index-label');
    if (home && label) {
      home.setAttribute('aria-label', 'My tests');
      label.textContent = 'My tests';
      const img = home.querySelector('.gn-utility img');
      if (img) {
        img.src = 'review-assets/test-home-icons/my-tests-16.svg';
        img.classList.add('h10-home-glyph');
      }
    }
    if (enterRoutes.includes(state.route) && !state.homeProject) {
      const title = device.querySelector('.hub-title');
      if (title) title.textContent = 'My tests';
    }
  }

  function resultBrowser(state, rules) {
    const [layer, test] = state.route.split('/');
    return layer === 'result' && rules.allowed(state, test) && chrome.canOpenDirectory(state, rules);
  }

  function taskLayer(state) {
    const [layer, test] = state.route.split('/');
    if (['prepare', 'measure'].includes(layer) && focusedPreparationTests.has(test)) return layer;
    if (['prerequisites', 'recovery', 'stop'].includes(layer) && focusedPreparationTests.has(state.acq?.testId || state.pendingTest)) {
      return state.acq ? 'measure' : 'prepare';
    }
    return null;
  }

  function localResultDetail(state) {
    const project = localDetailProject[state.route];
    return !!state.user && state.consent && !state.selectedHistory && !state.privacyLocked && !!state.results[project];
  }

  function updatePositionInstruction(device, state) {
    if (!['prepare/vision', 'prepare/astigmatism'].includes(state.route)) return;
    if (!device.querySelector('.h10-row [data-action="start-measure"]')) return;
    for (const note of device.querySelectorAll('.device-main p')) {
      if (note.childNodes.length === 1 && /control to choose Ready\.$/.test(note.textContent)) {
        note.textContent = note.textContent.replace(/Ready\.$/, 'Start.');
      }
    }
  }

  const oxygenLabels = { 'Retry connection': 'Reconnect', 'Check device status': 'Check status' };
  function oxygen(screen, { retesting, canMakeReport }) {
    if (!screen.classList.contains('h10-oxygen')) {
      screen.classList.add('h10-oxygen');
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'footer-h10-oxygen.css';
      screen.getRootNode().append(css);
    }
    const readyEnd = screen.querySelector('#action-end-text');
    readyEnd.textContent = retesting ? 'Cancel retest' : canMakeReport ? 'End' : 'Exit';
    readyEnd.closest('button').toggleAttribute('data-h10-return', retesting);
    const resultEnd = screen.querySelector('#actions-result .action-end');
    if (resultEnd.dataset.action !== 'back') resultEnd.lastChild.nodeValue = canMakeReport ? 'End' : 'Exit';
    shortenProjectName(screen.querySelector('#actions-result .action-next strong'));
    const branch = screen.querySelector('#branch-actions');
    for (const button of branch.querySelectorAll('button')) {
      const rename = oxygenLabels[button.textContent];
      if (rename) button.textContent = rename;
      if (button.dataset.action === 'stop' && !button.querySelector('img')) {
        const img = document.createElement('img');
        img.src = assets + 'stop.svg';
        img.alt = '';
        button.prepend(img);
      }
    }
  }

  document.documentElement.classList.add('footer-h10');
  root.ANOVATOR_FOOTER_H10 = { oxygen };
  root.ANOVATOR_GLOBAL_CHROME = {
    ...chrome,
    resultBrowser,
    inlineResultLinks: true,
    taskLayer,
    localResultDetail,
    navigation(state, rules, button, previewId, direct) {
      if (localResultDetail(state) || (!direct && taskLayer(state))) return '';
      return chrome.navigation(state, rules, button, previewId, direct);
    },
    mount(state, rules) {
      chrome.mount(state, rules);
      const device = document.querySelector('.device');
      if (!device) return;
      updateNavigation(device, state);
      exitChoices(device, state);
      paperActions(device, state);
      const row = device.querySelector('.gn-action-row');
      if (row) {
        placeRow(row, state);
        updatePositionInstruction(device, state);
      }
    },
  };
})(window);
