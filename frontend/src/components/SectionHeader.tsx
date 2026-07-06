import { type ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <div className="stage-tag">{eyebrow}</div>
      <h2 className="section-title mt-4 text-3xl md:text-5xl">{title}</h2>
      {intro ? (
        <p className="mt-6 text-base leading-relaxed text-muted md:text-lg">{intro}</p>
      ) : null}
      <div className={align === "center" ? "divider-gold mt-8" : "mt-8 h-px w-16 bg-[--gold]"} />
    </div>
  );
}
