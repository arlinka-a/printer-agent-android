import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { StaticIpStatus } from '../types';
import { s, Theme, useTheme } from './theme';

export type Tone = 'success' | 'danger' | 'warn' | 'neutral' | 'info';

const toneColors = (theme: Theme, tone: Tone) => {
  switch (tone) {
    case 'success':
      return { fg: theme.success, bg: theme.successSoft };
    case 'danger':
      return { fg: theme.danger, bg: theme.dangerSoft };
    case 'warn':
      return { fg: theme.warn, bg: theme.warnSoft };
    case 'info':
      return { fg: theme.primary, bg: theme.primarySoft };
    default:
      return { fg: theme.textMuted, bg: theme.neutralSoft };
  }
}

type CardProps = { children: React.ReactNode; style?: StyleProp<ViewStyle> }
export const Card = ({ children, style }: CardProps) => {
  const theme = useTheme();
  return <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>;
}

type SectionTitleProps = { title: string; right?: React.ReactNode }
export const SectionTitle = ({ title, right }: SectionTitleProps) => {
  const theme = useTheme();
  return (
    <View style={s.spread}>
      <Text style={[s.sectionTitle, { color: theme.text }]}>{title}</Text>
      {right}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}
export const Button = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) => {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : variant === 'secondary' ? theme.primarySoft : 'transparent';
  const fg = variant === 'primary' ? theme.primaryText : theme.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg },
        disabled ? s.disabled : pressed && s.pressed,
        style,
      ]}>
      {loading && <ActivityIndicator size="small" color={fg} />}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** `ltr` keeps Latin-only values (URLs, keys, IPs) left-aligned inside the RTL layout. */
type FieldProps = TextInputProps & { label?: string; hint?: string; ltr?: boolean }
export const Field = ({
  label,
  hint,
  ltr,
  style,
  ...input
}: FieldProps) => {
  const theme = useTheme();
  return (
    <View style={s.field}>
      {!!label && <Text style={[s.label, { color: theme.text }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        {...input}
        style={[s.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }, ltr && s.ltr, style]}
      />
      {!!hint && <Text style={[s.hint, { color: theme.textMuted }]}>{hint}</Text>}
    </View>
  );
}

type PillProps = { label: string; tone?: Tone }
export const Pill = ({ label, tone = 'neutral' }: PillProps) => {
  const color = toneColors(useTheme(), tone);
  return (
    <View style={[s.pill, { backgroundColor: color.bg }]}>
      <Text style={[s.pillText, { color: color.fg }]}>{label}</Text>
    </View>
  );
}

const staticIpTags: Record<StaticIpStatus, PillProps> = {
  unchecked: { label: 'לא קבוע', tone: 'neutral' },
  notPinned: { label: 'לא קבוע', tone: 'danger' },
  pinned: { label: 'קבוע', tone: 'success' },
};

export const StaticIpTag = ({ status }: { status: StaticIpStatus }) => <Pill {...staticIpTags[status]} />;

type NoticeProps = { text: string; tone?: Tone }
export const Notice = ({ text, tone = 'info' }: NoticeProps) => {
  const color = toneColors(useTheme(), tone);
  return (
    <View style={[s.notice, { backgroundColor: color.bg }]}>
      <Text style={[s.noticeText, { color: color.fg }]}>{text}</Text>
    </View>
  );
}

export const Dot = ({ tone }: { tone: Tone }) => {
  return <View style={[s.dot, { backgroundColor: toneColors(useTheme(), tone).fg }]} />;
}

