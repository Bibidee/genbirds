import { HTMLAttributes } from "react";
export default function Card({ className = "", ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel p-5 ${className}`} {...p} />;
}
