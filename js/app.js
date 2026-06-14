/**
 * app.js
 * Root orchestrator routing sections, loading JSON databases, running revision models & global search.
 */

const SECTIONS = [
  { id: 1, subject: 'Islamic Studies', name: 'Islamic Studies ' },
  { id: 2, subject: 'Arabic', name: 'Arabic Language and Literature' },
  { id: 3, subject: 'Literature', name: 'English & Urdu Language and Literature' },
  { id: 4, subject: 'Social Sciences', name: 'Modern Subjects' },
  { id: 5, subject: 'Logical Reasoning', name: 'Aptitude & General Knowledge' }
];

class AppOrchestrator {
  constructor() {
    this.engine = new QuizEngine();
    this.allQuestions = []; // Combined repository of all fetched sections
    this.activeSectionId = 1;
  }

  async init() {
    this.setupEventListeners();
    await this.preloadAllData();
    
    // Check initial dark mode setup
    const profile = storage.getProfile();
    if (profile.settings.theme === 'dark') {
      document.body.className = 'theme-dark';
    } else {
      document.body.className = 'theme-light';
    }

    ui.renderProfileStats();
    this.updateDashboardAnalytics();
    
    // Default load Dashboard view
    ui.showView('view-dashboard');
  }

  // Preloads questions from all sections to support global search & analytics
  async preloadAllData() {
    const fetchPromises = [];
    for (let secId = 1; secId <= 5; secId++) {
      for (let partId = 1; partId <= 2; partId++) {
        const path = `sections/section${secId}_part${partId}.json`;
        fetchPromises.push(
          fetch(path)
            .then(res => {
              if (!res.ok) throw new Error('File not found');
              return res.json();
            })
            .then(data => {
              // Append tags
              const questions = data.map(q => ({
                ...q,
                sectionId: secId,
                partId: partId
              }));
              this.allQuestions.push(...questions);
            })
            .catch(e => {
              console.warn(`Error loading part: ${path}`, e);
            })
        );
      }
    }
    await Promise.all(fetchPromises);
    this.updateSectionOverviewPercentages();
  }

  updateSectionOverviewPercentages() {
    const profile = storage.getProfile();
    const progressMap = {};

    SECTIONS.forEach(sec => {
      const secQs = this.allQuestions.filter(q => q.sectionId === sec.id);
      const total = secQs.length || 1;
      let answered = 0;
      let correct = 0;

      secQs.forEach(q => {
        if (profile.completedQuestions[q.id]) {
          answered++;
          if (profile.completedQuestions[q.id].correct) correct++;
        }
      });

      const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      progressMap[sec.id] = { answered, total, accuracy };
    });

    ui.renderSections(SECTIONS, progressMap);
  }

  updateDashboardAnalytics() {
    const stats = analytics.calculateStats();
    document.getElementById('stat-total-q').textContent = stats.totalAnswers;
    document.getElementById('stat-accuracy').textContent = `${stats.accuracy}%`;
    document.getElementById('stat-correct').textContent = stats.correctCount;

    // Display Weak areas
    const list = document.getElementById('dashboard-weak-topics');
    if (list) {
      list.innerHTML = '';
      const weak = analytics.getWeakTopics(this.allQuestions);
      if (weak.length === 0) {
        list.innerHTML = '<li class="empty-list-msg">No weak areas identified yet. Start practicing!</li>';
      } else {
        weak.slice(0, 3).forEach(w => {
          const li = document.createElement('li');
          li.innerHTML = `<span>${w.topic}</span> <span>${w.errors} Incorrect Attempt(s)</span>`;
          list.appendChild(li);
        });
      }
    }
  }

