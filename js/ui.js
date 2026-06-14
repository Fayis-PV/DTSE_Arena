/**
 * ui.js
 * Handles view routers, micro-interactions, dark mode triggers, and question renders.
 */

const ui = {
  // Navigation Routing
  showView(viewId) {
    document.querySelectorAll('.viewport-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    if (viewId === 'view-dashboard') document.getElementById('nav-home').classList.add('active');
    if (viewId === 'view-sections') document.getElementById('nav-sections').classList.add('active');
    if (viewId === 'view-revision') document.getElementById('nav-revision').classList.add('active');
    if (viewId === 'view-search') document.getElementById('nav-search').classList.add('active');
    if (viewId === 'view-settings') document.getElementById('nav-settings').classList.add('active');
  },

  // Updates User Profile Panels in Header
  renderProfileStats() {
    const profile = storage.getProfile();
    document.getElementById('header-streak').textContent = `${profile.streak} Days`;
    document.getElementById('header-xp').textContent = `${profile.xp} XP`;
    document.getElementById('header-level').textContent = `Lv ${profile.level}`;

    // Refresh Achievements on Dashboard
    const badgesContainer = document.getElementById('dashboard-badges');
    if (badgesContainer) {
      badgesContainer.innerHTML = '';
      ACHIEVEMENTS.forEach(ach => {
        const isUnlocked = profile.unlockedAchievements.includes(ach.id);
        const div = document.createElement('div');
        div.className = `mini-badge-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        div.textContent = ach.icon;
        div.title = `${ach.title}: ${ach.desc} (${isUnlocked ? 'Unlocked' : 'Locked'})`;
        badgesContainer.appendChild(div);
      });
    }
  },

  // Populates Subject Cards
  renderSections(sections, progressMap) {
    const container = document.getElementById('sections-container');
    if (!container) return;
    container.innerHTML = '';

    sections.forEach(sec => {
      const prog = progressMap[sec.id] || { answered: 0, total: 1, accuracy: 0 };
      const percent = Math.round((prog.answered / prog.total) * 100);

      const card = document.createElement('div');
      card.className = 'section-card';
      card.onclick = () => app.openSection(sec.id);
      
      card.innerHTML = `
        <div class="section-meta">
          <span>${sec.subject}</span>
          <span>${prog.answered}/${prog.total} Questions</span>
        </div>
        <h3>${sec.name}</h3>
        <div class="section-progress-track">
          <div class="section-progress-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="section-meta">
          <span>Accuracy: ${prog.accuracy}%</span>
          <span>Progress: ${percent}%</span>
        </div>
      `;
      container.appendChild(card);
    });
  },

  // Render question card inside quiz-arena
  renderQuestion(question, mode, currentIndex, totalQuestions) {
    const qBox = document.getElementById('question-text-box');
    const optBox = document.getElementById('options-box');
    const diffNode = document.getElementById('question-difficulty');
    
    diffNode.textContent = question.difficulty || 'Medium';

    // Clear and set question layout
    qBox.className = 'question-text-wrapper';
    
    // Automatically flag languages
    if (/[\u0600-\u06FF]/.test(question.question)) {
      qBox.classList.add('lang-arabic');
    } else if (/[\u0D00-\u0D7F]/.test(question.question)) {
      qBox.classList.add('lang-malayalam');
    }
    qBox.textContent = question.question;

    // Render Options
    optBox.innerHTML = '';
    const isArray = Array.isArray(question.options);
    const keys = isArray ? ['A', 'B', 'C', 'D'] : Object.keys(question.options);

    keys.forEach((key, idx) => {
      let text = isArray ? question.options[idx] : question.options[key];
      if (!text) return;

      // Clean prefix if array format already has "A)"
      text = text.replace(/^[A-D]\)\s*/i, '');

      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span class="option-letter">${key}</span> <span class="option-text">${text}</span>`;
      
      // Select logic
      btn.onclick = () => {
        if (document.getElementById('explanation-panel').style.display === 'block') {
          return; // Freeze answers once submitted
        }
        document.querySelectorAll('.option-btn').forEach(o => o.classList.remove('selected'));
        btn.classList.add('selected');
        app.engine.selectOption(key);
        
        // Immediately submit and show feedback for a smooth flow in all modes
        app.submitCurrentAnswer();
      };

      optBox.appendChild(btn);
    });

    // Bookmark Toggle State
    const bkmk = document.getElementById('bookmark-btn');
    const isBookmarked = storage.isBookmarked(question.id);
    bkmk.textContent = isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark';
    bkmk.onclick = () => {
      const added = storage.toggleBookmark(question.id);
      bkmk.textContent = added ? '⭐ Bookmarked' : '☆ Bookmark';
      ui.renderProfileStats();
    };

    // Update Progress
    const indexProgress = Math.round(((currentIndex + 1) / totalQuestions) * 100);
    document.getElementById('quiz-progress-fill').style.style = `width: ${indexProgress}%;`;
    document.getElementById('quiz-progress-fill').style.width = `${indexProgress}%`;
    document.getElementById('quiz-q-index').textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;

    // Hide explanations on initial render
    document.getElementById('explanation-panel').style.display = 'none';
    document.getElementById('quiz-next-btn').style.display = 'none';
  },

  // Display rationale content
  showRationales(question, selected, correctOption) {
    const panel = document.getElementById('explanation-panel');
    const status = document.getElementById('explain-status');
    const isCorrect = selected === correctOption;

    status.textContent = isCorrect ? 'Correct' : 'Incorrect';
    status.className = `explain-status-badge ${isCorrect ? 'correct' : 'incorrect'}`;

    const exp = question.explanation || {};
    document.getElementById('explain-why-correct').textContent = exp.why_correct || "The correct answer is Option " + correctOption + ".";
    
    // Highlight options
    document.querySelectorAll('.option-btn').forEach(btn => {
      const letter = btn.querySelector('.option-letter').textContent;
      if (letter === correctOption) {
        btn.classList.add('correct-glow');
      } else if (letter === selected && !isCorrect) {
        btn.classList.add('incorrect-glow');
      }
    });

    // Populate incorrect rationales
    const wrongList = document.getElementById('explain-why-wrong-list');
    wrongList.innerHTML = '';
    const whyWrongObj = exp.why_wrong || {};
    Object.keys(whyWrongObj).forEach(key => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>Option ${key}:</strong> ${whyWrongObj[key]}`;
      wrongList.appendChild(li);
    });

    // Fallback if empty
    if (wrongList.children.length === 0) {
      const li = document.createElement('li');
      li.textContent = "Evaluate why correct answer is option " + correctOption + ".";
      wrongList.appendChild(li);
    }

    document.getElementById('explain-concept').textContent = exp.concept_summary || "Review the general parameters related to this question.";
    document.getElementById('explain-exam-tips').textContent = exp.exam_tips || "Read questions carefully before responding.";
    document.getElementById('explain-memory-hack').textContent = exp.memory_hack || "No specific memory helper saved for this topic.";

    // Handle Smart Vocabulary Panel
    const vocabBox = document.getElementById('vocab-box-panel');
    if (exp.vocabulary) {
      vocabBox.style.display = 'block';
      const voc = exp.vocabulary;
      const typeTag = document.getElementById('vocab-type');
      const vContent = document.getElementById('vocab-content');
      vContent.innerHTML = '';

      if (voc.synonyms) {
        // English Vocabulary Schema
        typeTag.textContent = 'English Lexicon';
        vContent.innerHTML = `
          <div class="vocab-item"><span class="vocab-label">Word</span><span class="vocab-val">${voc.word}</span></div>
          <div class="vocab-item"><span class="vocab-label">Meaning</span><span class="vocab-val">${voc.meaning}</span></div>
          <div class="vocab-item"><span class="vocab-label">Synonyms</span><span class="vocab-val">${voc.synonyms.join(', ')}</span></div>
          <div class="vocab-item"><span class="vocab-label">Usage</span><span class="vocab-val">${voc.usage || ''}</span></div>
        `;
      } else {
        // Arabic Vocabulary Schema
        typeTag.textContent = 'Arabic Morphology';
        vContent.innerHTML = `
          <div class="vocab-item"><span class="vocab-label">Arabic Word</span><span class="vocab-val lang-arabic" style="font-size:1.2rem;">${voc.word}</span></div>
          <div class="vocab-item"><span class="vocab-label">Root (أصل)</span><span class="vocab-val">${voc.root || ''}</span></div>
          <div class="vocab-item"><span class="vocab-label">Grammar</span><span class="vocab-val">${voc.grammar || ''}</span></div>
          <div class="vocab-item"><span class="vocab-label">Usage</span><span class="vocab-val">${voc.usage || ''}</span></div>
        `;
      }
    } else {
      vocabBox.style.display = 'none';
    }

    panel.style.display = 'block';
  },

  updateTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('quiz-timer').textContent = 
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  // Success sound using Web Audio API to prevent external file dependencies
  playSuccessSound() {
    if (!storage.getProfile().settings.audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e){}
  },

  // Error sound
  playFailureSound() {
    if (!storage.getProfile().settings.audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch(e){}
  }
};

window.ui = ui;
