import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AgentStatus } from '../agent/agent';
import { he, ltr } from '../i18n/he';
import { AgentConfig } from '../types';
import { Button, Card, Dot, Pill, SectionTitle } from '../ui/components';
import { radius, useTheme } from '../ui/theme';

interface Props {
  config: AgentConfig;
  status: AgentStatus | null;
  log: string[];
  canStart: boolean;
  onToggleAgent: () => void;
  onOpenSettings: () => void;
}

const VISIBLE_LOG_LINES = 20;

function hostOf(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function Dashboard({ config, status, log, canStart, onToggleAgent, onOpenSettings }: Props) {
  const t = useTheme();
  const running = !!status?.running;
  const healthy = running && !!status?.backendConnected;

  const headline = !running ? he.dashboard.stopped : healthy ? he.dashboard.running : he.dashboard.connecting;
  const tone = !running ? 'neutral' : healthy ? 'success' : 'warn';
  const muted = { color: t.textMuted };

  return (
    <ScrollView contentContainerStyle={s.body}>
      <View style={s.spread}>
        <View style={s.shrink}>
          <Text style={[s.title, { color: t.text }]}>{he.dashboard.title}</Text>
          <Text style={[s.small, muted]} numberOfLines={1}>
            {config.tenantId} · {ltr(hostOf(config.baseUrl))}
          </Text>
        </View>
        <Button label={he.dashboard.settings} variant="ghost" onPress={onOpenSettings} style={s.compactBtn} />
      </View>

      <Card>
        <View style={s.row}>
          <Dot tone={tone} />
          <Text style={[s.headline, { color: t.text }]}>{headline}</Text>
        </View>
        {status?.running && (
          <Text style={[s.body14, muted]}>
            {status.backendConnected ? he.dashboard.serverConnected : he.dashboard.serverNotConnected} ·{' '}
            {status.sseHealthy ? he.dashboard.liveOn : he.dashboard.liveOff}
          </Text>
        )}
        {status?.running && !!status.lastError && (
          <Text style={[s.small, { color: t.danger }]}>{status.lastError}</Text>
        )}
        <View style={s.stats}>
          <Stat label={he.dashboard.printed} value={status?.printed ?? 0} />
          <Stat label={he.dashboard.failed} value={status?.failed ?? 0} danger={!!status?.failed} />
        </View>
        <Button label={running ? he.dashboard.stop : he.dashboard.start} variant={running ? 'secondary' : 'primary'}
          onPress={onToggleAgent} disabled={!running && !canStart} />
      </Card>

      <Card>
        <SectionTitle title={he.dashboard.printers} right={<Text style={muted}>{config.printers.length}</Text>} />
        {config.printers.map((p, i) => (
          <View key={p.ip} style={[s.spread, i > 0 && [s.divided, { borderTopColor: t.border }]]}>
            <View>
              <Text style={[s.printerName, { color: t.text }]}>{p.name}</Text>
              <Text style={[s.small, muted]}>{ltr(`${p.ip}:${p.port}`)}</Text>
            </View>
            <Pill label={p.staticIpConfirmed ? he.common.verified : he.common.notVerified} tone={p.staticIpConfirmed ? 'success' : 'warn'} />
          </View>
        ))}
        {!config.printers.length && <Text style={muted}>{he.dashboard.noPrinters}</Text>}
      </Card>

      <Card>
        <SectionTitle title={he.dashboard.activity} />
        {log.length ? (
          log.slice(0, VISIBLE_LOG_LINES).map((line, i) => <Text key={i} style={[s.logLine, muted]}>{line}</Text>)
        ) : (
          <Text style={muted}>{he.dashboard.noActivity}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.stat, { backgroundColor: t.neutralSoft }]}>
      <Text style={[s.statValue, { color: danger ? t.danger : t.text }]}>{value}</Text>
      <Text style={[s.small, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shrink: { flexShrink: 1 },
  title: { fontSize: 24, fontWeight: '700' },
  small: { fontSize: 13 },
  body14: { fontSize: 14 },
  compactBtn: { paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { fontSize: 20, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, borderRadius: radius.md, padding: 12 },
  statValue: { fontSize: 22, fontWeight: '700' },
  printerName: { fontSize: 15, fontWeight: '500' },
  divided: { paddingTop: 12, borderTopWidth: 1 },
  logLine: { fontSize: 13, fontFamily: 'monospace' },
});