  openSection(sectionId) {
    this.activeSectionId = sectionId;
    const sec = SECTIONS.find(s => s.id === sectionId);
    document.getElementById('selected-section-title').textContent = sec ? sec.subject : 'Arena Section';
    
    // Count questions for parts
    const p1Count = this.allQuestions.filter(q => q.sectionId === sectionId && q.partId === 1).length;
    const p2Count = this.allQuestions.filter(q => q.sectionId === sectionId && q.partId === 2).length;

    document.getElementById('part1-qcount').textContent = `${p1Count} Questions`;
    document.getElementById('part2-qcount').textContent = `${p2Count} Questions`;

    // Completion Status Indicators
    const profile = storage.getProfile();
    const p1Completed = this.allQuestions.filter(q => q.sectionId === sectionId && q.partId === 1 && profile.completedQuestions[q.id]);
    const p2Completed = this.allQuestions.filter(q => q.sectionId === sectionId && q.partId === 2 && profile.completedQuestions[q.id]);

    document.getElementById('part1-status').textContent = `Completed: ${p1Completed.length} / ${p1Count}`;
    document.getElementById('part2-status').textContent = `Completed: ${p2Completed.length} / ${p2Count}`;

    ui.showView('view-parts');
  }

  startQuiz(partId, mode) {
    const list = this.allQuestions.filter(q => q.sectionId === this.activeSectionId && q.partId === partId);
    if (list.length === 0) {
      alert("No questions found in this part folder. Please verify JSON uploads.");
      return;
    }
    
    this.engine.initSession(list, mode, this.activeSectionId, partId);
    
    // Update Meta views
    const sec = SECTIONS.find(s => s.id === this.activeSectionId);
    document.getElementById('quiz-meta-section').textContent = sec ? sec.subject : '';
    document.getElementById('quiz-meta-part').textContent = `Part ${partId}`;
    
    const modeBadge = document.getElementById('quiz-meta-mode');
    modeBadge.textContent = mode.toUpperCase() + ' MODE';
    modeBadge.className = `badge badge-mode btn-${mode}`;

    ui.showView('view-quiz');
    this.loadCurrentQuestion();
  }

  loadCurrentQuestion() {
    const q = this.engine.getCurrentQuestion();
    ui.renderQuestion(q, this.engine.mode, this.engine.currentIndex, this.engine.questions.length);

    // Setup action controls based on mode
    document.getElementById('quiz-submit-btn').style.display = 'none';
    
    // In practice/exam/challenge modes, the previous button can be toggled
    const prevBtn = document.getElementById('quiz-prev-btn');
    if (this.engine.currentIndex > 0 && (this.engine.mode === 'practice' || this.engine.mode === 'exam')) {
      prevBtn.style.display = 'block';
    } else {
      prevBtn.style.display = 'none';
    }
  }

  submitCurrentAnswer() {
    if (!this.engine.selectedAnswer) {
      alert("Please pick an option first.");
      return;
    }

    const isCorrect = this.engine.submitAnswer();
    
    if (isCorrect) {
      ui.playSuccessSound();
    } else {
      ui.playFailureSound();
    }

    if (this.engine.mode === 'learning') {
      // Immediately reveal rationales
      const q = this.engine.getCurrentQuestion();
      ui.showRationales(q, this.engine.selectedAnswer, q.answer);
      document.getElementById('quiz-submit-btn').style.display = 'none';
      document.getElementById('quiz-next-btn').style.display = 'block';
    } else {
      // In practice/exam, save and proceed without instant explanations
      this.nextQuestion();
    }
  }

  nextQuestion() {
    if (this.engine.currentIndex < this.engine.questions.length - 1) {
      this.engine.currentIndex++;
      this.engine.selectedAnswer = null;
      this.loadCurrentQuestion();
    } else {
      this.finishQuizSession();
    }
  }

