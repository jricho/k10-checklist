import React from "react";

interface ProgressProps {
  value: number;
}

export function Progress({ value }: ProgressProps) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-blue-600 h-2.5 rounded-full"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
