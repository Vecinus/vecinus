import * as React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        outline: "border border-input bg-background",
        secondary: "bg-secondary",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva("text-sm font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-primary underline",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ButtonProps
  extends TouchableOpacityProps, VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
}

const Button = React.forwardRef<View, ButtonProps>(
  ({ className, variant, size, children, disabled, ...props }, ref) => {
    return (
      <TouchableOpacity
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        activeOpacity={0.7}
        ref={ref}
        {...props}
      >
        {typeof children === "string" ? (
          <Text className={cn(buttonTextVariants({ variant }))}>
            {children}
          </Text>
        ) : (
          children
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
