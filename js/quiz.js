/**
 * quiz.js
 * Manages states for all four styles: Learning, Practice, Exam, and Challenge.
 */

class QuizEngine {
  constructor() {
    this.questions = [];
    this.currentIndex = 0;
    this.selectedAnswer = null;
    this.sessionAnswers = {}; // index: selected option letter
    this.mode = 'learning'; // learning, practice, exam, challenge
    this.timerInterval = null;
    this.timeElapsed = 0; // seconds
    this.streakBonus = 0;
    this.sectionId = 1;
    this.partId = 1;
  }

  initSession(questions, mode, secId, partId) {
    this.questions = [...questions];
    this.mode = mode;
    this.sectionId = secId;
    this.partId = partId;
    this.currentIndex = 0;
    this.selectedAnswer = null;
    this.sessionAnswers = {};
    this.timeElapsed = 0;
    this.streakBonus = 0;

    if (this.mode === 'exam' || this.mode === 'challenge') {
      this.shuffleQuestions();
    }
    this.startTimer();
  }

  shuffleQuestions() {
    for (let i = this.questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeElapsed++;
      ui.updateTimer(this.timeElapsed);
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getCurrentQuestion() {
    return this.questions[this.currentIndex];
  }

  selectOption(letter) {
    this.selectedAnswer = letter;
    this.sessionAnswers[this.currentIndex] = letter;
  }

  submitAnswer() {
    const q = this.getCurrentQuestion();
    const isCorrect = this.selectedAnswer === q.answer;
    
    // Track attempt locally
    storage.recordAnswer(q.id, isCorrect);

    if (isCorrect) {
      this.streakBonus++;
      let xpEarned = 10;
      if (this.streakBonus >= 3) xpEarned += 5; // combo bonus
      storage.addXP(xpEarned);
    } else {
      this.streakBonus = 0;
    }

    return isCorrect;
  }

  calculateSessionScore() {
    let correct = 0;
    this.questions.forEach((q, idx) => {
      if (this.sessionAnswers[idx] === q.answer) {
        correct++;
      }
    });

    const accuracy = Math.round((correct / this.questions.length) * 100);
    return {
      correct,
      total: this.questions.length,
      accuracy
    };
  }
}

window.QuizEngine = QuizEngine;
