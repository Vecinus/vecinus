import * as React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { X } from "lucide-react-native";
import { cn } from "@/lib/utils";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
});

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider
      value={{ open, onOpenChange: onOpenChange || (() => {}) }}
    >
      {children}
    </DialogContext.Provider>
  );
}

interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const { onOpenChange } = React.useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onPress: () => onOpenChange(true),
    } as any);
  }

  return (
    <TouchableOpacity onPress={() => onOpenChange(true)}>
      {children}
    </TouchableOpacity>
  );
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

function DialogContent({ className, children }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/80"
        onPress={() => onOpenChange(false)}
      >
        <Pressable
          className={cn(
            "w-11/12 max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg",
            className,
          )}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="max-h-[85vh]"
          >
            {children}
          </ScrollView>
          <TouchableOpacity
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity active:opacity-100"
            onPress={() => onOpenChange(false)}
          >
            <X size={16} color="hsl(215.4 16.3% 46.9%)" />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

function DialogHeader({ className, children }: DialogHeaderProps) {
  return (
    <View className={cn("flex flex-col gap-1.5 mb-4", className)}>
      {children}
    </View>
  );
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

function DialogTitle({ className, children }: DialogTitleProps) {
  return (
    <Text
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-foreground",
        className,
      )}
    >
      {children}
    </Text>
  );
}

interface DialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

function DialogDescription({ className, children }: DialogDescriptionProps) {
  return (
    <Text className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </Text>
  );
}

interface DialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

function DialogFooter({ className, children }: DialogFooterProps) {
  return (
    <View className={cn("flex flex-col-reverse gap-2 mt-4", className)}>
      {children}
    </View>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
