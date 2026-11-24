import React from 'react';
import { QaSimulatorPanel } from './components/QaSimulatorPanel';
import { ToastBanner } from './components/ui/ToastBanner';
import { SajiAmanProvider, useSajiAman } from './context/SajiAmanContext';
import { LoginScreen } from './screens/auth/LoginScreen';
import { BatchQrTicketScreen } from './screens/kitchen/BatchQrTicketScreen';
import { CreateBatchScreen } from './screens/kitchen/CreateBatchScreen';
import { KitchenHomeScreen } from './screens/kitchen/KitchenHomeScreen';
import { MaggotDashboardScreen } from './screens/kitchen/MaggotDashboardScreen';
import { OmprengTrackerScreen } from './screens/kitchen/OmprengTrackerScreen';
import { SafetyCheckScreen } from './screens/school/SafetyCheckScreen';
import { SchoolHistoryScreen } from './screens/school/SchoolHistoryScreen';
import { SchoolScannerScreen } from './screens/school/SchoolScannerScreen';
import { WasteReportScreen } from './screens/school/WasteReportScreen';

const MobileAppRouter: React.FC = () => {
  const { route, toast, dismissToast } = useSajiAman();

  const renderScreen = () => {
    switch (route.name) {
      case 'login':
        return <LoginScreen />;
      case 'kitchen_home':
        return <KitchenHomeScreen />;
      case 'kitchen_create_batch':
        return <CreateBatchScreen />;
      case 'kitchen_batch_qr':
        return <BatchQrTicketScreen batchId={route.batchId} />;
      case 'kitchen_ompreng':
        return <OmprengTrackerScreen />;
      case 'kitchen_maggot':
        return <MaggotDashboardScreen />;
      case 'school_scanner':
        return <SchoolScannerScreen />;
      case 'school_history':
        return <SchoolHistoryScreen />;
      case 'school_safety_check':
        return <SafetyCheckScreen batchId={route.batchId} />;
      case 'school_waste_report':
        return (
          <WasteReportScreen
            batchId={route.batchId}
            presetCategory={route.presetCategory}
          />
        );
      default:
        return <LoginScreen />;
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#E2E8F0] flex flex-row items-center justify-center md:gap-8 md:p-6">
      {/* Precision Mobile Phone Frame (full-bleed on actual mobile viewports) */}
      <div className="relative w-full h-[100dvh] md:w-[390px] md:max-w-[390px] md:h-[844px] md:max-h-[calc(100dvh-48px)] overflow-hidden md:rounded-[36px] md:border-[6px] md:border-[#0F172A] bg-[#F4F7FA] flex flex-col">
        <ToastBanner toast={toast} onDismiss={dismissToast} />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {renderScreen()}
        </div>
      </div>

      {/* External QA & Clock Simulator Sidebar (Desktop / Tablet only) */}
      <QaSimulatorPanel />
    </div>
  );
};

export default function App() {
  return (
    <SajiAmanProvider>
      <MobileAppRouter />
    </SajiAmanProvider>
  );
}
