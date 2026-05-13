import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { PlanCode } from '@/types/payments.types';

export type PlanInfo = {
  code: PlanCode;
  name: string;
  baseCents: number;
  perHouseholdCents: number;
  hoursPerMonth: number;
  carryoverCapHours: number;
  chatbotBase: number;
  chatbotPerHousehold: number;
};

export const PLAN_CATALOG: Record<PlanCode, PlanInfo> = {
  basic: {
    code: 'basic',
    name: 'Plan Básico',
    baseCents: 2000,
    perHouseholdCents: 20,
    hoursPerMonth: 2,
    carryoverCapHours: 10,
    chatbotBase: 500,
    chatbotPerHousehold: 5,
  },
  premium: {
    code: 'premium',
    name: 'Plan Premium',
    baseCents: 3000,
    perHouseholdCents: 50,
    hoursPerMonth: 4,
    carryoverCapHours: 20,
    chatbotBase: 1000,
    chatbotPerHousehold: 10,
  },
};

export function calculateMonthlyAmountCents(plan: PlanInfo, householdCount: number): number {
  const safeHouseholds = Math.max(0, Math.floor(householdCount));
  return plan.baseCents + plan.perHouseholdCents * safeHouseholds;
}

export function formatEuros(cents: number): string {
  const euros = cents / 100;
  return `${euros.toFixed(2).replace('.', ',')} €`;
}

type PlanSelectorProps = {
  selected: PlanCode;
  onChange: (plan: PlanCode) => void;
  householdCount: number;
  disabled?: boolean;
};

export function PlanSelector({ selected, onChange, householdCount, disabled = false }: PlanSelectorProps) {
  return (
    <View className="gap-3">
      {(Object.keys(PLAN_CATALOG) as PlanCode[]).map((code) => {
        const plan = PLAN_CATALOG[code];
        const isSelected = selected === code;
        const total = calculateMonthlyAmountCents(plan, householdCount);
        const chatbotMessages = plan.chatbotBase + plan.chatbotPerHousehold * Math.max(0, Math.floor(householdCount));

        return (
          <Pressable
            key={code}
            onPress={() => !disabled && onChange(code)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled }}
            className={cn(
              'rounded-xl border-2 p-4',
              isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background',
              disabled && 'opacity-60',
            )}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View
                  className={cn(
                    'size-5 items-center justify-center rounded-full border-2',
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                >
                  {isSelected ? <Icon as={Check} size={12} className="text-primary-foreground" /> : null}
                </View>
                <Text className="text-base font-bold text-foreground">{plan.name}</Text>
              </View>
              <Text className="text-base font-semibold text-foreground">
                {formatEuros(total)}
                <Text className="text-xs text-muted-foreground"> /mes</Text>
              </Text>
            </View>

            <View className="mt-2 gap-1">
              <Text className="text-xs text-muted-foreground">
                {formatEuros(plan.baseCents)} base + {formatEuros(plan.perHouseholdCents)} por vivienda
              </Text>
              <Text className="text-xs text-muted-foreground">
                · {plan.hoursPerMonth} h de actas al mes (acumulables hasta {plan.carryoverCapHours} h)
              </Text>
              <Text className="text-xs text-muted-foreground">
                · {chatbotMessages} mensajes de chatbot al mes
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
