import type { ForecastSummary } from "@/lib/forecast";
import type {
  BillingAnomaly,
  ForecastWeek,
  Opco,
  ProjectMilestone,
  Scenario,
  WeatherDay,
  WeatherHour,
} from "@/lib/types";

/**
 * Everything a role view needs to render. Computed once in the dashboard
 * shell and passed down, so views stay presentational.
 */
export interface DashboardViewModel {
  opco: Opco;
  scenario: Scenario;
  weeks: ForecastWeek[];
  summary: ForecastSummary;
  /** Per-scenario summaries for comparison / downside cards. */
  scenarioSummaries: Record<Scenario, ForecastSummary>;
  scenarioWeeks: Record<Scenario, ForecastWeek[]>;
  weatherDays: WeatherDay[];
  weatherHours: WeatherHour[];
  isFallbackWeather: boolean;
  projects: ProjectMilestone[];
  anomalies: BillingAnomaly[];
}
