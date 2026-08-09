export const SILENCE_DURATIONS = {
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  forever: null,
} as const;

export type SilenceDurationKey = keyof typeof SILENCE_DURATIONS;

export const SILENCE_DURATION_LABELS: Record<SilenceDurationKey, string> = {
  '30m': '30 минут',
  '1h': '1 час',
  '8h': '8 часов',
  '24h': '24 часа',
  forever: 'постоянно',
};

export type SilenceDurationPreset = {
  minutes: number | null;
  label?: string;
};

export const DEFAULT_DURATION_PRESETS: SilenceDurationPreset[] = [
  { minutes: 30 },
  { minutes: 60 },
  { minutes: 480 },
  { minutes: 1440 },
  { minutes: null, label: 'постоянно' },
];

const MIN_CUSTOM_MINUTES = 1;
const MAX_CUSTOM_MINUTES = 60 * 24 * 30;

export function formatMinutesLabel(minutes: number): string {
  if (minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return days === 1 ? '1 день' : `${days} дн.`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 час' : `${hours} ч.`;
  }

  return `${minutes} мин.`;
}

export function getPresetLabel(preset: SilenceDurationPreset): string {
  if (preset.label?.trim()) {
    return preset.label.trim();
  }

  if (preset.minutes === null) {
    return 'постоянно';
  }

  return formatMinutesLabel(preset.minutes);
}

export function normalizeDurationPresets(
  presets: SilenceDurationPreset[] | null | undefined,
): SilenceDurationPreset[] {
  if (!presets?.length) {
    return DEFAULT_DURATION_PRESETS.map((preset) => ({ ...preset }));
  }

  const normalized: SilenceDurationPreset[] = [];

  for (const preset of presets) {
    if (preset.minutes === null) {
      normalized.push({
        minutes: null,
        label: preset.label?.trim() || 'постоянно',
      });
      continue;
    }

    if (
      !Number.isInteger(preset.minutes) ||
      preset.minutes < MIN_CUSTOM_MINUTES ||
      preset.minutes > MAX_CUSTOM_MINUTES
    ) {
      continue;
    }

    normalized.push({
      minutes: preset.minutes,
      label: preset.label?.trim() || undefined,
    });
  }

  return normalized.length > 0
    ? normalized
    : DEFAULT_DURATION_PRESETS.map((preset) => ({ ...preset }));
}

export function parseCustomDurationInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const foreverMatch = /^(forever|постоянно|∞)$/.test(trimmed);
  if (foreverMatch) return null;

  const minutesOnly = /^(\d+)\s*(m|min|мин|минут|минуты|minute|minutes)?$/.exec(trimmed);
  if (minutesOnly) {
    const minutes = Number(minutesOnly[1]);
    return isValidMinutes(minutes) ? minutes : null;
  }

  const hoursMatch = /^(\d+)\s*(h|ч|час|часа|часов|hour|hours)$/.exec(trimmed);
  if (hoursMatch) {
    const minutes = Number(hoursMatch[1]) * 60;
    return isValidMinutes(minutes) ? minutes : null;
  }

  const daysMatch = /^(\d+)\s*(d|д|день|дня|дней|day|days)$/.exec(trimmed);
  if (daysMatch) {
    const minutes = Number(daysMatch[1]) * 60 * 24;
    return isValidMinutes(minutes) ? minutes : null;
  }

  return null;
}

function isValidMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= MIN_CUSTOM_MINUTES &&
    minutes <= MAX_CUSTOM_MINUTES
  );
}

export const CUSTOM_DURATION_HINT =
  'Введите длительность: 45, 90m, 2h, 1d или «постоянно».';
