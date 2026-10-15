import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { loadConfig, saveConfig } from './src/config/storage';
import { SetupWizard } from './src/screens/SetupWizard';
import { AgentConfig, emptyConfig } from './src/types';
import { useTheme } from './src/ui/theme';

export default function App() {
  const t = useTheme();
  const [config, setConfig] = useState<AgentConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  // Functional update so async handlers (scan, sync) never write back a stale config.
  const update = (patch: Partial<AgentConfig> | ((prev: AgentConfig) => Partial<AgentConfig>)) =>
    setConfig((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      saveConfig(next).catch(() => {});
      return next;
    });

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={t.statusBar} />
      <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>
        {loading ? (
          <View style={[s.root, s.center]}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : (
          <SetupWizard config={config} update={update} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
