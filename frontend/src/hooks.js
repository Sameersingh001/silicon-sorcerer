import { useEffect, useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), duration);
  }, []);
  return { toast, showToast };
}

export function useCountdown(deadlineAt, serverTime) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadlineAt) { setRemaining(0); return; }
    const deadline = new Date(deadlineAt).getTime();
    const offset = serverTime ? Date.now() - serverTime : 0;

    const tick = () => {
      const now = Date.now() - offset;
      const diff = Math.max(0, deadline - now);
      setRemaining(diff);
      if (diff <= 0) clearInterval(interval);
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadlineAt, serverTime]);

  return remaining;
}
