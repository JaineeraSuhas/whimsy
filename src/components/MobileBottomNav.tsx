import { Users, Grid, Settings, Library } from 'lucide-react';

interface MobileBottomNavProps {
    filterMode: 'all' | 'people';
    onFilterChange: (mode: 'all' | 'people') => void;
    onSettingsClick: () => void;
    onLayoutClick: () => void;
}

export default function MobileBottomNav({
    filterMode,
    onFilterChange,
    onSettingsClick,
    onLayoutClick
}: MobileBottomNavProps) {
    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-t border-white/5 safe-area-bottom">
            <div className="flex items-center justify-around px-2 pt-2 pb-6">
                {/* Library (All Photos) */}
                <button
                    onClick={() => onFilterChange('all')}
                    className={`flex flex-col items-center gap-1.5 px-6 py-2 transition-all duration-300 ${filterMode === 'all'
                        ? 'text-white'
                        : 'text-white/30'
                        }`}
                >
                    <Library className={`w-6 h-6 transition-transform ${filterMode === 'all' ? 'scale-110' : 'scale-100'}`} />
                    <span className="text-[10px] font-bold tracking-tight">Library</span>
                </button>

                {/* People */}
                <button
                    onClick={() => onFilterChange('people')}
                    className={`flex flex-col items-center gap-1.5 px-6 py-2 transition-all duration-300 ${filterMode === 'people'
                        ? 'text-white'
                        : 'text-white/30'
                        }`}
                >
                    <Users className={`w-6 h-6 transition-transform ${filterMode === 'people' ? 'scale-110' : 'scale-100'}`} />
                    <span className="text-[10px] font-bold tracking-tight">People</span>
                </button>

                {/* Settings */}
                <button
                    onClick={onSettingsClick}
                    className="flex flex-col items-center gap-1.5 px-6 py-2 text-white/30 transition-all active:scale-95 duration-200"
                >
                    <Settings className="w-6 h-6" />
                    <span className="text-[10px] font-bold tracking-tight">Settings</span>
                </button>
            </div>
        </div>
    );
}
