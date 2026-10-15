import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { syncPrinters } from '../agent/agent';
import { api } from '../api/client';
import { isConfigUsable } from '../config/storage';
import { discoverPrinters } from '../printers/discovery';
import { probe } from '../printers/transport';
import { ltr } from '../utils/he';
import { AgentConfig, LocalPrinter } from '../types';
import { Button, Card, Field, Notice, Pill, Tone } from '../ui/components';
import { setupStyle, useTheme } from '../ui/theme';
import { isEmpty } from 'lodash';

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

const steps = ['חיבור', 'מדפסות', 'אימות']

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
      setMsg({ text: 'מחובר — השרת אישר את מפתח הזיהוי.', tone: 'success' });
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
        !isEmpty(found)
          ? { text: (found.length === 1 ? 'נמצאה מדפסת אחת.' : `נמצאו ${found.length} מדפסות.`), tone: 'success' }
          : { text: 'לא נמצאו מדפסות. ודאו שהטלפון מחובר לאותה רשת Wi-Fi כמו המדפסות.', tone: 'warn' },
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
    const printer = config.printers[index];
    setVerifying(index);
    const ok = await probe(printer.ip, printer.port, 1500);
    setVerifying(null);
    updatePrinter(index, { staticIpConfirmed: ok });
    setMsg(ok ? null : { text: `${printer.name} לא ענתה בכתובת ${ltr(`${printer.ip}:${printer.port}`)}.`, tone: 'danger' });
  };

  const scanning = busy.includes('/');
  const muted = { color: theme.textMuted };

  return (
    <View style={setupStyle.flex}>
      <View style={setupStyle.header}>
        <View style={setupStyle.spread}>
          <Text style={[setupStyle.title, { color: theme.text }]}>הגדרה</Text>
          {onCancel && <Button label={'סגירה'} variant="ghost" onPress={onCancel} style={setupStyle.compactBtn} />}
        </View>
        <View style={setupStyle.steps}>
          {steps.map((label, i) => (
            <View key={label} style={setupStyle.step}>
              <View style={[setupStyle.stepBar, { backgroundColor: i <= step ? theme.primary : theme.border }]} />
              <Text style={[setupStyle.stepLabel, i === step ? [setupStyle.stepLabelActive, { color: theme.text }] : muted]}>
                {i + 1}. {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={setupStyle.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Text style={[setupStyle.intro, muted]}>{'חברו את המכשיר לשרת ההדפסה. את מפתח הסוכן אפשר למצוא בלוח הניהול של השרת.'}</Text>
            <Card>
              <Field label={'כתובת המערכת'} onChangeText={(v) => update({ baseUrl: v })} keyboardType="url" ltr />
              <Field label={'מפתח זיהוי'} onChangeText={(v) => update({ agentToken: v })}
                placeholder="pa_..." secureTextEntry ltr />
              <Field label={'שם העסק'} onChangeText={(v) => update({ tenantId: v })} />
              <Button label={busy === 'test' ? 'מתחבר למערכת' : 'התחבר'} variant="secondary" onPress={testConnection}
                loading={busy === 'test'} disabled={!isConfigUsable(config)} />
            </Card>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[setupStyle.intro, muted]}>{'חיפוש מדפסות רשת ב-Wi-Fi הזה (פורט 9100). תנו לכל מדפסת שם שתזהו.'}</Text>
            <Button label={scanning ? `סורק ${ltr(busy)}` : config.printers.length ? 'סריקה חוזרת' : 'סריקת הרשת'}
              variant="secondary" onPress={scan} loading={scanning} disabled={!!busy && !scanning} />
            {config.printers.map((p, i) => (
              <Card key={p.ip}>
                <Field label={ltr(p.ip)} value={p.name} onChangeText={(v) => updatePrinter(i, { name: v })} />
              </Card>
            ))}
            {!config.printers.length && !scanning && !msg && <Text style={[setupStyle.empty, muted]}>{'עדיין אין מדפסות.'}</Text>}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[setupStyle.intro, muted]}>{'הגדירו כתובת IP קבועה לכל מדפסת בנתב, ואז בדקו שהיא עונה בכתובת הזו.'}</Text>
            {config.printers.map((p, i) => (
              <Card key={`ip-${i}`}>
                <View style={setupStyle.spread}>
                  <Text style={[setupStyle.printerName, { color: theme.text }]}>{p.name}</Text>
                  <Pill label={p.staticIpConfirmed ? 'אומתה' : 'לא אומתה'}
                    tone={p.staticIpConfirmed ? 'success' : 'neutral'} />
                </View>
                <View style={setupStyle.ipRow}>
                  <View style={setupStyle.flex}>
                    <Field label={'כתובת IP'} value={p.ip} keyboardType="numeric" ltr
                      onChangeText={(v) => updatePrinter(i, { ip: v, staticIpConfirmed: false })} />
                  </View>
                  <Button label={'אימות'} variant="secondary" onPress={() => verify(i)} loading={verifying === i} />
                </View>
              </Card>
            ))}
          </>
        )}

        {msg && <Notice text={msg.text} tone={msg.tone} />}
      </ScrollView>

      <View style={[setupStyle.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
        {step > 0 && <Button label={'חזרה'} variant="secondary" onPress={() => go(step - 1)} style={setupStyle.flex} />}
        {step === 0 && <Button label={'הבא'} onPress={() => go(1)} disabled={!isConfigUsable(config)} style={setupStyle.primary} />}
        {step === 1 && (
          <Button label={'שמירה והמשך'} onPress={saveAndContinue} loading={busy === 'sync'}
            disabled={isEmpty(config.printers) || !!busy} style={setupStyle.primary} />
        )}
        {step === 2 && <Button label={'סיום'} onPress={onDone} style={setupStyle.primary} />}
      </View>
    </View>
  );
}
