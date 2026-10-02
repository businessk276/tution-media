type CircularLoaderProps = {
  label: string;
  inline?: boolean;
  decorative?: boolean;
};

export default function CircularLoader({
  label,
  inline = false,
  decorative = false,
}: CircularLoaderProps) {
  return (
    <span
      className={`circular-loader${inline ? " circular-loader-inline" : ""}${decorative ? " circular-loader-decorative" : ""}`}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <span className="circular-loader-ring" aria-hidden="true" />
      {!inline && !decorative && <span className="circular-loader-label">{label}</span>}
    </span>
  );
}
