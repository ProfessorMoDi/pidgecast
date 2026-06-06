"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildFallbackWeather, fetchWeather } from "@/lib/weather";
import type { Opco, WeatherState } from "@/lib/types";

const INITIAL: WeatherState = {
  days: [],
  hours: [],
  isLoading: true,
  isFallback: false,
  error: null,
  lastUpdated: null,
};

/**
 * Fetches live weather from Open-Meteo for the given opco, client-side.
 * Falls back to synthetic weather if the request fails so the demo always
 * renders. Re-fetches when the opco changes.
 */
export function useWeather(opco: Opco): WeatherState & { refetch: () => void } {
  const [state, setState] = useState<WeatherState>(INITIAL);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const { days, hours } = await fetchWeather(opco);
      if (id !== requestId.current) return; // superseded
      setState({
        days,
        hours,
        isLoading: false,
        isFallback: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      if (id !== requestId.current) return;
      const message =
        err instanceof Error ? err.message : "Unknown weather fetch error";
      const { days, hours } = buildFallbackWeather(opco);
      setState({
        days,
        hours,
        isLoading: false,
        isFallback: true,
        error: message,
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [opco]);

  useEffect(() => {
    // Fetching live weather is exactly the external-system synchronisation an
    // effect is for. The brief synchronous loading flag inside load() is
    // intentional (drives the skeleton), so opt out of the cascading-render
    // heuristic for this standard fetch-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { ...state, refetch: load };
}
