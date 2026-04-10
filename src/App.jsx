import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Layout } from '@/components/Layout';
import { LegacyTab } from '@/tabs/LegacyTab';
import { DashboardTab } from '@/tabs/DashboardTab';
import { PillarsTab } from '@/tabs/PillarsTab';
import { UseCaseTab } from '@/tabs/UseCaseTab';
import { InventoryTab } from '@/tabs/InventoryTab';
import { GraphTab } from '@/tabs/GraphTab';
import { LineageTab } from '@/tabs/LineageTab';
import { EngineTab } from '@/tabs/EngineTab';
import { SandboxTab } from '@/tabs/SandboxTab';
import { WhatIfTab } from '@/tabs/WhatIfTab';

const VIEWS = {
  legacy: LegacyTab,
  dashboard: DashboardTab,
  pillars: PillarsTab,
  usecase: (props) => <UseCaseTab onContinue={() => props.setView('pillars')} />,
  inventory: InventoryTab,
  graph: GraphTab,
  lineage: LineageTab,
  engine: EngineTab,
  sandbox: SandboxTab,
  whatif: WhatIfTab,
};

export default function App() {
  const [view, setView] = useState('legacy');
  const Active = VIEWS[view];

  return (
    <ThemeProvider defaultTheme="warm">
      <Layout view={view} setView={setView}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Active setView={setView} />
          </motion.div>
        </AnimatePresence>
      </Layout>
    </ThemeProvider>
  );
}
