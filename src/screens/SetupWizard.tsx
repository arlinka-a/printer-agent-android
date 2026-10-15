import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { syncPrinters } from '../agent/agent';
import { api } from '../api/client';
import { isConfigUsable } from '../config/storage';
import { discoverPrinters } from '../printers/discovery';
import { probe } from '../printers/transport';
import { he, ltr } from '../i18n/he';
import { AgentConfig, LocalPrinter } from '../types';
import { Button, Card, Field, Notice, Pill, Tone } from '../ui/components';
import { useTheme } from '../ui/theme';

type ConfigPatch = Partial<AgentConfig> | ((prev: AgentConfig) => Partial<AgentConfig>);
type Msg = { text: string; tone: Tone } | null;

type Props = {
  config: AgentConfig;
  update: (patch: ConfigPatch) => void;
  updatePrinter: (index: number, patch: Partial<LocalPrinter>) => void;
  onDone: () => void;
  /** Present when setup was already completed once, so the user can back out to the dashboard. */
  onCancel?: () => void;
}

export const SetupWizard = ({ config, update, updatePrinter, onDone, onCancel }: Props) => {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState('');
  const [verifying, setVerifying] = useState<number | null>(null);

  const go = (next: number) => {
    setMsg(null);
    setStep(next);
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        go(step - 1);
        return true;
      }
      if (onCancel) {
        onCancel();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, onCancel]);

  const fail = (e: unknown) => setMsg({ text: (e as Error).message, tone: 'danger' });

  const testConnection = async () => {
    setBusy('test');
    setMsg(null);
    try {
      await api.activePrinters(config);
      setMsg({ text: he.wizard.connected, tone: 'success' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const scan = async () => {
    setBusy('0/254');
    setMsg(null);
    try {
      const found = await discoverPrinters((n, total) => setBusy(`${n}/${total}`));
      update((prev) => {
        const known = new Map(prev.printers.map((p) => [p.ip, p]));
        return { printers: found.map((p) => known.get(p.ip) ?? p) };
      });
      setMsg(
        found.length
          ? { text: he.wizard.found(found.length), tone: 'success' }
          : { text: he.wizard.noneFound, tone: 'warn' },
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const saveAndContinue = async () => {
    setBusy('sync');
    setMsg(null);
    try {
      const backendPrinterMap = await syncPrinters(config);
      update({ backendPrinterMap });
      go(2);
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const verify = async (index: number) => {
    const p = config.printers[index];
    setVerifying(index);
    const ok = await probe(p.ip, p.port, 1500);
    setVerifying(null);
    updatePrinter(index, { staticIpConfirmed: ok });
    setMsg(ok ? null : { text: he.wizard.noAnswer(p.name, `${p.ip}:${p.port}`), tone: 'danger' });
  };

  const scanning = busy.includes('/');
  const muted = { color: theme.textMuted };

  return (
    <View style={s.flex}>
      <View style={s.header}>
        <View style={s.spread}>
          <Text style={[s.title, { color: theme.text }]}>{he.wizard.title}</Text>
          {onCancel && <Button label={he.wizard.close} variant="ghost" onPress={onCancel} style={s.compactBtn} />}
        </View>
        <View style={s.steps}>
          {he.wizard.steps.map((label, i) => (
            <View key={label} style={s.step}>
              <View style={[s.stepBar, { backgroundColor: i <= step ? theme.primary : theme.border }]} />
              <Text style={[s.stepLabel, i === step ? [s.stepLabelActive, { color: theme.text }] : muted]}>
                {i + 1}. {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Text style={[s.intro, muted]}>{he.wizard.connectIntro}</Text>
            <Card>
              <Field label={he.wizard.serverUrl} onChangeText={(v) => update({ baseUrl: v })} keyboardType="url" ltr />
              <Field label={he.wizard.agentKey} onChangeText={(v) => update({ agentToken: v })}
                placeholder="pa_..." secureTextEntry ltr />
              <Field label={he.wizard.tenant} onChangeText={(v) => update({ tenantId: v })} />
              <Button label={he.wizard.testConnection} variant="secondary" onPress={testConnection}
                loading={busy === 'test'} disabled={!isConfigUsable(config)} />
            </Card>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[s.intro, muted]}>{he.wizard.printersIntro}</Text>
            <Button label={scanning ? he.wizard.scanning(busy) : config.printers.length ? he.wizard.scanAgain : he.wizard.scan}
              variant="secondary" onPress={scan} loading={scanning} disabled={!!busy && !scanning} />
            {config.printers.map((p, i) => (
              <Card key={p.ip}>
                <Field label={ltr(p.ip)} value={p.name} onChangeText={(v) => updatePrinter(i, { name: v })} />
              </Card>
            ))}
            {!config.printers.length && !scanning && !msg && <Text style={[s.empty, muted]}>{he.wizard.noPrintersYet}</Text>}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[s.intro, muted]}>{he.wizard.verifyIntro}</Text>
            {config.printers.map((p, i) => (
              <Card key={`ip-${i}`}>
                <View style={s.spread}>
                  <Text style={[s.printerName, { color: theme.text }]}>{p.name}</Text>
                  <Pill label={p.staticIpConfirmed ? he.common.verified : he.common.notVerified}
                    tone={p.staticIpConfirmed ? 'success' : 'neutral'} />
                </View>
                <View style={s.ipRow}>
                  <View style={s.flex}>
                    <Field label={he.wizard.ipAddress} value={p.ip} keyboardType="numeric" ltr
                      onChangeText={(v) => updatePrinter(i, { ip: v, staticIpConfirmed: false })} />
                  </View>
                  <Button label={he.wizard.verify} variant="secondary" onPress={() => verify(i)} loading={verifying === i} />
                </View>
              </Card>
            ))}
          </>
        )}

        {msg && <Notice text={msg.text} tone={msg.tone} />}
      </ScrollView>

      <View style={[s.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
        {step > 0 && <Button label={he.wizard.back} variant="secondary" onPress={() => go(step - 1)} style={s.flex} />}
        {step === 0 && <Button label={he.wizard.next} onPress={() => go(1)} disabled={!isConfigUsable(config)} style={s.primary} />}
        {step === 1 && (
          <Button label={he.wizard.saveAndContinue} onPress={saveAndContinue} loading={busy === 'sync'}
            disabled={!config.printers.length || !!busy} style={s.primary} />
        )}
        {step === 2 && <Button label={he.wizard.finish} onPress={onDone} style={s.primary} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  primary: { flex: 2 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 14 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  compactBtn: { paddingVertical: 6 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, gap: 6 },
  stepBar: { height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 12 },
  stepLabelActive: { fontWeight: '600' },
  body: { padding: 20, gap: 16 },
  intro: { fontSize: 15 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  printerName: { fontSize: 16, fontWeight: '600' },
  ipRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  footer: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1 },
});
