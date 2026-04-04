import React, { forwardRef } from "react";
import cx from "classnames";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col mb-4">
        {label && (
          <label className="font-bold text-sm uppercase mb-1">{label}</label>
        )}
        <input
          ref={ref}
          className={cx(
            "px-4 py-2 border-3 border-black text-neoText focus:outline-none focus:ring-4 transition-all ease-in-out placeholder-gray-500 shadow-[2px_2px_0_0_#000]",
            {
              "focus:ring-neoPrimary border-neoPrimary bg-[#ffe6e6]": !!error,
              "focus:ring-neoAccent bg-white": !error,
            },
            className
          )}
          {...props}
        />
        {error && <span className="text-neoPrimary font-bold text-sm mt-1">{error}</span>}
      </div>
    );
  }
);
