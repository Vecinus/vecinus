import * as React from 'react';
import { View, Text, Pressable, type ViewProps, type PressableProps } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps extends ViewProps {
  onPress?: () => void;
}

const Card = React.forwardRef<View, CardProps>(
  ({ className, children, onPress, ...props }, ref) => {
    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          className={cn('rounded-lg border border-border bg-card shadow-sm', className)}
          {...(props as PressableProps)}>
          {children}
        </Pressable>
      );
    }

    return (
      <View
        ref={ref}
        className={cn('rounded-lg border border-border bg-card shadow-sm', className)}
        {...props}>
        {children}
      </View>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<Text, React.ComponentProps<typeof Text>>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn('text-2xl font-semibold leading-none tracking-tight text-card-foreground', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<Text, React.ComponentProps<typeof Text>>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-row items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
