// ==========================================
// TODAVÍA HAY
// SONIDO CORTO PARA AVISOS
// ==========================================
//
// Un "ding" con Web Audio (sin archivos).
// Algunos navegadores bloquean el sonido
// hasta que la persona toca la pantalla una
// vez; en ese caso simplemente no suena.
// ==========================================

let ctx: AudioContext | null = null;

export function beep(times = 2) {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    for (let i = 0; i < times; i++) {
      const start = ctx.currentTime + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    }
  } catch {
    // Sin sonido no pasa nada: la pantalla igual se actualiza.
  }
}
