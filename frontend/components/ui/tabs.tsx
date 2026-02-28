import * as React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  onValueChange: () => {},
});

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ defaultValue, value: controlledValue, onValueChange, children, className }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '');
  const value = controlledValue ?? uncontrolledValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [controlledValue, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <View className={cn('w-full', className)}>{children}</View>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

function TabsList({ className, children }: TabsListProps) {
  return (
    <View className={cn('flex-row h-10 items-center justify-center rounded-md bg-muted p-1', className)}>
      {children}
    </View>
  );
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

function TabsTrigger({ value, className, children }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = React.useContext(TabsContext);
  const isSelected = selectedValue === value;

  return (
    <TouchableOpacity
      className={cn(
        'flex-1 items-center justify-center rounded-sm px-3 py-1.5',
        isSelected && 'bg-background shadow-sm',
        className
      )}
      onPress={() => onValueChange(value)}
      activeOpacity={0.7}>
      <Text
        className={cn(
          'text-sm font-medium',
          isSelected ? 'text-foreground' : 'text-muted-foreground'
        )}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

function TabsContent({ value, className, children }: TabsContentProps) {
  const { value: selectedValue } = React.useContext(TabsContext);

  if (selectedValue !== value) {
    return null;
  }

  return <View className={cn('mt-2', className)}>{children}</View>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
