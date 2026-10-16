import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, Text, ToastAndroid, View } from 'react-native';
import { syncPrinters } from '../agent/agent';
import { api, ApiError, normalizeBaseUrl } from '../api/client';
import { isConfigUsable } from '../config/storage';
import { autoStart } from '../native/autoStart';
import { discoverPrinters } from '../printers/discovery';
import { buildTextReceipt } from '../printers/escpos';
import { sendRaw } from '../printers/transport';
import { ltr, timeStamp } from '../utils/he';
import { AgentConfig, LocalPrinter, StaticIpStatus } from '../types';
import { Button, Card, Field, Notice, SectionTitle, StaticIpTag, Tone } from '../ui/components';
import { setupStyle, useTheme } from '../ui/theme';
import { isEmpty } from 'lodash';

type ConfigPatch = Partial<AgentConfig> | ((prev: AgentConfig) => Partial<AgentConfig>);
type Msg = { text: string; tone: Tone } | null;

type Props = {
  config: AgentConfig;
  update: (patch: ConfigPatch) => void;
}

// Right after a phone restart Wi-Fi may not be up yet, so the automatic connect keeps retrying this long.
const STARTUP_NETWORK_WAIT_MS = 60_000;
const STARTUP_RETRY_MS = 3000;

const testPage = (printer: LocalPrinter) =>
  ['בדיקת הדפסה', printer.name, printer.model ?? '', printer.ip, timeStamp()].filter(Boolean).join('\n');

