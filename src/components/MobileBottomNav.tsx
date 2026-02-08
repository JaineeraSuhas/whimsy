import { Users, Grid, Settings } from 'lucide-react';

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
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
            <div className="flex items-center justify-around px-4 py-3">
                {/* All Photos */}
                <button
                    onClick={() => onFilterChange('all')}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${filterMode === 'all'
                            ? 'bg-white/20 text-white'
                            : 'text-white/60'
                        }`}
                >
                    <Grid className="w-5 h-5" />
                    <span className="text-xs font-medium">All</span>
                </button>

                {/* People */}
                <button
                    onClick={() => onFilterChange('people')}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${filterMode === 'people'
                            ? 'bg-white/20 text-white'
                            : 'text-white/60'
                        }`}
                >
                    <Users className="w-5 h-5" />
                    <span className="text-xs font-medium">People</span>
                </button>

                {/* Settings */}
                <button
                    onClick={onSettingsClick}
                    className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-white/60 transition-all active:bg-white/10"
                >
                    <Settings className="w-5 h-5" />
                    <span className="text-xs font-medium">Settings</span>
                </button>
            </div>
        </div>
    );
}