  finishQuizSession() {
    this.engine.stopTimer();
    const score = this.engine.calculateSessionScore();
    
    // Trigger streak calculation daily
    storage.updateStreak();

    // Display report card
    document.getElementById('report-accuracy').textContent = `${score.accuracy}%`;
    document.getElementById('report-correct').textContent = `${score.correct} / ${score.total}`;
    
    // Format timer stats
    const mins = Math.floor(this.engine.timeElapsed / 60);
    const secs = this.engine.timeElapsed % 60;
    document.getElementById('report-time').textContent = 
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Calculate level ups and xp gains
    const earnedXP = score.correct * 10;
    document.getElementById('report-xp').textContent = `+${earnedXP} XP`;
    
    ui.renderProfileStats();
    this.updateDashboardAnalytics();
    this.updateSectionOverviewPercentages();

    // Fill wrong reviews
    const list = document.getElementById('report-mistakes-list');
    list.innerHTML = '';
    const mistakesSection = document.getElementById('report-mistakes-section');

    if (score.accuracy < 100 && this.engine.mode !== 'exam') {
      mistakesSection.style.display = 'block';
      this.engine.questions.forEach((q, idx) => {
        const userAns = this.engine.sessionAnswers[idx];
        if (userAns !== q.answer) {
          const card = document.createElement('div');
          card.className = 'explain-card';
          card.innerHTML = `
            <strong>Question ID: ${q.id}</strong>
            <p>${q.question}</p>
            <p class="text-danger">Your choice: Option ${userAns || 'No Answer'}</p>
            <p class="text-success">Correct answer: Option ${q.answer}</p>
            <p style="margin-top: 8px; font-style:italic;">Why: ${q.explanation.why_correct}</p>
          `;
          list.appendChild(card);
        }
      });
    } else {
      mistakesSection.style.display = 'none';
    }

    ui.showView('view-report');
  }

  // Revision packs execution
  startRevision(type) {
    const profile = storage.getProfile();
    let sublist = [];

    if (type === 'bookmarks') {
      sublist = this.allQuestions.filter(q => profile.bookmarks.includes(q.id));
    } else if (type === 'errors') {
      sublist = this.allQuestions.filter(q => profile.incorrectAttempts[q.id] > 0);
    } else if (type === 'difficult') {
      sublist = this.allQuestions.filter(q => profile.difficultMarks.includes(q.id));
    } else if (type === 'random') {
      sublist = [...this.allQuestions].sort(() => 0.5 - Math.random()).slice(0, 10);
    }

    if (sublist.length === 0) {
      alert("No questions found for this revision profile yet!");
      return;
    }

    this.activeSectionId = sublist[0].sectionId;
    this.engine.initSession(sublist, 'learning', sublist[0].sectionId, sublist[0].partId);
    
    document.getElementById('quiz-meta-section').textContent = 'Revision Pack';
    document.getElementById('quiz-meta-part').textContent = type.toUpperCase();
    
    ui.showView('view-quiz');
    this.loadCurrentQuestion();
  }

