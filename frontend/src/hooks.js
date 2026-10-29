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
    if (!deadlineAt) {
      setRemaining(0);
      return;
    }

    const deadline = new Date(deadlineAt).getTime();
    if (isNaN(deadline)) {
      setRemaining(0);
      return;
    }

    // Accurately calibrate clock skew between client Date.now() and server timestamp
    const serverTimestamp = serverTime ? new Date(serverTime).getTime() : NaN;
    const clientNow = Date.now();
    const clockOffset = !isNaN(serverTimestamp) ? clientNow - serverTimestamp : 0;

    let intervalId = null;

    const tick = () => {
      const nowEstimatedServer = Date.now() - clockOffset;
      const diff = Math.max(0, deadline - nowEstimatedServer);
      setRemaining(diff);
      if (diff <= 0 && intervalId) {
        clearInterval(intervalId);
      }
    };

    tick();
    // 50ms interval ensures ultra-smooth circle drain and millisecond-accurate display
    intervalId = setInterval(tick, 50);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [deadlineAt, serverTime]);

  return remaining;
}
