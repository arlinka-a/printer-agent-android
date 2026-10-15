import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AgentStatus } from '../agent/agent';
import { ltr } from '../utils/he';
import { AgentConfig } from '../types';
import { Button, Card, Dot, Pill, SectionTitle } from '../ui/components';
import { dashboardStyle, useTheme } from '../ui/theme';
import { isEmpty } from 'lodash';

type Props = {
  config: AgentConfig;
  status: AgentStatus | null;
  log: string[];
  canStart: boolean;
  onToggleAgent: () => void;
  onOpenSettings: () => void;
}

const VISIBLE_LOG_LINES = 20;

const hostOf = (url: string) => {
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export const Dashboard = ({ config, status, log, canStart, onToggleAgent, onOpenSettings }: Props) => {
  const theme = useTheme();
  const isRunning = !!status?.running;
  const isHealthy = isRunning && !!status?.backendConnected;

  const headline = !isRunning ? 'כבוי' : isHealthy ? 'פועל' : 'מתחבר…';
  const tone = !isRunning ? 'neutral' : isHealthy ? 'success' : 'warn';
  const muted = { color: theme.textMuted };

  return (
    <ScrollView contentContainerStyle={dashboardStyle.body}>
      <View style={dashboardStyle.spread}>
        <View style={dashboardStyle.shrink}>
          <Text style={[dashboardStyle.title, { color: theme.text }]}>{'סוכן הדפסה'}</Text>
          <Text style={[dashboardStyle.small, muted]} numberOfLines={1}>
            {config.tenantId} · {ltr(hostOf(config.baseUrl))}
          </Text>
        </View>
        <Button label={'הגדרות'} variant="ghost" onPress={onOpenSettings} style={dashboardStyle.compactBtn} />
      </View>

      <Card>
        <View style={dashboardStyle.row}>
          <Dot tone={tone} />
          <Text style={[dashboardStyle.headline, { color: theme.text }]}>{headline}</Text>
        </View>
        {status?.running && (
          <Text style={[dashboardStyle.body14, muted]}>
            {status.backendConnected ? 'מחובר לשרת' : 'לא מחובר לשרת'} ·{' '}
            {status.sseHealthy ? 'עדכונים חיים פעילים' : 'עדכונים חיים כבויים'}
          </Text>
        )}
        {status?.running && !!status.lastError && (
          <Text style={[dashboardStyle.small, { color: theme.danger }]}>{status.lastError}</Text>
        )}
        <View style={dashboardStyle.stats}>
          <Stat label={'הודפסו'} value={status?.printed ?? 0} />
          <Stat label={'נכשלו'} value={status?.failed ?? 0} danger={!!status?.failed} />
        </View>
        <Button label={isRunning ? 'עצירת הסוכן' : 'הפעלת הסוכן'} variant={isRunning ? 'secondary' : 'primary'}
          onPress={onToggleAgent} disabled={!isRunning && !canStart} />
      </Card>

      <Card>
        <SectionTitle title={'מדפסות'} right={<Text style={muted}>{config.printers.length}</Text>} />
        {config.printers.map((printer, i) => (
          <View key={printer.ip} style={[dashboardStyle.spread, i > 0 && [dashboardStyle.divided, { borderTopColor: theme.border }]]}>
            <View>
              <Text style={[dashboardStyle.printerName, { color: theme.text }]}>{printer.name}</Text>
              <Text style={[dashboardStyle.small, muted]}>
                {printer.model ? `${ltr(printer.model)} · ` : ''}{ltr(`${printer.ip}:${printer.port}`)}
              </Text>
            </View>
            <Pill label={printer.staticIpConfirmed ? 'אומתה' : 'לא אומתה'} tone={printer.staticIpConfirmed ? 'success' : 'warn'} />
          </View>
        ))}
        {isEmpty(config.printers) && <Text style={muted}>{'לא הוגדרו מדפסות.'}</Text>}
      </Card>

      <Card>
        <SectionTitle title={'פעילות'} />
        {log.length ? (
          log.slice(0, VISIBLE_LOG_LINES).map((line, i) => <Text key={i} style={[dashboardStyle.logLine, muted]}>{line}</Text>)
        ) : (
          <Text style={muted}>{'אין פעילות עדיין.'}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

type StatProps = { label: string; value: number; danger?: boolean };
const Stat = ({ label, value, danger }: StatProps) => {
  const theme = useTheme();
  return (
    <View style={[dashboardStyle.stat, { backgroundColor: theme.neutralSoft }]}>
      <Text style={[dashboardStyle.statValue, { color: danger ? theme.danger : theme.text }]}>{value}</Text>
      <Text style={[dashboardStyle.small, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}