  // Global search input handling
  handleSearch(query) {
    const output = document.getElementById('search-results-output');
    if (!output) return;
    
    if (!query.trim()) {
      output.innerHTML = '<p class="empty-list-msg">Enter a keyword to start searching through sections.</p>';
      return;
    }

    const cleaned = query.toLowerCase();
    const results = this.allQuestions.filter(q => 
      q.id.toLowerCase().includes(cleaned) ||
      q.question.toLowerCase().includes(cleaned) ||
      (q.topic && q.topic.toLowerCase().includes(cleaned)) ||
      (q.explanation.vocabulary && q.explanation.vocabulary.word.toLowerCase().includes(cleaned)) ||
      (q.explanation.vocabulary && q.explanation.vocabulary.meaning.toLowerCase().includes(cleaned))
    );

    if (results.length === 0) {
      output.innerHTML = '<p class="empty-list-msg">No matching questions located. Try another word.</p>';
      return;
    }

    output.innerHTML = '';
    results.forEach(q => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      row.onclick = () => {
        // Load into interactive session in learning mode immediately
        this.activeSectionId = q.sectionId;
        this.engine.initSession([q], 'learning', q.sectionId, q.partId);
        document.getElementById('quiz-meta-section').textContent = 'Search Result';
        document.getElementById('quiz-meta-part').textContent = q.id;
        ui.showView('view-quiz');
        this.loadCurrentQuestion();
      };

      row.innerHTML = `
        <div class="section-meta">
          <span>ID: ${q.id}</span>
          <span>Topic: ${q.topic || 'General'}</span>
        </div>
        <h4>${q.question}</h4>
      `;
      output.appendChild(row);
    });
  }

  // Navigation Click listeners setup
  setupEventListeners() {
    document.getElementById('logo-btn').onclick = () => ui.showView('view-dashboard');
    document.getElementById('nav-home').onclick = () => {
      this.updateDashboardAnalytics();
      ui.showView('view-dashboard');
    };
    document.getElementById('nav-sections').onclick = () => ui.showView('view-sections');
    document.getElementById('nav-revision').onclick = () => {
      // Update revision counters dynamically
      const profile = storage.getProfile();
      document.getElementById('rev-count-bookmarks').textContent = `${profile.bookmarks.length} Questions Saved`;
      document.getElementById('rev-count-errors').textContent = `${Object.keys(profile.incorrectAttempts).length} Questions Saved`;
      document.getElementById('rev-count-difficult').textContent = `${profile.difficultMarks.length} Questions Saved`;
      ui.showView('view-revision');
    };
    document.getElementById('nav-search').onclick = () => ui.showView('view-search');
    document.getElementById('nav-settings').onclick = () => {
      const profile = storage.getProfile();
      document.getElementById('settings-audio-toggle').checked = profile.settings.audioEnabled;
      ui.showView('view-settings');
    };

    // Submits or goes next
    document.getElementById('quiz-submit-btn').onclick = () => this.submitCurrentAnswer();
    document.getElementById('quiz-next-btn').onclick = () => this.nextQuestion();
    document.getElementById('quiz-prev-btn').onclick = () => {
      if (this.engine.currentIndex > 0) {
        this.engine.currentIndex--;
        this.loadCurrentQuestion();
      }
    };
    document.getElementById('quiz-exit-btn').onclick = () => {
      if (confirm("Are you sure you want to exit this learning session? Progress for this run will not be finalized.")) {
        this.engine.stopTimer();
        ui.showView('view-sections');
      }
    };
    document.getElementById('report-home-btn').onclick = () => {
      this.updateDashboardAnalytics();
      ui.showView('view-dashboard');
    };
    document.getElementById('parts-back-btn').onclick = () => ui.showView('view-sections');

    // Theme Selector
    document.getElementById('theme-toggle-btn').onclick = () => {
      const profile = storage.getProfile();
      const current = document.body.className;
      if (current.includes('theme-dark')) {
        document.body.className = 'theme-light';
        profile.settings.theme = 'light';
      } else {
        document.body.className = 'theme-dark';
        profile.settings.theme = 'dark';
      }
      storage.saveProfile(profile);
    };

    // Search Query trigger
    document.getElementById('search-query-input').oninput = (e) => {
      this.handleSearch(e.target.value);
    };

    // Settings adjustments
    document.getElementById('settings-audio-toggle').onchange = (e) => {
      const profile = storage.getProfile();
      profile.settings.audioEnabled = e.target.checked;
      storage.saveProfile(profile);
    };

    // Reset button
    document.getElementById('settings-reset-btn').onclick = () => {
      if (confirm("🚨 WARNING: Are you completely sure you want to reset all your progress, XP, and bookmarks? This action is irreversible.")) {
        storage.resetProgress();
        ui.renderProfileStats();
        this.updateDashboardAnalytics();
        this.updateSectionOverviewPercentages();
        alert("Progress reset successful!");
        ui.showView('view-dashboard');
      }
    };

    // Profile Backup Export
    document.getElementById('settings-export-btn').onclick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(storage.getProfile(), null, 2));
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `dtse_arena_profile_${Date.now()}.json`);
      dlAnchorElem.click();
    };

    // Profile Backup Import
    const picker = document.getElementById('settings-file-picker');
    document.getElementById('settings-import-btn').onclick = () => picker.click();
    picker.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const profile = JSON.parse(event.target.result);
          if (profile.xp !== undefined && profile.completedQuestions) {
            storage.saveProfile(profile);
            ui.renderProfileStats();
            this.updateDashboardAnalytics();
            this.updateSectionOverviewPercentages();
            alert("Profile profile successfully synced!");
          } else {
            alert("Invalid profile file format detected.");
          }
        } catch (err) {
          alert("Error parsing JSON configuration.");
        }
      };
      reader.readAsText(file);
    };
  }
}

// Instantiate global app runner
window.app = new AppOrchestrator();
window.onload = () => app.init();
