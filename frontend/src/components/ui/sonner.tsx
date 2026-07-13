import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-void group-[.toaster]:text-cream group-[.toaster]:border-line group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted",
          actionButton: "group-[.toast]:bg-gold group-[.toast]:text-void",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
