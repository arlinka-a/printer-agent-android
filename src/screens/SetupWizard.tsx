import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { syncPrinters } from '../agent/agent';
import { api, normalizeBaseUrl } from '../api/client';
import { isConfigUsable } from '../config/storage';
import { discoverPrinters } from '../printers/discovery';
import { ltr } from '../utils/he';
import { AgentConfig, LocalPrinter } from '../types';
import { Button, Card, Field, Notice, SectionTitle, Tone } from '../ui/components';
import { setupStyle, useTheme } from '../ui/theme';
import { isEmpty } from 'lodash';

type ConfigPatch = Partial<AgentConfig> | ((prev: AgentConfig) => Partial<AgentConfig>);
type Msg = { text: string; tone: Tone } | null;

type Props = {
  config: AgentConfig;
  update: (patch: ConfigPatch) => void;
  onDone: () => void;
  /** Present when setup was already completed once, so the user can back out to the dashboard. */
  onCancel?: () => void;
}

export const SetupWizard = ({ config, update, onDone, onCancel }: Props) => {
  const theme = useTheme();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState('');
  const [connected, setConnected] = useState(false);
  const [found, setFound] = useState<LocalPrinter[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!onCancel) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [onCancel]);

  const fail = (e: unknown) => setMsg({ text: (e as Error).message, tone: 'danger' });

  const scan = async () => {
    setBusy('0/254');
    setMsg(null);
    try {
      const results = await discoverPrinters((n, total) => setBusy(`${n}/${total}`));
      setFound(results);
      // Refresh the model of printers that are already added; the search never adds or removes any.
      const models = new Map(results.map((p) => [p.ip, p.model]));
      update((prev) => ({
        printers: prev.printers.map((p) => (models.has(p.ip) ? { ...p, model: models.get(p.ip) } : p)),
      }));
      if (isEmpty(results)) {
        setMsg({ text: 'לא נמצאו מדפסות. ודאו שהטלפון מחובר לאותה רשת Wi-Fi כמו המדפסות.', tone: 'warn' });
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  // A successful connection goes straight into the printer search.
  const connect = async () => {
    setBusy('test');
    setMsg(null);
    try {
      await api.activePrinters(config);
    } catch (e) {
      fail(e);
      setBusy('');
      return;
    }
    setConnected(true);
    await scan();
  };

  const isAdded = (ip: string) => config.printers.some((p) => p.ip === ip);

  // Adding a printer registers it with the server right away, so there is no separate save step.
  const addPrinter = async (printer: LocalPrinter) => {
    if (isAdded(printer.ip)) {
      return;
    }
    setAdding(printer.ip);
    setMsg(null);
    try {
      const printers = [...config.printers, printer];
      const backendPrinterMap = await syncPrinters({ ...config, printers });
      update({ printers, backendPrinterMap });
      ToastAndroid.show(`המדפסת ${printer.name} נשמרה בהצלחה`, ToastAndroid.SHORT);
    } catch (e) {
      fail(e);
    } finally {
      setAdding(null);
    }
  };

  const editConnection = () => {
    setConnected(false);
    setMsg(null);
  };

  // Syncs again on the way out so renamed printers reach the server under their new names.
  const finish = async () => {
    setBusy('sync');
    setMsg(null);
    try {
      const backendPrinterMap = await syncPrinters(config);
      update({ backendPrinterMap });
      onDone();
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };

  const scanning = busy.includes('/');
  const newPrinters = found.filter((p) => !isAdded(p.ip));
  const muted = { color: theme.textMuted };

  return (
    <View style={setupStyle.flex}>
      <View style={setupStyle.header}>
        <View style={setupStyle.spread}>
          <Text style={[setupStyle.title, { color: theme.text }]}>הגדרה</Text>
          {connected && !isEmpty(config.printers) ? (
            <Button label={'סיום'} variant="ghost" onPress={finish} loading={busy === 'sync'}
              disabled={!!busy || !!adding} style={setupStyle.compactBtn} />
          ) : (
            onCancel && <Button label={'סגירה'} variant="ghost" onPress={onCancel} style={setupStyle.compactBtn} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={setupStyle.body} keyboardShouldPersistTaps="handled">
        <Text style={[setupStyle.intro, muted]}>{'חברו את המכשיר לשרת ההדפסה. את מפתח הסוכן אפשר למצוא בלוח הניהול של השרת.'}</Text>

        {connected ? (
          <Card style={{ backgroundColor: theme.successSoft, borderColor: theme.success }}>
            <View style={setupStyle.spread}>
              <View style={setupStyle.shrink}>
                <Text style={[setupStyle.connectedTitle, { color: theme.success }]}>
                  {`מחובר בהצלחה ${config.tenantId.trim()}`}
                </Text>
                <Text style={[setupStyle.link, { color: theme.primary }]} numberOfLines={1}
                  onPress={() => Linking.openURL(normalizeBaseUrl(config.baseUrl))}>
                  {ltr(normalizeBaseUrl(config.baseUrl))}
                </Text>
              </View>
              <Pressable onPress={editConnection} disabled={!!busy} hitSlop={12}
                accessibilityRole="button" accessibilityLabel={'עריכת פרטי החיבור'}>
                <Text style={[setupStyle.editIcon, { color: theme.success }, !!busy && setupStyle.dimmed]}>✎</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <Card>
            <Field label={'כתובת המערכת'} value={config.baseUrl} onChangeText={(v) => update({ baseUrl: v })}
              keyboardType="url" ltr />
            <Field label={'מפתח זיהוי'} value={config.agentToken} onChangeText={(v) => update({ agentToken: v })}
              placeholder="pa_..." secureTextEntry ltr />
            <Field label={'שם העסק'} value={config.tenantId} onChangeText={(v) => update({ tenantId: v })} />
            <Button label={busy === 'test' ? 'מתחבר למערכת' : 'התחבר'} variant="secondary" onPress={connect}
              loading={busy === 'test'} disabled={!isConfigUsable(config)} />
          </Card>
        )}

        {connected && !isEmpty(config.printers) && (
          <>
            <SectionTitle title={'המדפסות שלי'} right={<Text style={muted}>{config.printers.length}</Text>} />
            <Card style={setupStyle.resultList}>
              {config.printers.map((p, i) => (
                <View key={p.ip} style={[setupStyle.resultRow, i > 0 && [setupStyle.divided, { borderTopColor: theme.border }]]}>
                  <Text style={[setupStyle.resultText, { color: theme.text }]} numberOfLines={1}>
                    {p.name}
                    <Text style={muted}>{` · ${p.model ? ltr(p.model) : 'דגם לא זוהה'}`}</Text>
                  </Text>
                  <Text style={[setupStyle.resultIp, muted]}>{ltr(p.ip)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {connected && (
          <>
            <SectionTitle title={'מדפסות חדשות'} right={
              <Button label={scanning ? `סורק ${ltr(busy)}` : 'סריקה חוזרת'} variant="ghost" onPress={scan}
                loading={scanning} disabled={!!busy && !scanning} style={setupStyle.compactBtn} />
            } />
            {!isEmpty(newPrinters) && (
              <Card style={setupStyle.resultList}>
                {newPrinters.map((p, i) => (
                  <View key={p.ip} style={[setupStyle.resultRow, i > 0 && [setupStyle.divided, { borderTopColor: theme.border }]]}>
                    <Text style={[setupStyle.resultText, { color: theme.text }]} numberOfLines={1}>
                      {p.name}
                      <Text style={muted}>{` · ${p.model ? ltr(p.model) : 'דגם לא זוהה'}`}</Text>
                    </Text>
                    <Text style={[setupStyle.resultIp, muted]}>{ltr(p.ip)}</Text>
                    {adding === p.ip ? (
                      <View style={setupStyle.addBtn}><ActivityIndicator size="small" color={theme.primary} /></View>
                    ) : (
                      <Pressable onPress={() => addPrinter(p)} disabled={!!adding || !!busy} hitSlop={8} accessibilityRole="button"
                        accessibilityLabel={`הוספת ${p.name}`}
                        style={({ pressed }) => [setupStyle.addBtn, { backgroundColor: theme.primarySoft }, pressed && setupStyle.dimmed]}>
                        <Text style={[setupStyle.addIcon, { color: theme.primary }]}>+</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </Card>
            )}
            {isEmpty(newPrinters) && scanning && <Text style={[setupStyle.empty, muted]}>{'מחפש מדפסות ברשת…'}</Text>}
            {isEmpty(newPrinters) && !scanning && !isEmpty(found) && (
              <Text style={[setupStyle.empty, muted]}>{'לא נמצאו מדפסות. ודא שהן דלוקות ובאותו ראוטר.'}</Text>
            )}
          </>
        )}

        {msg && <Notice text={msg.text} tone={msg.tone} />}

      </ScrollView>
    </View>
  );
}
