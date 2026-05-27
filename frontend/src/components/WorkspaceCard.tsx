import { ReactNode, forwardRef } from "react";

type WorkspaceCardProps = {
  badge?: string;
  badgeClass?: string;
  title: string;
  description?: string;
  status?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  focused?: boolean;
  className?: string;
  bodyClassName?: string;
};

const WorkspaceCard = forwardRef<HTMLElement, WorkspaceCardProps>(function WorkspaceCard({
  badge,
  badgeClass = "badge-system",
  title,
  description,
  status,
  actions,
  children,
  focused,
  className = "",
  bodyClassName = "p-5"
}, ref) {
  return (
    <section
      ref={ref}
      className={`panel overflow-hidden transition ${
        focused ? "ring-2 ring-[#F69D39]/60 ring-offset-2 ring-offset-warm" : ""
      } ${className}`}
    >
      <div className="border-b border-line bg-[#FFFBF5] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {badge && <span className={badgeClass}>{badge}</span>}
            <h2 className="mt-3 text-xl font-semibold text-ink">{title}</h2>
            {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>}
          </div>
          {(status || actions) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              {status}
              {actions}
            </div>
          )}
        </div>
      </div>
      {children && <div className={bodyClassName}>{children}</div>}
    </section>
  );
});

export default WorkspaceCard;
