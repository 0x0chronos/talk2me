(function (root) {
  function rangeBounds(value, size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
    if (!match || (!match[1] && !match[2])) return null;
    let start, end = size-1;
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
      start = Math.max(0,size-suffix);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]),end);
    }
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? [start,end] : null;
  }
  root.rangeBounds = rangeBounds;
  if (typeof module !== 'undefined' && module.exports) module.exports = rangeBounds;
})(globalThis);
