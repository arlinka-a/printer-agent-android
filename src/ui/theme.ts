import { StyleSheet, useColorScheme } from 'react-native';

const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  inputBg: '#F9FAFB',
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  primarySoft: '#EFF4FF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  warn: '#B45309',
  warnSoft: '#FEF3C7',
  neutralSoft: '#F3F4F6',
  statusBar: 'dark-content' as 'dark-content' | 'light-content',
};

const dark: typeof light = {
  bg: '#0F1115',
  card: '#1A1D23',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  border: '#2A2F38',
  inputBg: '#14171C',
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  primarySoft: '#1B2740',
  success: '#4ADE80',
  successSoft: '#13301F',
  danger: '#F87171',
  dangerSoft: '#3A1A1A',
  warn: '#FBBF24',
  warnSoft: '#3A2E12',
  neutralSoft: '#22262E',
  statusBar: 'light-content',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 16 };

export const s = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 16, gap: 12, borderWidth: 1 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  btnText: { fontSize: 15, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  hint: { fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  notice: { borderRadius: radius.sm, padding: 12 },
  noticeText: { fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});