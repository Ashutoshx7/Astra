"use client";
import React from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface RadialGradientButtonProps extends HTMLMotionProps<"button"> {
  loading?: boolean;
}

const buttonVar = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const RadialGradientButton = React.forwardRef<
  HTMLButtonElement,
  RadialGradientButtonProps
>(({ className, children, loading, ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.95 }}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative min-w-28 rounded-xl h-10 px-6 py-2 text-white border-none shadow-lg overflow-hidden transition-all duration-300 active:scale-95",
        className,
      )}
      style={{
        background:
          "radial-gradient(74.77% 41.6% at 83.56% 45.09%, #000000 44.14%, #1700E3 100%)",
        boxShadow: "inset 0px 3px 12px -2px #FFFFFF",
      }}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="spinner"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={buttonVar}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className="flex items-center justify-center h-full"
          >
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </motion.div>
        ) : (
          <motion.span
            key="content"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={buttonVar}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className="flex items-center justify-center h-full"
          >
            {children || "Login"}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

RadialGradientButton.displayName = "RadialGradientButton";

export default RadialGradientButton;
