import * as React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
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
  children: React.ReactElement<{ onPress?: () => void }>;
}

function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const { onOpenChange } = React.useContext(DialogContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onPress: () => {
        onOpenChange(true);
      },
    });
  }

  return (
    <TouchableOpacity
      onPress={() => {
        onOpenChange(true);
      }}
    >
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
      onRequestClose={() => {
        onOpenChange(false);
      }}
    >
      {/*
        Contenedor raíz: ocupa toda la pantalla, solo para centrar el card.
        No tiene handlers de toque para no interferir con gestos internos.
      */}
      <View style={styles.container}>
        {/*
          Backdrop: View absolutamente posicionada detrás del card.
          El TouchableOpacity aquí no envuelve el card, por lo que
          los gestos sobre el card NUNCA llegan a este handler.
        */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => {
            onOpenChange(false);
          }}
        />

        {/*
          Card: View independiente, encima del backdrop por orden de renderizado.
          No tiene ningún handler de toque, así que todos los gestos
          (scroll, tap en botones) se propagan normalmente a sus hijos.
        */}
        <View
          style={styles.card}
          className={cn(
            "w-11/12 max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg",
            className,
          )}
        >
          {/* Close button row — always rendered above children so nothing gets obscured */}
          <View style={styles.closeRow}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => onOpenChange(false)}
            >
              <X size={16} color="hsl(215.4 16.3% 46.9%)" />
            </TouchableOpacity>
          </View>

          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  card: {
    maxHeight: "85%",
    flexDirection: "column",
  },
  closeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  closeButton: {
    opacity: 0.7,
    padding: 4,
  },
});

interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

function DialogHeader({ className, children }: DialogHeaderProps) {
  return (
    <View className={cn("flex flex-col gap-1.5 mb-3", className)}>
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
    <View className={cn("flex flex-col gap-2 mt-4", className)}>
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
