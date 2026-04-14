import React, { useRef, forwardRef, useImperativeHandle } from "react";
import SignaturePad from "react-signature-canvas";

interface SignatureCanvasWebProps {
  onOK: (signature: string) => void;
}

export interface SignatureCanvasWebRef {
  clearSignature: () => void;
  readSignature: () => void;
}

export const SignatureCanvasWeb = forwardRef<
  SignatureCanvasWebRef,
  SignatureCanvasWebProps
>(({ onOK }, ref) => {
  const sigPadRef = useRef<SignaturePad>(null);

  useImperativeHandle(ref, () => ({
    clearSignature: () => {
      sigPadRef.current?.clear();
    },
    readSignature: () => {
      if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
        const dataURL = sigPadRef.current.toDataURL("image/png");
        onOK(dataURL);
      }
    },
  }));

  return (
    <SignaturePad
      ref={sigPadRef}
      canvasProps={{
        style: {
          width: "100%",
          height: "100%",
          border: "none",
        },
      }}
      backgroundColor="rgb(255, 255, 255)"
      penColor="rgb(0, 0, 0)"
    />
  );
});

SignatureCanvasWeb.displayName = "SignatureCanvasWeb";
