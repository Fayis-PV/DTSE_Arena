/**
 * analytics.js
 * Computes user metrics, errors, average speeds, and identifies areas needing reinforcement.
 */

const analytics = {
  calculateStats() {
    const profile = storage.getProfile();
    const completed = profile.completedQuestions;
    const ids = Object.keys(completed);
    const total = ids.length;
    
    if (total === 0) {
      return {
        totalAnswers: 0,
        accuracy: 0,
        correctCount: 0
      };
    }

    let correctCount = 0;
    ids.forEach(id => {
      if (completed[id].correct) correctCount++;
    });

    const accuracy = Math.round((correctCount / total) * 100);

    return {
      totalAnswers: total,
      accuracy: accuracy,
      correctCount: correctCount
    };
  },

  /**
   * Scans incorrect answers and lists weak topics based on cumulative questions
   * @param {Array} allQuestions - All loaded questions context
   */
  getWeakTopics(allQuestions) {
    const profile = storage.getProfile();
    const errors = profile.incorrectAttempts;
    
    const topicErrorScores = {};
    
    Object.keys(errors).forEach(qId => {
      const q = allQuestions.find(x => x.id === qId);
      if (q) {
        const errorWeight = errors[qId];
        topicErrorScores[q.topic] = (topicErrorScores[q.topic] || 0) + errorWeight;
      }
    });

    // Sort topics descending by error counts
    return Object.keys(topicErrorScores)
      .map(topic => ({
        topic: topic,
        errors: topicErrorScores[topic]
      }))
      .sort((a, b) => b.errors - a.errors);
  }
};

window.analytics = analytics;
