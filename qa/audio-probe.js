// Browser-only QA instrumentation. This file is not deployed.
// Samples the actual Web Audio output without altering the player's gain.
(() => {
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeAudioContext) return;
  const contexts = [];
  window.__audioAudit = () => contexts.map(({ context, analyser }) => {
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return {
      state: context.state,
      time: context.currentTime,
      peak: Math.max(...samples.map(Math.abs)),
      rms: Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length),
    };
  });
  const originalConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destination, ...args) {
    const item = contexts.find(({ context }) => destination === context.destination);
    if (item && this !== item.analyser) originalConnect.call(this, item.analyser);
    return originalConnect.call(this, destination, ...args);
  };
  class ProbedAudioContext extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      const analyser = this.createAnalyser();
      analyser.fftSize = 2048;
      contexts.push({ context: this, analyser });
    }
  }
  window.AudioContext = ProbedAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = ProbedAudioContext;
})();
