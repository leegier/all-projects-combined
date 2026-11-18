// Save / load to localStorage (the CLAWED SaveSystem, JSON slot).
const KEY = 'nyghtshade-hollow.intake.v2';
export const Save = {
  has() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
  write(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
  read() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};
