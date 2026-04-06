// Currency & date formatting utilities

const Utils = {
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  },

  formatDateShort(date) {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  },

  formatMonth(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long'
    });
  },

  getMonthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  getCurrentMonthKey() {
    return this.getMonthKey(new Date());
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  parseAmount(str) {
    if (typeof str === 'number') return str;
    return parseFloat(String(str).replace(/[^0-9.\-]/g, '')) || 0;
  },

  clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  },

  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }
};
