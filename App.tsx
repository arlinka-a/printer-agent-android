import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AgentStatus, PrintAgent } from './src/agent/agent';
import { isConfigUsable, loadConfig, saveConfig } from './src/config/storage';
import { Dashboard } from './src/screens/Dashboard';
import { SetupWizard } from './src/screens/SetupWizard';
import { AgentConfig, emptyConfig, LocalPrinter } from './src/types';
import { useTheme } from './src/ui/theme';

type Screen = 'loading' | 'setup' | 'dashboard';

const isSetUp = (c: AgentConfig) => isConfigUsable(c) && Object.keys(c.backendPrinterMap).length > 0;

export default function App() {
  const t = useTheme();
  const [config, setConfig] = useState<AgentConfig>(emptyConfig);
  const [screen, setScreen] = useState<Screen>('loading');
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const agentRef = useRef<PrintAgent | null>(null);

  useEffect(() => {
    loadConfig().then((c) => {
      setConfig(c);
      setScreen(isSetUp(c) ? 'dashboard' : 'setup');
    });
    return () => agentRef.current?.stop();
  }, []);

  // Functional update so async handlers (scan, sync) never write back a stale config.
  const update = (patch: Partial<AgentConfig> | ((prev: AgentConfig) => Partial<AgentConfig>)) =>
    setConfig((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      saveConfig(next).catch(() => {});
      return next;
    });

  const updatePrinter = (index: number, patch: Partial<LocalPrinter>) =>
    update((prev) => ({ printers: prev.printers.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));

  const stopAgent = () => {
    agentRef.current?.stop();
    agentRef.current = null;
    setStatus(null);
  };

  const toggleAgent = () => {
    if (agentRef.current) {
      stopAgent();
      return;
    }
    const agent = new PrintAgent(config);
    agent.subscribe((st, line) => {
      setStatus(st);
      if (line) {
        setLog((prev) => [line, ...prev].slice(0, 100));
      }
    });
    agent.start();
    agentRef.current = agent;
  };

  // The agent captures config at start, so it can't keep running while settings change underneath it.
  const openSettings = () => {
    stopAgent();
    setScreen('setup');
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={t.statusBar} />
      <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>
        {screen === 'loading' && (
          <View style={[s.root, s.center]}>
            <ActivityIndicator color={t.primary} />
          </View>
        )}
        {screen === 'setup' && (
          <SetupWizard
            config={config}
            update={update}
            updatePrinter={updatePrinter}
            onDone={() => setScreen('dashboard')}
            onCancel={isSetUp(config) ? () => setScreen('dashboard') : undefined}
          />
        )}
        {screen === 'dashboard' && (
          <Dashboard
            config={config}
            status={status}
            log={log}
            canStart={isSetUp(config)}
            onToggleAgent={toggleAgent}
            onOpenSettings={openSettings}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
