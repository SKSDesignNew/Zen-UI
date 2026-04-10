import { useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { LegacyTab } from '@/tabs/LegacyTab';
import { AITrapTab } from '@/tabs/AITrapTab';
import { PillarsTab } from '@/tabs/PillarsTab';
import { UseCaseTab } from '@/tabs/UseCaseTab';
import { InventoryTab } from '@/tabs/InventoryTab';
import { GraphTab } from '@/tabs/GraphTab';
import { ZG2Tab } from '@/tabs/ZG2Tab';
import { LineageTab } from '@/tabs/LineageTab';
import { EngineTab } from '@/tabs/EngineTab';
import { SandboxTab } from '@/tabs/SandboxTab';
import { WhatIfTab } from '@/tabs/WhatIfTab';

const VIEWS = {
  legacy: LegacyTab,
  aitrap: AITrapTab,
  pillars: PillarsTab,
  usecase: (props) => <UseCaseTab onContinue={() => props.setView('pillars')} />,
  inventory: InventoryTab,
  graph: GraphTab,
  zg2: ZG2Tab,
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
        <ErrorBoundary key={view} name={view}>
          <Active setView={setView} />
        </ErrorBoundary>
      </Layout>
    </ThemeProvider>
  );
}
