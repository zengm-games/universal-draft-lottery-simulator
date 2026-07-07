import type { ComponentChildren } from "preact";

export const Button = ({
	children,
	className,
	disabled,
	onClick,
	outline,
	variant,
}: {
	children: ComponentChildren;
	className?: string;
	disabled?: boolean;
	onClick: () => void;
	outline?: boolean;
	variant: "danger" | "primary" | "secondary" | "success";
}) => {
	let colorClasses;
	if (variant === "primary") {
		colorClasses = "enabled:hover:bg-slate-100 text-blue-600 border-blue-600";
	} else if (variant === "danger") {
		colorClasses = "enabled:hover:bg-slate-100 text-red-600 border-red-600";
	} else if (variant === "secondary") {
		colorClasses = "enabled:hover:bg-slate-100 text-slate-600 border-slate-600";
	} else if (variant === "success") {
		if (!outline) {
			colorClasses = "enabled:hover:bg-green-800 enabled:hover:text-white text-white bg-green-700";
		}
	}

	return (
		<button
			className={`${
				outline ? "bg-transparent " : ""
			}py-2 px-3 border rounded disabled:opacity-50 ${colorClasses}${
				className ? ` ${className}` : ""
			}`}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	);
};