export const SetupWizard = ({ config, update }: Props) => {
  const theme = useTheme();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState('');
  const [connected, setConnected] = useState(false);
  const [found, setFound] = useState<LocalPrinter[]>([]);
  const [scanned, setScanned] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  // Assume granted until checked, so the prompt doesn't flash on every launch.
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);
  // IP whose web page was opened; when the user comes back we ask whether they pinned it.
  const pendingIp = useRef<string | null>(null);
  const leftApp = useRef(false);

  const markStaticIp = (ip: string, staticIp: StaticIpStatus) => {
    update((prev) => ({
      printers: prev.printers.map((p) => (p.ip === ip ? { ...p, staticIp } : p)),
    }));
    setFound((prev) => prev.map((p) => (p.ip === ip ? { ...p, staticIp } : p)));
  };
  const markStaticIpRef = useRef(markStaticIp);
  markStaticIpRef.current = markStaticIp;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        leftApp.current = !!pendingIp.current;
        return;
      }
      const ip = pendingIp.current;
      if (!ip || !leftApp.current) {
        return;
      }
      pendingIp.current = null;
      leftApp.current = false;
      Alert.alert('קיבעת את כתובת ה-IP בהצלחה?', ltr(ip), [
        { text: 'לא', style: 'cancel', onPress: () => markStaticIpRef.current(ip, 'notPinned') },
        { text: 'כן', onPress: () => markStaticIpRef.current(ip, 'pinned') },
      ]);
    });
    return () => sub.remove();
  }, []);

  // Re-checked on every return to the app, since the permission is granted in system settings.
  useEffect(() => {
    const check = () => autoStart.isEnabled().then(setAutoStartEnabled).catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, []);

  // A saved connection reconnects on launch, so the app reopens on the printers screen.
  useEffect(() => {
    if (isConfigUsable(config)) {
      connect(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = (e: unknown) => setMsg({ text: (e as Error).message, tone: 'danger' });

  const scan = async () => {
    setScanned(true);
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

  const connect = async (waitForNetwork = false) => {
    setBusy('test');
    setMsg(null);
    const deadline = Date.now() + STARTUP_NETWORK_WAIT_MS;
    for (;;) {
      try {
        await api.activePrinters(config);
        break;
      } catch (e) {
        // Status 0 means the server wasn't reachable at all; anything else (bad key) won't fix itself.
        if (waitForNetwork && e instanceof ApiError && e.status === 0 && Date.now() < deadline) {
          await new Promise<void>((resolve) => setTimeout(resolve, STARTUP_RETRY_MS));
          continue;
        }
        fail(e);
        setBusy('');
        return;
      }
    }
    setConnected(true);
    setBusy('');
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

  // Most network printers serve their own status/settings page over plain HTTP.
  // An IP already tagged as pinned opens the page without asking again on return.
  const openPrinterPage = ({ ip, staticIp }: LocalPrinter) => {
    pendingIp.current = staticIp === 'pinned' ? null : ip;
    Linking.openURL(`http://${ip}`).catch((e) => {
      pendingIp.current = null;
      fail(e);
    });
  };

  const editConnection = () => {
    setConnected(false);
    setMsg(null);
  };

  // Tapping a printer's row prints a test page; unless its IP is already pinned, the user confirms it came out.
  const testPrint = async (printer: LocalPrinter) => {
    setPrinting(printer.ip);
    setMsg(null);
    try {
      await sendRaw(printer.ip, printer.port, buildTextReceipt(testPage(printer)));
    } catch (e) {
      fail(e);
      return;
    } finally {
      setPrinting(null);
    }
    ToastAndroid.show('דף בדיקה נשלח', ToastAndroid.SHORT);
    if (printer.staticIp === 'pinned') {
      return;
    }
    Alert.alert('המדפסת הדפיסה בהצלחה?', printer.name, [
      { text: 'לא', style: 'cancel', onPress: () => setMsg({ text: 'לא הודפס בדוק נייר מכסה וחשמל - ולחץ שוב', tone: 'danger' }) },
      { text: 'כן', onPress: () => markStaticIpRef.current(printer.ip, 'pinned') },
    ]);
  };

  const scanning = busy.includes('/');
  const newPrinters = found.filter((p) => !isAdded(p.ip));
  const muted = { color: theme.textMuted };

  const renderRow = (p: LocalPrinter, i: number, trailing?: React.ReactNode) => (
    <Pressable key={p.ip} onPress={() => testPrint(p)} disabled={!!printing || !!busy}
      accessibilityRole="button" accessibilityLabel={`הדפסת בדיקה ל${p.name}`}
      style={({ pressed }) => [setupStyle.resultRow, i > 0 && [setupStyle.divided, { borderTopColor: theme.border }],
        pressed && setupStyle.dimmed]}>
      <Text style={[setupStyle.resultText, { color: theme.text }]} numberOfLines={1}>
        {p.name}
        <Text style={muted}>{` · ${p.model ? ltr(p.model) : 'דגם לא זוהה'}`}</Text>
      </Text>
      <Text style={[setupStyle.resultIp, setupStyle.link, { color: theme.primary }]}
        onPress={() => openPrinterPage(p)} accessibilityRole="link">{ltr(p.ip)}</Text>
      {printing === p.ip ? <ActivityIndicator size="small" color={theme.primary} /> : <StaticIpTag status={p.staticIp} />}
      {trailing}
    </Pressable>
  );

  return (
    <View style={setupStyle.flex}>
      <View style={setupStyle.header}>
        <View style={setupStyle.spread}>
          <Text style={[setupStyle.title, { color: theme.text }]}>הגדרה</Text>
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
            <Button label={busy === 'test' ? 'מתחבר למערכת' : 'התחבר'} variant="secondary" onPress={() => connect()}
              loading={busy === 'test'} disabled={!isConfigUsable(config)} />
          </Card>
        )}

        {connected && !autoStartEnabled && (
          <Card style={{ backgroundColor: theme.warnSoft, borderColor: theme.warn }}>
            <Text style={{ color: theme.text }}>
              {'כדי שהאפליקציה תיפתח מעצמה אחרי הפעלה מחדש של הטלפון, אשרו לה "הצגה מעל אפליקציות אחרות".'}
            </Text>
            <Button label={'אישור פתיחה אוטומטית'} variant="secondary" onPress={autoStart.openSettings} />
          </Card>
        )}

        {connected && !isEmpty(config.printers) && (
          <>
            <SectionTitle title={'המדפסות שלי'} right={<Text style={muted}>{config.printers.length}</Text>} />
            <Card style={setupStyle.resultList}>
              {config.printers.map((p, i) => renderRow(p, i))}
            </Card>
          </>
        )}

        {connected && (
          <>
            <SectionTitle title={'מדפסות חדשות'} right={scanned && (
              <Button label={scanning ? `סורק ${ltr(busy)}` : 'סריקה חוזרת'} variant="ghost" onPress={scan}
                loading={scanning} disabled={!!busy && !scanning} style={setupStyle.compactBtn} />
            )} />
            {!scanned && <Button label={'חיפוש מדפסות'} variant="secondary" onPress={scan} disabled={!!busy || !!printing} />}
            {!isEmpty(newPrinters) && (
              <Card style={setupStyle.resultList}>
                {newPrinters.map((p, i) => renderRow(p, i, adding === p.ip ? (
                  <View style={setupStyle.addBtn}><ActivityIndicator size="small" color={theme.primary} /></View>
                ) : (
                  <Pressable onPress={() => addPrinter(p)} disabled={!!adding || !!busy} hitSlop={8} accessibilityRole="button"
                    accessibilityLabel={`הוספת ${p.name}`}
                    style={({ pressed }) => [setupStyle.addBtn, { backgroundColor: theme.primarySoft }, pressed && setupStyle.dimmed]}>
                    <Text style={[setupStyle.addIcon, { color: theme.primary }]}>+</Text>
                  </Pressable>
                )))}
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
