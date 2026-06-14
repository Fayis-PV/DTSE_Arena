/**
 * storage.js
 * LocalStorage wrapper managing student progress, bookmarks, stats, level scaling, and daily streaks.
 */

const DTSE_STORAGE_KEY = 'dtse_arena_profile';

const INITIAL_PROFILE = {
  xp: 0,
  level: 1,
  streak: 0,
  lastActive: null,
  bookmarks: [], // array of question IDs
  completedQuestions: {}, // ID: { timestamp, correct }
  incorrectAttempts: {}, // ID: count
  difficultMarks: [], // array of question IDs
  settings: {
    audioEnabled: true,
    theme: 'light'
  },
  unlockedAchievements: []
};

const ACHIEVEMENTS = [
  { id: 'first_100', title: 'First Steps', desc: 'Answered your first question', icon: '🐣', xp: 50 },
  { id: 'sec_master', title: 'Section Master', desc: 'Achieved 100% accuracy on any part', icon: '🧠', xp: 150 },
  { id: 'streak_7', title: '7-Day Streak', desc: 'Studied for 7 consecutive days', icon: '🔥', xp: 200 },
  { id: 'vocab_hero', title: 'Vocabulary Hero', desc: 'Correctly answered 10 vocab-linked questions', icon: '📖', xp: 100 },
  { id: 'exam_champ', title: 'Exam Champion', desc: 'Scored above 80% on Exam Mode', icon: '🏆', xp: 250 }
];

const storage = {
  getProfile() {
    let raw = localStorage.getItem(DTSE_STORAGE_KEY);
    if (!raw) {
      this.saveProfile(INITIAL_PROFILE);
      return INITIAL_PROFILE;
    }
    try {
      // Merge with initial just in case structure expands
      return { ...INITIAL_PROFILE, ...JSON.parse(raw) };
    } catch (e) {
      return INITIAL_PROFILE;
    }
  },

  saveProfile(profile) {
    localStorage.setItem(DTSE_STORAGE_KEY, JSON.stringify(profile));
  },

  updateStreak() {
    const profile = this.getProfile();
    const now = new Date();
    const todayStr = now.toDateString();
    
    if (profile.lastActive) {
      const lastDate = new Date(profile.lastActive);
      const diffTime = Math.abs(now - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Active consecutive day
        profile.streak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        profile.streak = 1;
      }
    } else {
      profile.streak = 1;
    }
    
    profile.lastActive = now.getTime();
    this.saveProfile(profile);
  },

  addXP(amount) {
    const profile = this.getProfile();
    profile.xp += amount;
    
    // Scale Level: Level calculated as floor(sqrt(XP / 100)) + 1
    const newLevel = Math.floor(Math.sqrt(profile.xp / 100)) + 1;
    let leveledUp = false;
    if (newLevel > profile.level) {
      profile.level = newLevel;
      leveledUp = true;
    }
    this.saveProfile(profile);
    return { level: profile.level, leveledUp };
  },

  toggleBookmark(questionId) {
    const profile = this.getProfile();
    const index = profile.bookmarks.indexOf(questionId);
    let bookmarked = false;
    if (index === -1) {
      profile.bookmarks.push(questionId);
      bookmarked = true;
    } else {
      profile.bookmarks.splice(index, 1);
    }
    this.saveProfile(profile);
    return bookmarked;
  },

  isBookmarked(questionId) {
    const profile = this.getProfile();
    return profile.bookmarks.includes(questionId);
  },

  toggleDifficult(questionId) {
    const profile = this.getProfile();
    const index = profile.difficultMarks.indexOf(questionId);
    let isDifficult = false;
    if (index === -1) {
      profile.difficultMarks.push(questionId);
      isDifficult = true;
    } else {
      profile.difficultMarks.splice(index, 1);
    }
    this.saveProfile(profile);
    return isDifficult;
  },

  isDifficult(questionId) {
    return this.getProfile().difficultMarks.includes(questionId);
  },

  recordAnswer(questionId, isCorrect) {
    const profile = this.getProfile();
    
    // Track attempt
    profile.completedQuestions[questionId] = {
      timestamp: Date.now(),
      correct: isCorrect
    };

    if (!isCorrect) {
      profile.incorrectAttempts[questionId] = (profile.incorrectAttempts[questionId] || 0) + 1;
      // Auto tag difficult if failed repeatedly
      if (profile.incorrectAttempts[questionId] >= 2 && !profile.difficultMarks.includes(questionId)) {
        profile.difficultMarks.push(questionId);
      }
    }
    
    this.saveProfile(profile);
    this.checkAchievements();
  },

  checkAchievements() {
    const profile = this.getProfile();
    const newlyUnlocked = [];
    
    const answeredCount = Object.keys(profile.completedQuestions).length;
    
    // Achieve: First Steps
    if (answeredCount >= 1 && !profile.unlockedAchievements.includes('first_100')) {
      newlyUnlocked.push('first_100');
    }
    
    // Achieve: 7-Day Streak
    if (profile.streak >= 7 && !profile.unlockedAchievements.includes('streak_7')) {
      newlyUnlocked.push('streak_7');
    }

    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach(id => {
        profile.unlockedAchievements.push(id);
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) profile.xp += ach.xp;
      });
      this.saveProfile(profile);
    }
    
    return newlyUnlocked;
  },

  resetProgress() {
    this.saveProfile(INITIAL_PROFILE);
  }
};

window.storage = storage;
window.ACHIEVEMENTS = ACHIEVEMENTS;
