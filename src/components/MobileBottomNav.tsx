import { Users, Settings, Library, Palette } from 'lucide-react';
import { MenuBar } from './ui/bottom-menu';

interface MobileBottomNavProps {
    filterMode: 'all' | 'people';
    showDesign: boolean;
    onFilterChange: (mode: 'all' | 'people') => void;
    onDesignClick: () => void;
    onSettingsClick: () => void;
    onLayoutClick: () => void;
}

export default function MobileBottomNav({
    onFilterChange,
    onDesignClick,
    onSettingsClick,
}: MobileBottomNavProps) {
    const items = [
        {
            icon: (props: any) => <Library {...props} />,
            label: "Library",
            onClick: () => onFilterChange('all')
        },
        {
            icon: (props: any) => <Users {...props} />,
            label: "People",
            onClick: () => onFilterChange('people')
        },
        {
            icon: (props: any) => <Palette {...props} />,
            label: "Layouts",
            onClick: onDesignClick
        },
        {
            icon: (props: any) => <Settings {...props} />,
            label: "Settings",
            onClick: onSettingsClick
        }
    ];

    return (
        <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <MenuBar items={items} />
        </div>
    );
}
