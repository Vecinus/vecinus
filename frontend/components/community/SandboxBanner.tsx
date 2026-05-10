import * as React from 'react';
import { View } from 'react-native';
import { TestTube2 } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type SandboxBannerProps = {
  className?: string;
};

export function SandboxBanner({ className }: SandboxBannerProps) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-950/30',
        className,
      )}
    >
      <Icon as={TestTube2} size={16} className="text-amber-700 dark:text-amber-400" />
      <Text className="flex-1 text-xs text-amber-900 dark:text-amber-200">
        Entorno de evaluación · pagos simulados con IBANs de prueba del sandbox de GoCardless.
      </Text>
    </View>
  );
}
